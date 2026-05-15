/**
 * Socket.io Event Handlers — Entry Point
 *
 * Registers all socket event listeners.
 * Implementation logic lives in the focused sub-modules:
 *   handlers/lobby.ts    — createLobby, joinLobby, setReady, startGame, rematch
 *   handlers/play.ts     — swapCards, playCard, pickupPile, debugAutoPlay
 *   handlers/reconnect.ts — disconnect, resumeGame, reconnect
 *   broadcast.ts         — buildPublicPlayerState, persistGame, broadcastPlayResult, …
 *   ai/botTurn.ts        — scheduleNextAITurnIfNeeded, executeAndBroadcastAITurn, processBotSwaps
 */

import { Socket, Server } from 'socket.io';
import { handleCreateLobby, handleJoinLobby, handleSetReady, handleStartGame, handleRematch } from './handlers/lobby.js';
import { handleSwapCards, handlePlayCard, handlePickupPile, handleDebugAutoPlay } from './handlers/play.js';
import { handleDisconnect, handleResumeGame, handleReconnectSession } from './handlers/reconnect.js';

// Re-export PoopyheadNamespace so server.ts doesn't need to change its import
export type { PoopyheadNamespace } from './namespace.js';
import type { PoopyheadNamespace } from './namespace.js';

/**
 * Creates and registers socket event handlers.
 * This function signature is stable — server.ts depends on it.
 */
export function setupSocketHandlers(io: Server, ns: PoopyheadNamespace) {

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('createLobby', (data, callback) => {
      handleCreateLobby(socket, data, callback, io, ns);
    });

    socket.on('joinLobby', (data, callback) => {
      handleJoinLobby(socket, data, callback, io, ns);
    });

    socket.on('setReady', (data, callback) => {
      handleSetReady(socket, data, callback, io, ns);
    });

    socket.on('startGame', (data, callback) => {
      handleStartGame(socket, data, callback, io, ns);
    });

    socket.on('swapCards', (data, callback) => {
      handleSwapCards(socket, data, callback, io, ns);
    });

    socket.on('playCard', (data, callback) => {
      handlePlayCard(socket, data, callback, io, ns);
    });

    socket.on('pickupPile', (data, callback) => {
      handlePickupPile(socket, data, callback, io, ns);
    });

    socket.on('debugAutoPlay', (data, callback) => {
      handleDebugAutoPlay(socket, data, callback, io, ns);
    });

    socket.on('rematch', (data, callback) => {
      handleRematch(socket, data, callback, io, ns);
    });

    socket.on('reconnect', (data, callback) => {
      handleReconnectSession(socket, data, callback, io, ns);
    });

    socket.on('resumeGame', (data, callback) => {
      handleResumeGame(socket, data, callback, io, ns);
    });

    socket.on('heartbeat', () => {
      const playerId = ns.socketToPlayer.get(socket.id);
      if (playerId) {
        console.log(`[Heartbeat] ${playerId}`);
      }
    });

    socket.on('disconnect', () => {
      handleDisconnect(socket, io, ns);
    });
  });
}
