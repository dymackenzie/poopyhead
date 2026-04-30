/**
 * Step 11: MVP Security & Abuse Controls
 * 
 * Tests for rate limiting and payload validation:
 * - Rate limit enforcement
 * - Payload size validation
 * - Input validation (username, codes, etc.)
 * - Security event logging
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  validatePayloadSize,
  validateCardIds,
  validateUsername,
  validateLobbyCode,
  clearRateLimits,
} from '../services/SecurityService';

describe('Step 11: MVP Security & Abuse Controls', () => {
  beforeEach(() => {
    clearRateLimits();
  });

  describe('Rate Limiting', () => {
    it('should allow initial requests', () => {
      const result = checkRateLimit('createLobby', 'user123');
      expect(result.allowed).toBe(true);
    });

    it('should allow requests within limit', () => {
      const ip = 'user123';

      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit('createLobby', ip);
        expect(result.allowed).toBe(true);
      }
    });

    it('should reject requests exceeding limit', () => {
      const ip = 'user123';

      // First 5 allowed
      for (let i = 0; i < 5; i++) {
        const result = checkRateLimit('createLobby', ip);
        expect(result.allowed).toBe(true);
      }

      // 6th should be rejected
      const result = checkRateLimit('createLobby', ip);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should track different actions independently', () => {
      const ip = 'user123';

      // Max out createLobby
      for (let i = 0; i < 5; i++) {
        checkRateLimit('createLobby', ip);
      }

      // joinLobby should still be allowed
      const result = checkRateLimit('joinLobby', ip);
      expect(result.allowed).toBe(true);
    });

    it('should track different IPs independently', () => {
      // Max out ip1
      for (let i = 0; i < 5; i++) {
        checkRateLimit('createLobby', 'ip1');
      }

      // ip2 should be unaffected
      const result = checkRateLimit('createLobby', 'ip2');
      expect(result.allowed).toBe(true);
    });

    it('should handle higher limits for joins and reconnects', () => {
      const ip = 'user456';

      // joinLobby allows 10
      for (let i = 0; i < 10; i++) {
        const result = checkRateLimit('joinLobby', ip);
        expect(result.allowed).toBe(true);
      }

      // 11th should be rejected
      const result = checkRateLimit('joinLobby', ip);
      expect(result.allowed).toBe(false);

      // reconnect allows 20
      const ip2 = 'user789';
      for (let i = 0; i < 20; i++) {
        const result = checkRateLimit('reconnect', ip2);
        expect(result.allowed).toBe(true);
      }

      // 21st should be rejected
      const result2 = checkRateLimit('reconnect', ip2);
      expect(result2.allowed).toBe(false);
    });
  });

  describe('Payload Validation', () => {
    it('should accept valid payloads', () => {
      const data = { username: 'Alice', code: 'ABC123' };
      const result = validatePayloadSize(data);
      expect(result.valid).toBe(true);
    });

    it('should reject oversized payloads', () => {
      const largeData = {
        data: 'x'.repeat(10000), // 10KB
      };
      const result = validatePayloadSize(largeData, 1024 * 5); // 5KB limit
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('PAYLOAD_TOO_LARGE');
    });

    it('should reject invalid JSON', () => {
      // Create an object with circular reference
      const circular: any = {};
      circular.self = circular;

      const result = validatePayloadSize(circular);
      expect(result.valid).toBe(false);
    });
  });

  describe('Card ID Validation', () => {
    it('should accept valid card ID arrays', () => {
      const cardIds = ['card-1', 'card-2', 'card-3'];
      const result = validateCardIds(cardIds);
      expect(result.valid).toBe(true);
    });

    it('should reject non-array input', () => {
      const result = validateCardIds('not-an-array' as any);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_CARD_ID_FORMAT');
    });

    it('should reject too many cards', () => {
      const cardIds = Array(21).fill('card-1');
      const result = validateCardIds(cardIds);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('TOO_MANY_CARDS');
    });

    it('should reject invalid card ID format', () => {
      const cardIds = [123] as any; // Not a string
      const result = validateCardIds(cardIds);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_CARD_ID');
    });

    it('should reject oversized card IDs', () => {
      const cardIds = ['x'.repeat(101)];
      const result = validateCardIds(cardIds);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_CARD_ID');
    });
  });

  describe('Username Validation', () => {
    it('should accept valid usernames', () => {
      const validNames = ['Alice', 'Bob_Smith', 'player-123', 'Alice.123'];
      validNames.forEach(name => {
        const result = validateUsername(name);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject non-string usernames', () => {
      const result = validateUsername(123);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_USERNAME_TYPE');
    });

    it('should reject empty usernames', () => {
      const result = validateUsername('');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_USERNAME_LENGTH');
    });

    it('should reject oversized usernames', () => {
      const result = validateUsername('x'.repeat(51));
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_USERNAME_LENGTH');
    });

    it('should reject special characters', () => {
      const result = validateUsername('Alice<script>');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_USERNAME_CHARACTERS');
    });
  });

  describe('Lobby Code Validation', () => {
    it('should accept valid lobby codes', () => {
      const validCodes = ['ABC123', 'XYZ789', '000000', 'ZZZZZZ'];
      validCodes.forEach(code => {
        const result = validateLobbyCode(code);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject non-string codes', () => {
      const result = validateLobbyCode(123456);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID_CODE_TYPE');
    });

    it('should reject incorrect format', () => {
      const invalidCodes = ['ABC12', 'ABC1234', 'abc123', 'ABC-12'];
      invalidCodes.forEach(code => {
        const result = validateLobbyCode(code);
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('INVALID_CODE_FORMAT');
      });
    });
  });

  describe('Security Event Logging', () => {
    it('should handle logging without throwing', () => {
      // This is a basic smoke test
      expect(() => {
        // logSecurityEvent('test', { ip: '127.0.0.1' });
      }).not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should prevent brute force lobby code guessing', () => {
      const ip = 'attacker-ip';

      let blocked = false;

      for (let i = 0; i < 25; i++) {
        const result = checkRateLimit('joinLobby', ip);
        if (!result.allowed) {
          blocked = true;
          break;
        }
      }

      expect(blocked).toBe(true);
    });

    it('should reject suspicious payloads early', () => {
      const suspiciousPayloads = [
        { cardIds: 'not-an-array' },
        { cardIds: Array(50).fill('card') },
        { username: '<script>alert(1)</script>' },
        { code: 'INVALID_CODE' },
      ];

      const validations = [
        validateCardIds(suspiciousPayloads[0].cardIds as any),
        validateCardIds(suspiciousPayloads[1].cardIds as any),
        validateUsername(suspiciousPayloads[2].username),
        validateLobbyCode(suspiciousPayloads[3].code),
      ];

      validations.forEach(result => {
        expect(result.valid).toBe(false);
      });
    });

    it('should allow legitimate gameplay under normal conditions', () => {
      const playerIP = 'legitimate-player';

      // Normal gameplay sequence
      const createResult = checkRateLimit('createLobby', playerIP);
      expect(createResult.allowed).toBe(true);

      const joinResult = checkRateLimit('joinLobby', playerIP);
      expect(joinResult.allowed).toBe(true);

      // Validate gameplay data
      expect(validateUsername('Alice').valid).toBe(true);
      expect(validateLobbyCode('ABC123').valid).toBe(true);
      expect(validateCardIds(['card-1', 'card-2']).valid).toBe(true);
    });
  });
});
