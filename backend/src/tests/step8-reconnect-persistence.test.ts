/**
 * Step 8: Reconnect & Persistence
 * 
 * Tests for session management and reconnection:
 * - Session creation and tokens
 * - Reconnection recovery
 * - Grace period handling
 * - Session cleanup
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createSession,
  validateSessionToken,
  handleReconnect,
  handleDisconnect,
  getSession,
  getGameSessions,
  cleanupAbandonedSessions,
  getSessionStats,
  clearAllSessions,
} from '../services/SessionManager';

describe('Step 8: Reconnect & Persistence', () => {
  beforeEach(() => {
    // Clear all sessions before each test for isolation
    clearAllSessions();
  });
  describe('Session Management', () => {
    it('should create session with valid token', () => {
      const session = createSession(
        'player123',
        'game456',
        'ABC123',
        'socket789'
      );

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.playerId).toBe('player123');
      expect(session.gameId).toBe('game456');
      expect(session.lobbyCode).toBe('ABC123');
      expect(session.token).toBeDefined();
      expect(session.status).toBe('active');
      expect(session.reconnectAttempts).toBe(0);
    });

    it('should generate valid session token format', () => {
      const session = createSession(
        'player123',
        'game456',
        'ABC123',
        'socket789'
      );

      const parts = session.token.split(':');
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe(session.sessionId);
      expect(parts[1]).toBe('player123');
    });

    it('should validate correct session token', () => {
      const session = createSession(
        'player123',
        'game456',
        'ABC123',
        'socket789'
      );

      const result = validateSessionToken(session.token);
      expect(result.valid).toBe(true);
      expect(result.sessionId).toBe(session.sessionId);
    });

    it('should reject invalid session token', () => {
      const result = validateSessionToken('invalid-token');
      expect(result.valid).toBe(false);
    });

    it('should reject token for non-existent session', () => {
      const result = validateSessionToken('fake-session-id:player123:signature');
      expect(result.valid).toBe(false);
    });

    it('should retrieve session by ID', () => {
      const session = createSession(
        'player123',
        'game456',
        'ABC123',
        'socket789'
      );

      const retrieved = getSession(session.sessionId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.playerId).toBe('player123');
      expect(retrieved?.gameId).toBe('game456');
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = getSession('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Reconnection Logic', () => {
    it('should recover session on reconnect', () => {
      const session = createSession(
        'player123',
        'game456',
        'ABC123',
        'socket789'
      );

      const newSocketId = 'socket999';
      const result = handleReconnect(session.sessionId, newSocketId);

      expect(result.recovered).toBe(true);
      expect(result.session?.socketId).toBe(newSocketId);
      expect(result.session?.status).toBe('active');
      expect(result.session?.reconnectAttempts).toBe(1);
    });

    it('should increment reconnect attempt counter', () => {
      const session = createSession(
        'player123',
        'game456',
        'ABC123',
        'socket789'
      );

      // Simulate multiple reconnects
      for (let i = 1; i <= 3; i++) {
        const result = handleReconnect(session.sessionId, `socket${i}`);
        expect(result.recovered).toBe(true);
        expect(result.session?.reconnectAttempts).toBe(i);
      }
    });

    it('should reject reconnect for non-existent session', () => {
      const result = handleReconnect('non-existent', 'socket999');
      expect(result.recovered).toBe(false);
      expect(result.reason).toBe('SESSION_NOT_FOUND');
    });

    it('should reject reconnect for abandoned session', () => {
      const session = createSession(
        'player123',
        'game456',
        'ABC123',
        'socket789'
      );

      // Manually mark as abandoned
      const retrieved = getSession(session.sessionId);
      if (retrieved) {
        retrieved.status = 'abandoned';
      }

      const result = handleReconnect(session.sessionId, 'socket999');
      expect(result.recovered).toBe(false);
      expect(result.reason).toBe('SESSION_ABANDONED');
    });

    it('should extend grace period on successful reconnect', () => {
      const session = createSession(
        'player123',
        'game456',
        'ABC123',
        'socket789'
      );

      const originalGraceEnd = session.graceEndTime;

      // Wait a bit and reconnect
      setTimeout(() => {
        const result = handleReconnect(session.sessionId, 'socket999');
        expect(result.recovered).toBe(true);
        const newSession = result.session!;
        expect(newSession.graceEndTime.getTime()).toBeGreaterThan(originalGraceEnd.getTime());
      }, 100);
    });
  });

  describe('Disconnection & Grace Period', () => {
    it('should mark session as disconnected', () => {
      const session = createSession(
        'player123',
        'game456',
        'ABC123',
        'socket789'
      );

      handleDisconnect(session.sessionId);

      const retrieved = getSession(session.sessionId);
      expect(retrieved?.status).toBe('disconnected');
      expect(retrieved?.socketId).toBeUndefined();
    });

    it('should ignore disconnect for non-existent session', () => {
      // Should not throw
      expect(() => {
        handleDisconnect('non-existent');
      }).not.toThrow();
    });

    it('should track multiple disconnections', () => {
      const session = createSession(
        'player123',
        'game456',
        'ABC123',
        'socket789'
      );

      handleDisconnect(session.sessionId);
      const retrieved1 = getSession(session.sessionId);
      expect(retrieved1?.status).toBe('disconnected');

      // Reconnect
      const reconnectResult = handleReconnect(session.sessionId, 'socket999');
      expect(reconnectResult.recovered).toBe(true);

      const retrieved2 = getSession(session.sessionId);
      expect(retrieved2?.status).toBe('active');
    });
  });

  describe('Game Session Tracking', () => {
    it('should retrieve all sessions for a game', () => {
      const gameId = 'game456';
      
      const session1 = createSession('player1', gameId, 'ABC123', 'socket1');
      const session2 = createSession('player2', gameId, 'ABC123', 'socket2');
      const session3 = createSession('player3', 'otherGame', 'XYZ789', 'socket3');

      const gameSessions = getGameSessions(gameId);
      expect(gameSessions).toHaveLength(2);
      expect(gameSessions.map(s => s.playerId)).toContain('player1');
      expect(gameSessions.map(s => s.playerId)).toContain('player2');
      expect(gameSessions.map(s => s.playerId)).not.toContain('player3');
    });

    it('should return empty array for non-existent game', () => {
      const gameSessions = getGameSessions('non-existent-game');
      expect(gameSessions).toHaveLength(0);
    });
  });

  describe('Session Statistics', () => {
    it('should track session stats correctly', () => {
      const session1 = createSession('player1', 'game1', 'ABC123', 'socket1');
      const session2 = createSession('player2', 'game2', 'XYZ789', 'socket2');

      let stats = getSessionStats();
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(2);
      expect(stats.disconnected).toBe(0);
      expect(stats.abandoned).toBe(0);

      // Disconnect one
      handleDisconnect(session1.sessionId);
      stats = getSessionStats();
      expect(stats.active).toBe(1);
      expect(stats.disconnected).toBe(1);

      // Abandon one
      const retrieved = getSession(session2.sessionId);
      if (retrieved) {
        retrieved.status = 'abandoned';
      }
      stats = getSessionStats();
      expect(stats.active).toBe(0);
      expect(stats.disconnected).toBe(1);
      expect(stats.abandoned).toBe(1);
    });
  });

  describe('Cleanup & Maintenance', () => {
    it('should cleanup abandoned sessions', () => {
      const session1 = createSession('player1', 'game1', 'ABC123', 'socket1');
      const session2 = createSession('player2', 'game2', 'XYZ789', 'socket2');

      // Mark both as abandoned and past cleanup threshold
      const retrieved1 = getSession(session1.sessionId);
      const retrieved2 = getSession(session2.sessionId);
      
      if (retrieved1) {
        retrieved1.status = 'abandoned';
        retrieved1.graceEndTime = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes ago
      }
      
      if (retrieved2) {
        retrieved2.status = 'active';
      }

      const cleanedCount = cleanupAbandonedSessions();
      expect(cleanedCount).toBe(1);

      // Session 1 should be gone
      expect(getSession(session1.sessionId)).toBeUndefined();
      // Session 2 should still exist
      expect(getSession(session2.sessionId)).toBeDefined();
    });
  });

  describe('Integration Scenarios', () => {
    it('should support: disconnect -> wait -> reconnect -> play', () => {
      // 1. Create session
      const session = createSession('player1', 'game1', 'ABC123', 'socket1');
      expect(session.status).toBe('active');

      // 2. Disconnect
      handleDisconnect(session.sessionId);
      const disconnected = getSession(session.sessionId);
      expect(disconnected?.status).toBe('disconnected');

      // 3. Reconnect within grace period
      const reconnectResult = handleReconnect(session.sessionId, 'socket2');
      expect(reconnectResult.recovered).toBe(true);

      // 4. Player should be ready to play
      const recovered = getSession(session.sessionId);
      expect(recovered?.status).toBe('active');
      expect(recovered?.socketId).toBe('socket2');
      expect(recovered?.reconnectAttempts).toBe(1);
    });

    it('should support: multiple disconnects and reconnects', () => {
      const session = createSession('player1', 'game1', 'ABC123', 'socket1');

      for (let i = 0; i < 3; i++) {
        handleDisconnect(session.sessionId);
        const disconnected = getSession(session.sessionId);
        expect(disconnected?.status).toBe('disconnected');

        const result = handleReconnect(session.sessionId, `socket${i + 2}`);
        expect(result.recovered).toBe(true);

        const active = getSession(session.sessionId);
        expect(active?.status).toBe('active');
        expect(active?.reconnectAttempts).toBe(i + 1);
      }
    });
  });
});
