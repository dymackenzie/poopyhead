/**
 * Disconnect and reconnect socket event handlers.
 * Handles: disconnect, resumeGame, reconnect (session-based)
 */

import { Socket, Server } from 'socket.io';
import { GameInstance } from '../../services/GameManager.js';
import { handleReconnect, getSession } from '../../services/SessionManager.js';
import { PoopyheadNamespace } from '../namespace.js';
import { persistGame, getGame } from '../broadcast.js';
import { scheduleNextAITurnIfNeeded, BOT_TAKEOVER_DELAY_MS } from '../ai/botTurn.js';

export function findGameForPlayer(playerId: string, ns: PoopyheadNamespace): GameInstance | undefined {
  for (const game of ns.games.values()) {
    if (game.status === 'playing' && game.players.some(p => p.id === playerId)) {
      return game;
    }
  }
  return undefined;
}

export function handleDisconnect(socket: Socket, io: Server, ns: PoopyheadNamespace) {
  try {
    const playerId = ns.socketToPlayer.get(socket.id);

    if (playerId) {
      ns.playerToSocket.delete(playerId);
      ns.socketToPlayer.delete(socket.id);

      console.log(`[Socket] ${playerId} disconnected`);

      for (const room of socket.rooms) {
        if (room !== socket.id) {
          io.to(room).emit('playerDisconnected', { playerId });
        }
      }

      // Schedule bot takeover if player is in an active live-mode game
      const game = findGameForPlayer(playerId, ns);
      if (game) {
        const lobby = ns.lobbies.get(game.lobbyCode);
        if (lobby?.settings.mode !== 'live') return; // async games never auto-bot

        const timeout = setTimeout(() => {
          const currentGame = ns.games.get(game.id);
          if (!currentGame || currentGame.status !== 'playing') return;
          if (ns.playerToSocket.has(playerId)) return; // player reconnected

          const updatedGame = {
            ...currentGame,
            players: currentGame.players.map(p =>
              p.id === playerId ? { ...p, isBot: true, wasReplaced: true } : p
            ),
          };
          persistGame(updatedGame, ns);
          ns.pendingBotTakeovers.delete(playerId);

          const takenOverPlayer = updatedGame.players.find(p => p.id === playerId);
          console.log(`[AI] Bot takeover for disconnected player ${takenOverPlayer?.username ?? playerId}`);

          // If it's currently their turn, schedule AI move
          const currentTurnId = updatedGame.playOrder[updatedGame.currentPlayerIndex];
          if (currentTurnId === playerId) {
            scheduleNextAITurnIfNeeded(updatedGame, io, ns);
          }
        }, BOT_TAKEOVER_DELAY_MS);

        ns.pendingBotTakeovers.set(playerId, timeout);
      }
    }
  } catch (error) {
    console.error('[Socket] Disconnect error:', error);
  }
}

export async function handleResumeGame(
  socket: Socket,
  data: { gameId: string },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const userId = socket.data.userId as string | null;
    if (!userId) return callback({ success: false, reason: 'NOT_AUTHENTICATED' });

    const game = await getGame(data.gameId, ns);
    if (!game) return callback({ success: false, reason: 'GAME_NOT_FOUND' });

    const player = game.players.find(p => p.userId === userId);
    if (!player) return callback({ success: false, reason: 'NOT_IN_GAME' });

    // Cancel any pending bot takeover for this player
    const pendingTakeover = ns.pendingBotTakeovers.get(player.id);
    if (pendingTakeover) {
      clearTimeout(pendingTakeover);
      ns.pendingBotTakeovers.delete(player.id);
    }

    // Reattach socket mappings
    ns.playerToSocket.set(player.id, socket.id);
    ns.socketToPlayer.set(socket.id, player.id);
    socket.join(`lobby:${game.lobbyCode}`);

    // Un-bot if bot takeover already fired
    let finalGame = game;
    if (player.isBot) {
      finalGame = {
        ...game,
        players: game.players.map(p =>
          p.id === player.id ? { ...p, isBot: false, wasReplaced: false } : p
        ),
      };
      persistGame(finalGame, ns);
    }

    io.to(`lobby:${game.lobbyCode}`).emit('playerReconnected', {
      playerId: player.id,
      gameId: game.id,
    });

    callback({ success: true, game: finalGame, playerId: player.id });

    console.log(`[Resume] ${player.username} resumed game ${data.gameId}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

export async function handleReconnectSession(
  socket: Socket,
  data: { sessionId: string; gameId: string },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const session = getSession(data.sessionId);
    if (!session) return callback({ success: false, reason: 'SESSION_NOT_FOUND' });

    const game = await getGame(data.gameId, ns);
    if (!game) return callback({ success: false, reason: 'GAME_NOT_FOUND' });

    const recoveryResult = handleReconnect(data.sessionId, socket.id);
    if (!recoveryResult.recovered) return callback({ success: false, reason: recoveryResult.reason });

    // Cancel pending bot takeover
    const pendingTakeover = ns.pendingBotTakeovers.get(session.playerId);
    if (pendingTakeover) {
      clearTimeout(pendingTakeover);
      ns.pendingBotTakeovers.delete(session.playerId);
    }

    // Un-bot the player if takeover already fired
    const currentGame = await getGame(data.gameId, ns);
    if (currentGame) {
      const updatedGame = {
        ...currentGame,
        players: currentGame.players.map(p =>
          p.id === session.playerId ? { ...p, isBot: false, wasReplaced: false } : p
        ),
      };
      persistGame(updatedGame, ns);
    }

    ns.playerToSocket.set(session.playerId, socket.id);
    ns.socketToPlayer.set(socket.id, session.playerId);

    socket.join(`lobby:${session.lobbyCode}`);
    socket.join(`game:${session.gameId}`);

    io.to(`lobby:${session.lobbyCode}`).emit('playerReconnected', {
      playerId: session.playerId,
      gameId: session.gameId,
    });

    callback({
      success: true,
      session: recoveryResult.session,
      game: ns.games.get(data.gameId),
    });

    console.log(`[Reconnect] ${session.playerId} recovered in game ${data.gameId}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}
