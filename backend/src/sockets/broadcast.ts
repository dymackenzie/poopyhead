/**
 * Broadcast helpers shared by socket handlers and AI turns.
 *
 * These functions emit game-state events to all players in a lobby room,
 * handle post-play persistence, and fire push notifications.
 */

import { Server } from 'socket.io';
import { saveGame, loadGame, deleteGame } from '../services/GameStateRepository.js';
import { supabaseAdmin } from '../supabase/client.js';
import { notifyTurn } from '../services/PushService.js';
import { GameInstance, PlayCardActionOutput, checkGameEnd, endGame } from '../services/GameManager.js';
import { PoopyheadNamespace } from './namespace.js';
import { DEFAULT_GAME_MODE } from '../services/constants.js';

export function buildPublicPlayerState(game: GameInstance) {
  return game.players.map(p => ({
    id: p.id,
    cardsInHand: p.hand.length,
    tableVisible: p.tableVisible,
    tableBlindCount: p.tableBlind.length,
    isBot: p.isBot,
  }));
}

/** Update in-memory cache and fire-and-forget DB write. Never blocks broadcasts. */
export function persistGame(game: GameInstance, ns: PoopyheadNamespace): void {
  ns.games.set(game.id, game);
  const lobby = ns.lobbies.get(game.lobbyCode);
  saveGame(game, lobby?.settings.mode ?? DEFAULT_GAME_MODE).catch(e =>
    console.error('[Persist] save failed', game.id, e)
  );
}

/** Look up game from cache; hydrate from DB on cold-start miss. */
export async function getGame(gameId: string, ns: PoopyheadNamespace): Promise<GameInstance | null> {
  let game = ns.games.get(gameId);
  if (!game) {
    game = await loadGame(gameId) ?? undefined;
    if (game) ns.games.set(gameId, game);
  }
  return game ?? null;
}

/** Record outcome stats for all authenticated non-replaced players. Fire-and-forget. */
export function recordStats(game: GameInstance): void {
  const authPlayers = game.players.filter(p => !p.isBot && p.userId && !p.wasReplaced);
  for (const p of authPlayers) {
    Promise.resolve(
      supabaseAdmin.rpc('increment_player_stats', {
        p_user_id: p.userId,
        p_was_loser: p.id === game.loser,
      })
    ).catch((e: unknown) => console.error('[Stats] increment failed', p.userId, e));
  }
}

/**
 * Send a push notification to the next player if they are not currently connected.
 * Only fires for authenticated non-bot players in async-mode games.
 */
export function maybeNotifyTurn(game: GameInstance, ns: PoopyheadNamespace): void {
  const nextPlayer = game.players[game.currentPlayerIndex];
  if (!nextPlayer?.userId || nextPlayer.isBot) return;
  if (ns.playerToSocket.has(nextPlayer.id)) return; // player is online

  const lastTurn = game.turnHistory[game.turnHistory.length - 1];
  const prevPlayer = lastTurn ? game.players.find(p => p.id === lastTurn.playerId) : undefined;

  notifyTurn(nextPlayer.userId, {
    gameId: game.id,
    lobbyCode: game.lobbyCode,
    opponentName: prevPlayer?.username,
  }).catch((e: unknown) => console.error('[Push] notifyTurn failed', e));
}

/**
 * Finalize a game: persist the final state, record stats, emit gameEnded to the
 * lobby room, schedule DB cleanup, and remove the game from the in-memory cache.
 * Returns true so callers can early-return cleanly.
 */
