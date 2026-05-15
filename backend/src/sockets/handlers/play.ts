/**
 * In-game play socket event handlers.
 * Handles: swapCards, playCard, pickupPile, debugAutoPlay
 */

import { Socket, Server } from 'socket.io';
import {
  GameInstance,
  processPlayCardAction,
  processPickupAction,
  checkGameEnd,
  applySwap,
} from '../../services/GameManager.js';
import { advancePlayerIndex } from '../../services/TurnResolutionService.js';
import { buildAIRankGroups } from '../../services/AIPlayerService.js';
import { PoopyheadNamespace } from '../namespace.js';
import {
  buildPublicPlayerState,
  persistGame,
  getGame,
  broadcastPlayResult,
  broadcastPickupResult,
} from '../broadcast.js';
import { scheduleNextAITurnIfNeeded } from '../ai/botTurn.js';

export async function handleSwapCards(
  socket: Socket,
  data: { gameId: string; playerId: string; cardIds: string[] },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const game = await getGame(data.gameId, ns);
    if (!game) return callback({ success: false, reason: 'GAME_NOT_FOUND' });

    const swapResult = applySwap({
      game,
      playerId: data.playerId,
      cardIds: data.cardIds,
    });

    if (!swapResult.success) return callback({ success: false, reason: swapResult.reason });

    const updatedGame = swapResult.updatedGame!;
    persistGame(updatedGame, ns);

    callback({ success: true });

    const payload: Record<string, unknown> = {
      playerId: data.playerId,
      swappedCount: updatedGame.swappedPlayers.length,
      totalPlayers: updatedGame.players.length,
      phase: updatedGame.status,
    };

    if (swapResult.allPlayersSwapped) {
      const firstTurnPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
      payload.game = updatedGame;
      payload.currentTurnPlayerId = firstTurnPlayer?.id;
      payload.currentTurnPlayerUsername = firstTurnPlayer?.username;
      payload.deckCount = updatedGame.deck.length;
      payload.players = buildPublicPlayerState(updatedGame);
      scheduleNextAITurnIfNeeded(updatedGame, io, ns);
    }

    io.to(`lobby:${game.lobbyCode}`).emit('swapUpdate', payload);

    console.log(`[Game] ${data.playerId} swapped cards in ${data.gameId}` +
      (swapResult.allPlayersSwapped ? ' — all swapped, game starting' : ''));
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

export async function handlePlayCard(
  socket: Socket,
  data: { gameId: string; playerId: string; cardIds: string[] },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const game = await getGame(data.gameId, ns);
    if (!game) return callback({ success: false, reason: 'GAME_NOT_FOUND' });

    const actionResult = processPlayCardAction({
      game,
      playerId: data.playerId,
      cardIds: data.cardIds,
    });

    if (!actionResult.success) return callback({ success: false, reason: actionResult.reason });

    const updatedGame = actionResult.updatedGame!;
    persistGame(updatedGame, ns);

    if (actionResult.eventType === 'blind_fail') {
      const me = updatedGame.players.find(p => p.id === data.playerId);
      callback({ success: true, game: updatedGame, hand: me?.hand || [] });
    } else {
      callback({ success: true, game: updatedGame });
    }

    broadcastPlayResult(updatedGame, game.lobbyCode, data.playerId, data.cardIds, actionResult, io, ns, scheduleNextAITurnIfNeeded);

    console.log(`[Game] ${data.playerId} played cards in ${data.gameId}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

export async function handlePickupPile(
  socket: Socket,
  data: { gameId: string; playerId: string },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const game = await getGame(data.gameId, ns);
    if (!game) return callback({ success: false, reason: 'GAME_NOT_FOUND' });

    const result = processPickupAction({ game, playerId: data.playerId });
    if (!result.success) return callback({ success: false, reason: result.reason });

    const updatedGame = result.updatedGame!;
    persistGame(updatedGame, ns);

    const me = updatedGame.players.find(p => p.id === data.playerId);
    callback({ success: true, hand: me?.hand || [] });

    broadcastPickupResult(updatedGame, game.lobbyCode, data.playerId, io, ns, scheduleNextAITurnIfNeeded);

    console.log(`[Game] ${data.playerId} picked up pile in ${data.gameId}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

/**
 * Auto-play one turn with a simple greedy strategy (lowest valid rank group first).
 * Used only by the debug handler.
 */
function debugAutoPlayOneTurn(game: GameInstance): GameInstance {
  const currentPlayerId = game.playOrder[game.currentPlayerIndex];
  const player = game.players.find(p => p.id === currentPlayerId);
  if (!player) return game;

  if (player.hand.length === 0 && player.tableVisible.length === 0 && player.tableBlind.length === 0) {
    const nextIndex = advancePlayerIndex(game.currentPlayerIndex, 1, game.playOrder.length, game.direction);
    return { ...game, currentPlayerIndex: nextIndex };
  }

  for (const cardIds of buildAIRankGroups(game, currentPlayerId)) {
    const result = processPlayCardAction({ game, playerId: currentPlayerId, cardIds });
    if (result.success && result.updatedGame) return result.updatedGame;
  }

  if (game.playPile.length > 0) {
    const result = processPickupAction({ game, playerId: currentPlayerId });
    if (result.success && result.updatedGame) return result.updatedGame;
  }

  const nextIndex = advancePlayerIndex(game.currentPlayerIndex, 1, game.playOrder.length, game.direction);
  return { ...game, currentPlayerIndex: nextIndex };
}

export async function handleDebugAutoPlay(
  socket: Socket,
  data: { gameId: string },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const game = await getGame(data.gameId, ns);
    if (!game) return callback({ success: false, reason: 'GAME_NOT_FOUND' });
    if (game.status !== 'playing') return callback({ success: false, reason: 'GAME_NOT_PLAYING' });

    let currentGame = game;
    let iterations = 0;
    while (currentGame.deck.length > 0 && iterations < 2000) {
      const endCheck = checkGameEnd(currentGame);
      if (endCheck.ended) break;
      currentGame = debugAutoPlayOneTurn(currentGame);
      iterations++;
    }

    persistGame(currentGame, ns);

    const currentTurnPlayer = currentGame.players[currentGame.currentPlayerIndex];
    callback({ success: true, iterations });
    io.to(`lobby:${game.lobbyCode}`).emit('debugStateSync', {
      game: currentGame,
      currentTurnPlayerId: currentGame.playOrder[currentGame.currentPlayerIndex],
      currentTurnPlayerUsername: currentTurnPlayer?.username,
      deckCount: currentGame.deck.length,
      players: buildPublicPlayerState(currentGame),
    });

    console.log(`[Debug] Auto-played ${iterations} turns in ${data.gameId}, deck now ${currentGame.deck.length}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}
