/**
 * Socket Client
 * 
 * Manages Socket.io connection and event handlers.
 */

/// <reference types="vite/client" />

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;

/**
 * Initialize socket connection.
 */
export function initSocket(callbacks: {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onLobbyCreated?: (data: Record<string, any>) => void;
  onGameStarted?: (data: Record<string, any>) => void;
  onCardPlayed?: (data: Record<string, any>) => void;
  onPlayerJoined?: (data: Record<string, any>) => void;
  onPlayerReady?: (data: Record<string, any>) => void;
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

  socket.on('playerJoined', (data: Record<string, any>) => {
    callbacks.onPlayerJoined?.(data);
  });

  socket.on('playerReady', (data: Record<string, any>) => {
    callbacks.onPlayerReady?.(data);
  });

  socket.on('gameStarted', (data: Record<string, any>) => {
    callbacks.onGameStarted?.(data);
  });

  socket.on('cardPlayed', (data: Record<string, any>) => {
    callbacks.onCardPlayed?.(data);
  });

  socket.on('playerReconnected', (data: Record<string, any>) => {
    console.log('[Socket] Player reconnected:', data.playerId);
  });

  socket.on('playerDisconnected', (data: Record<string, any>) => {
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
export function emitEvent(event: string, data: any, callback?: (response: any) => void) {
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
  settings: { bombEnabled: boolean; turnTimerSeconds: number }
): Promise<{ success: boolean; lobby?: any; playerId?: string; reason?: string }> {
  return new Promise((resolve) => {
    emitEvent('createLobby', { username, bombEnabled: settings.bombEnabled, turnTimerSeconds: settings.turnTimerSeconds }, resolve);
  });
}

/**
 * Join lobby.
 */
export function joinLobby(code: string, username: string): Promise<{ success: boolean; lobby?: any; playerId?: string; reason?: string }> {
  return new Promise((resolve) => {
    emitEvent('joinLobby', { code, username }, resolve);
  });
}

/**
 * Set player ready.
 */
export function setPlayerReady(code: string, playerId: string, ready: boolean): Promise<any> {
  return new Promise((resolve) => {
    emitEvent('setReady', { code, playerId, ready }, resolve);
  });
}

/**
 * Start game.
 */
export function startGame(code: string, playerId: string, direction: 'clockwise' | 'counterclockwise'): Promise<any> {
  return new Promise((resolve) => {
    emitEvent('startGame', { code, playerId, direction }, resolve);
  });
}

/**
 * Play cards.
 */
export function playCards(gameId: string, playerId: string, cardIds: string[]): Promise<any> {
  return new Promise((resolve) => {
    emitEvent('playCard', { gameId, playerId, cardIds }, resolve);
  });
}

/**
 * Reconnect to existing session.
 */
export function reconnectSession(sessionId: string, gameId: string): Promise<any> {
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