export function emitGameEnded(
  game: GameInstance,
  loserId: string,
  lobbyCode: string,
  io: Server,
  ns: PoopyheadNamespace
): true {
  // Cancel any pending AI turn for this game
  const pendingAI = ns.pendingAITurns.get(game.id);
  if (pendingAI) {
    clearTimeout(pendingAI);
    ns.pendingAITurns.delete(game.id);
  }

  const finalGame = endGame(game, loserId);
  persistGame(finalGame, ns);
  recordStats(finalGame);
  const loserPlayer = game.players.find(p => p.id === loserId);
  io.to(`lobby:${lobbyCode}`).emit('gameEnded', {
    loserId,
    loserUsername: loserPlayer?.username,
    loserTableCards: loserPlayer?.tableVisible ?? [],
    loserBlindCards: loserPlayer?.tableBlind ?? [],
  });
  deleteGame(finalGame.id).catch(e => console.error('[Cleanup] post-end delete failed', e));
  ns.games.delete(finalGame.id);
  return true;
}

/**
 * Emit cardPlayed or pilePicked (for blind_fail) after a successful play action.
 * Also checks for game end and schedules the next AI turn if needed.
 */
export function broadcastPlayResult(
  updatedGame: GameInstance,
  originalLobbyCode: string,
  playerId: string,
  cardIds: string[],
  actionResult: PlayCardActionOutput,
  io: Server,
  ns: PoopyheadNamespace,
  scheduleNextAITurn: (game: GameInstance, io: Server, ns: PoopyheadNamespace) => void
): void {
  const endCheck = checkGameEnd(updatedGame);
  if (endCheck.ended) {
    emitGameEnded(updatedGame, endCheck.loserId!, originalLobbyCode, io, ns);
    return;
  }

  if (actionResult.eventType === 'blind_fail') {
    const nextPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
    io.to(`lobby:${originalLobbyCode}`).emit('pilePicked', {
      playerId,
      nextPlayerId: updatedGame.playOrder[updatedGame.currentPlayerIndex],
      nextPlayerUsername: nextPlayer?.username,
      pileState: [],
      deckCount: updatedGame.deck.length,
      activeConstraints: updatedGame.activeConstraints,
      players: buildPublicPlayerState(updatedGame),
      blindFail: true,
      isBlindPlay: actionResult.sourceZone === 'blind',
      revealedCard: actionResult.cardsPlayed?.[0] ?? null,
    });
  } else {
    io.to(`lobby:${originalLobbyCode}`).emit('cardPlayed', {
      playerId,
      cardsPlayed: cardIds,
      nextPlayerId: updatedGame.playOrder[updatedGame.currentPlayerIndex],
      pileState: updatedGame.playPile,
      bombTriggered: actionResult.eventType === 'bomb_triggered',
      deckCount: updatedGame.deck.length,
      activeConstraints: updatedGame.activeConstraints,
      players: buildPublicPlayerState(updatedGame),
      isBlindPlay: actionResult.sourceZone === 'blind',
      isTablePlay: actionResult.sourceZone === 'table',
      revealedCard: (actionResult.sourceZone === 'blind' || actionResult.sourceZone === 'table')
        ? (actionResult.cardsPlayed?.[0] ?? null)
        : null,
    });
  }

  scheduleNextAITurn(updatedGame, io, ns);
  maybeNotifyTurn(updatedGame, ns);
}

/**
 * Emit pilePicked after a manual pickup action.
 * Also schedules the next AI turn if needed.
 */
export function broadcastPickupResult(
  updatedGame: GameInstance,
  originalLobbyCode: string,
  playerId: string,
  io: Server,
  ns: PoopyheadNamespace,
  scheduleNextAITurn: (game: GameInstance, io: Server, ns: PoopyheadNamespace) => void
): void {
  const nextPlayer = updatedGame.players.find(
    p => p.id === updatedGame.playOrder[updatedGame.currentPlayerIndex]
  );
  io.to(`lobby:${originalLobbyCode}`).emit('pilePicked', {
    playerId,
    nextPlayerId: updatedGame.playOrder[updatedGame.currentPlayerIndex],
    nextPlayerUsername: nextPlayer?.username,
    pileState: [],
    deckCount: updatedGame.deck.length,
    activeConstraints: updatedGame.activeConstraints,
    players: buildPublicPlayerState(updatedGame),
  });
  scheduleNextAITurn(updatedGame, io, ns);
  maybeNotifyTurn(updatedGame, ns);
}
