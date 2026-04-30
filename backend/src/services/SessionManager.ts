/**
 * Session Manager Service
 * 
 * Manages player sessions for reconnection and persistence:
 * - Generate and validate session tokens
 * - Track session state (connected, disconnected, abandoned)
 * - Grace period for mobile network interruptions
 * - Session recovery on reconnect
 */

import { v4 as uuid } from 'uuid';

export interface PlayerSession {
  sessionId: string;                 // Unique session identifier
  playerId: string;                  // Player ID in game
  token: string;                     // JWT-like session token
  gameId: string;                    // Associated game
  lobbyCode: string;                 // Associated lobby
  socketId?: string;                 // Current socket ID
  createdAt: Date;
  lastHeartbeat: Date;
  status: 'active' | 'disconnected' | 'abandoned';
  graceEndTime: Date;                // When grace period expires (60 seconds)
  reconnectAttempts: number;
}

export interface SessionRecoveryResult {
  recovered: boolean;
  reason?: string;
  session?: PlayerSession;
  gameState?: any;
}

// In-memory session store (should be in Redis for production)
const sessions = new Map<string, PlayerSession>();
const sessionsByGameAndPlayer = new Map<string, Map<string, PlayerSession>>();

/**
 * Create a new session for a player.
 */
export function createSession(
  playerId: string,
  gameId: string,
  lobbyCode: string,
  socketId: string
): PlayerSession {
  const sessionId = uuid();
  const token = generateSessionToken(sessionId, playerId);
  const now = new Date();
  const gracePeriod = 60 * 1000; // 60 seconds for mobile networks

  const session: PlayerSession = {
    sessionId,
    playerId,
    token,
    gameId,
    lobbyCode,
    socketId,
    createdAt: now,
    lastHeartbeat: now,
    status: 'active',
    graceEndTime: new Date(now.getTime() + gracePeriod),
    reconnectAttempts: 0,
  };

  sessions.set(sessionId, session);

  // Index by game+player for quick lookup
  if (!sessionsByGameAndPlayer.has(gameId)) {
    sessionsByGameAndPlayer.set(gameId, new Map());
  }
  sessionsByGameAndPlayer.get(gameId)!.set(playerId, session);

  return session;
}

/**
 * Validate a session token.
 */
export function validateSessionToken(token: string): { valid: boolean; sessionId?: string } {
  // In production, use JWT verification
  // For MVP, use simple format: sessionId:playerId:timestamp:signature
  try {
    const parts = token.split(':');
    if (parts.length !== 3) return { valid: false };

    const sessionId = parts[0];
    const session = sessions.get(sessionId);

    if (!session) return { valid: false };

    // Check if session is not abandoned
    if (session.status === 'abandoned') return { valid: false };

    return { valid: true, sessionId };
  } catch {
    return { valid: false };
  }
}

/**
 * Handle socket reconnection for existing session.
 */
export function handleReconnect(
  sessionId: string,
  newSocketId: string
): SessionRecoveryResult {
  const session = sessions.get(sessionId);

  if (!session) {
    return { recovered: false, reason: 'SESSION_NOT_FOUND' };
  }

  if (session.status === 'abandoned') {
    return { recovered: false, reason: 'SESSION_ABANDONED' };
  }

  const now = new Date();

  // Check if grace period expired
  if (now > session.graceEndTime) {
    session.status = 'abandoned';
    return { recovered: false, reason: 'GRACE_PERIOD_EXPIRED' };
  }

  // Recover session
  session.socketId = newSocketId;
  session.status = 'active';
  session.lastHeartbeat = now;
  session.reconnectAttempts += 1;
  session.graceEndTime = new Date(now.getTime() + 60 * 1000); // Extend grace period

  sessions.set(sessionId, session);

  return { recovered: true, session };
}

/**
 * Register player disconnection (socket drop).
 */
export function handleDisconnect(sessionId: string): void {
  const session = sessions.get(sessionId);

  if (!session) return;

  session.status = 'disconnected';
  session.socketId = undefined;
  session.lastHeartbeat = new Date();

  sessions.set(sessionId, session);
}

/**
 * Update session heartbeat to keep grace period alive.
 */
export function updateHeartbeat(sessionId: string): void {
  const session = sessions.get(sessionId);

  if (!session) return;

  session.lastHeartbeat = new Date();
  sessions.set(sessionId, session);
}

/**
 * Cleanup abandoned sessions (run periodically).
 */
export function cleanupAbandonedSessions(): number {
  let cleaned = 0;
  const now = new Date();

  for (const [sessionId, session] of sessions.entries()) {
    if (session.status === 'abandoned' && now.getTime() - session.graceEndTime.getTime() > 5 * 60 * 1000) {
      // Remove if abandoned for >5 minutes
      sessions.delete(sessionId);

      // Remove from game index
      if (sessionsByGameAndPlayer.has(session.gameId)) {
        sessionsByGameAndPlayer.get(session.gameId)!.delete(session.playerId);
      }

      cleaned += 1;
    }
  }

  return cleaned;
}

/**
 * Get all sessions for a game.
 */
export function getGameSessions(gameId: string): PlayerSession[] {
  const gameSessions = sessionsByGameAndPlayer.get(gameId);
  return gameSessions ? Array.from(gameSessions.values()) : [];
}

/**
 * Get session by ID.
 */
export function getSession(sessionId: string): PlayerSession | undefined {
  return sessions.get(sessionId);
}

/**
 * Get active socket ID for a player in a game (or undefined if disconnected).
 */
export function getActiveSocketId(gameId: string, playerId: string): string | undefined {
  const gameSessions = sessionsByGameAndPlayer.get(gameId);
  const session = gameSessions?.get(playerId);

  if (!session || session.status !== 'active') {
    return undefined;
  }

  return session.socketId;
}

/**
 * Generate a session token (MVP: simple format).
 */
function generateSessionToken(sessionId: string, playerId: string): string {
  const timestamp = Date.now();
  const signature = Buffer.from(`${sessionId}:${playerId}:${timestamp}`).toString('base64');
  return `${sessionId}:${playerId}:${signature}`;
}

/**
 * Get session stats for monitoring.
 */
export function getSessionStats() {
  const activeSessions = Array.from(sessions.values()).filter(s => s.status === 'active').length;
  const disconnectedSessions = Array.from(sessions.values()).filter(s => s.status === 'disconnected').length;
  const abandonedSessions = Array.from(sessions.values()).filter(s => s.status === 'abandoned').length;

  return {
    total: sessions.size,
    active: activeSessions,
    disconnected: disconnectedSessions,
    abandoned: abandonedSessions,
  };
}

/**
 * TESTING ONLY: Clear all sessions (for test isolation).
 */
export function clearAllSessions() {
  sessions.clear();
  sessionsByGameAndPlayer.clear();
}
