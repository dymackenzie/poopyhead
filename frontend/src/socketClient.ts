/**
 * Socket Client
 * 
 * Manages Socket.io connection and event handlers.
 */

/// <reference types="vite/client" />

import { io, Socket } from 'socket.io-client';
import type { GameStatePatch, LobbyResponse, LobbySettings, PlayerJoinedPayload, PlayerReadyPayload, ReadyResponse } from './types/game';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;

/**
 * Initialize socket connection.
 */
export function initSocket(callbacks: {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onLobbyCreated?: (data: LobbyResponse) => void;
  onGameStarted?: (data: GameStatePatch) => void;
  onCardPlayed?: (data: GameStatePatch) => void;
  onPlayerJoined?: (data: PlayerJoinedPayload) => void;
  onPlayerReady?: (data: PlayerReadyPayload) => void;
  onGameEnded?: (data: { loserId: string; loserUsername: string }) => void;
}): Socket {
  socket = io(SOCKET_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
    callbacks.onConnect?.();
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected');
    callbacks.onDisconnect?.();
  });

  socket.on('playerJoined', (data: PlayerJoinedPayload) => {
    callbacks.onPlayerJoined?.(data);
  });

  socket.on('playerReady', (data: PlayerReadyPayload) => {
    callbacks.onPlayerReady?.(data);
  });

  socket.on('gameStarted', (data: GameStatePatch) => {
    callbacks.onGameStarted?.(data);
  });

  socket.on('cardPlayed', (data: GameStatePatch) => {
    callbacks.onCardPlayed?.(data);
  });

  socket.on('gameEnded', (data: { loserId: string; loserUsername: string }) => {
    callbacks.onGameEnded?.(data);
  });

  socket.on('playerReconnected', (data: PlayerJoinedPayload) => {
    console.log('[Socket] Player reconnected:', data.playerId);
  });

  socket.on('playerDisconnected', (data: PlayerJoinedPayload) => {
    console.log('[Socket] Player disconnected:', data.playerId);
  });

  return socket;
}

/**
 * Get current socket instance.
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Emit event to server.
 */
export function emitEvent<TResponse = unknown>(event: string, data: Record<string, unknown>, callback?: (response: TResponse) => void) {
  if (!socket) {
    console.error('[Socket] Not connected');
    return;
  }

  socket.emit(event, data, callback);
}

/**
 * Create lobby.
 */
export function createLobby(
  username: string,
  settings: LobbySettings
): Promise<LobbyResponse> {
  return new Promise((resolve) => {
    emitEvent('createLobby', { username, bombEnabled: settings.bombEnabled, turnTimerSeconds: settings.turnTimerSeconds }, resolve);
  });
}

/**
 * Join lobby.
 */
export function joinLobby(code: string, username: string): Promise<LobbyResponse> {
  return new Promise((resolve) => {
    emitEvent('joinLobby', { code, username }, resolve);
  });
}

/**
 * Set player ready.
 */
export function setPlayerReady(code: string, playerId: string, ready: boolean): Promise<ReadyResponse> {
  return new Promise((resolve) => {
    emitEvent('setReady', { code, playerId, ready }, resolve);
  });
}

/**
 * Start game.
 */
export function startGame(code: string, playerId: string, direction: 'clockwise' | 'counterclockwise'): Promise<unknown> {
  return new Promise((resolve) => {
    emitEvent('startGame', { code, playerId, direction }, resolve);
  });
}

/**
 * Play cards.
 */
export function playCards(gameId: string, playerId: string, cardIds: string[]): Promise<unknown> {
  return new Promise((resolve) => {
    emitEvent('playCard', { gameId, playerId, cardIds }, resolve);
  });
}

/**
 * Reconnect to existing session.
 */
export function reconnectSession(sessionId: string, gameId: string): Promise<unknown> {
  return new Promise((resolve) => {
    emitEvent('reconnect', { sessionId, gameId }, resolve);
  });
}

/**
 * Send heartbeat to keep session alive.
 */
export function sendHeartbeat() {
  emitEvent('heartbeat', {});
}
