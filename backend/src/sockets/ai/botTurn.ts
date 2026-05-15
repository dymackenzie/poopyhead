/**
 * AI Bot Turn Execution
 *
 * Handles scheduling and execution of AI player turns.
 * Uses a greedy strategy: lowest valid rank group first, then table, then blind flip.
 */

import { Server } from 'socket.io';
import { GameInstance, processPlayCardAction, processPickupAction, checkGameEnd, applySwap } from '../../services/GameManager.js';
import { advancePlayerIndex } from '../../services/TurnResolutionService.js';
import { buildAIRankGroups } from '../../services/AIPlayerService.js';
import { PoopyheadNamespace } from '../namespace.js';
import {
  buildPublicPlayerState,
  persistGame,
  broadcastPlayResult,
  broadcastPickupResult,
  emitGameEnded,
} from '../broadcast.js';

export const BOT_TAKEOVER_DELAY_MS = 30_000;
export const AI_TURN_DELAY_MS = 1_500;

/**
 * If the current player is a bot, schedules an AI turn after a short delay.
 * The pending timeout is tracked in ns.pendingAITurns so it can be cancelled
 * on game end or disconnect.
 */
export function scheduleNextAITurnIfNeeded(game: GameInstance, io: Server, ns: PoopyheadNamespace): void {
  if (game.status !== 'playing') return;

  const currentPlayer = game.players.find(
    p => p.id === game.playOrder[game.currentPlayerIndex]
  );
  if (!currentPlayer?.isBot) return;

  // Cancel any existing scheduled turn for this game before scheduling a new one
  const existing = ns.pendingAITurns.get(game.id);
  if (existing) clearTimeout(existing);

  const gameId = game.id;
  const handle = setTimeout(() => {
    ns.pendingAITurns.delete(gameId);
    const currentGame = ns.games.get(gameId);
    if (!currentGame || currentGame.status !== 'playing') return;

    const player = currentGame.players.find(
      p => p.id === currentGame.playOrder[currentGame.currentPlayerIndex]
    );
    if (!player?.isBot) return;

    console.log(`[AI] ${player.username} taking turn in ${gameId}`);
    executeAndBroadcastAITurn(currentGame, io, ns);
  }, AI_TURN_DELAY_MS);

  ns.pendingAITurns.set(gameId, handle);
}

/**
 * Executes one greedy AI turn: lowest valid rank → lowest table card → blind flip.
 * Broadcasts result using the same events as human plays.
 */
export function executeAndBroadcastAITurn(game: GameInstance, io: Server, ns: PoopyheadNamespace): void {
  const currentPlayerId = game.playOrder[game.currentPlayerIndex];
  const player = game.players.find(p => p.id === currentPlayerId);
  if (!player) return;

  const endCheck = checkGameEnd(game);
  if (endCheck.ended) {
    emitGameEnded(game, endCheck.loserId!, game.lobbyCode, io, ns);
    return;
  }

  // Player already out — advance and broadcast so frontend learns the new currentTurnPlayerId
  if (player.hand.length === 0 && player.tableVisible.length === 0 && player.tableBlind.length === 0) {
    const nextIndex = advancePlayerIndex(game.currentPlayerIndex, 1, game.playOrder.length, game.direction);
    const advanced = { ...game, currentPlayerIndex: nextIndex };
    persistGame(advanced, ns);
    io.to(`lobby:${game.lobbyCode}`).emit('cardPlayed', {
      playerId: currentPlayerId,
      cardsPlayed: [],
      nextPlayerId: advanced.playOrder[nextIndex],
      pileState: advanced.playPile,
      deckCount: advanced.deck.length,
      activeConstraints: advanced.activeConstraints,
      players: buildPublicPlayerState(advanced),
    });
    scheduleNextAITurnIfNeeded(advanced, io, ns);
    return;
  }

  // Try each rank group in greedy order (lowest valid rank first)
  for (const cardIds of buildAIRankGroups(game, currentPlayerId)) {
    const result = processPlayCardAction({ game, playerId: currentPlayerId, cardIds });
    if (result.success && result.updatedGame) {
      persistGame(result.updatedGame, ns);
      broadcastPlayResult(result.updatedGame, game.lobbyCode, currentPlayerId, cardIds, result, io, ns, scheduleNextAITurnIfNeeded);
      return;
    }
  }

  // Nothing playable — pick up pile
  if (game.playPile.length > 0) {
    const result = processPickupAction({ game, playerId: currentPlayerId });
    if (result.success && result.updatedGame) {
      persistGame(result.updatedGame, ns);
      broadcastPickupResult(result.updatedGame, game.lobbyCode, currentPlayerId, io, ns, scheduleNextAITurnIfNeeded);
      return;
    }
  }

  // Pile empty and nothing valid — advance turn and broadcast so frontend doesn't freeze
  const nextIndex = advancePlayerIndex(game.currentPlayerIndex, 1, game.playOrder.length, game.direction);
  const advanced = { ...game, currentPlayerIndex: nextIndex };
  persistGame(advanced, ns);
  io.to(`lobby:${game.lobbyCode}`).emit('cardPlayed', {
    playerId: currentPlayerId,
    cardsPlayed: [],
    nextPlayerId: advanced.playOrder[nextIndex],
    pileState: advanced.playPile,
    deckCount: advanced.deck.length,
    activeConstraints: advanced.activeConstraints,
    players: buildPublicPlayerState(advanced),
  });
  scheduleNextAITurnIfNeeded(advanced, io, ns);
}

/**
 * Auto-swap table cards for all bot players in a swapping-phase game.
 * Bots pick their 3 highest-value cards for the visible table.
 * Emits swapUpdate after all bots swap (with phase transition payload if applicable).
 */
export function processBotSwaps(game: GameInstance, io: Server, ns: PoopyheadNamespace): void {
  let currentGame = game;

  for (const player of currentGame.players) {
    if (!player.isBot) continue;
    if (currentGame.status !== 'swapping') break;

    const sortedHand = [...player.hand].sort((a, b) => b.value - a.value);
    const cardIds = sortedHand.slice(0, 3).map(c => c.id);
    const swapResult = applySwap({ game: currentGame, playerId: player.id, cardIds });
    if (swapResult.success && swapResult.updatedGame) {
      currentGame = swapResult.updatedGame;
    }
  }

  if (currentGame === game) return; // no bots swapped
  persistGame(currentGame, ns);

  const payload: Record<string, unknown> = {
    swappedCount: currentGame.swappedPlayers.length,
    totalPlayers: currentGame.players.length,
    phase: currentGame.status,
  };

  if (currentGame.status === 'playing') {
    const firstTurnPlayer = currentGame.players[currentGame.currentPlayerIndex];
    payload.game = currentGame;
    payload.currentTurnPlayerId = firstTurnPlayer?.id;
    payload.currentTurnPlayerUsername = firstTurnPlayer?.username;
    payload.deckCount = currentGame.deck.length;
    payload.players = buildPublicPlayerState(currentGame);
    scheduleNextAITurnIfNeeded(currentGame, io, ns);
  }

  io.to(`lobby:${game.lobbyCode}`).emit('swapUpdate', payload);
}
