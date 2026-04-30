/**
 * Security & Rate Limiting Service
 * 
 * MVP protections against common abuse vectors:
 * - Rate limiting for lobby creation, joins, reconnects
 * - Payload validation and size caps
 * - Per-IP connection limits
 * - Logging of suspicious behavior
 */

export interface RateLimitConfig {
  maxAttempts: number;
  windowSeconds: number;
}

export interface RateLimitEntry {
  count: number;
  resetTime: Date;
}

const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  createLobby: { maxAttempts: 5, windowSeconds: 60 },
  joinLobby: { maxAttempts: 10, windowSeconds: 60 },
  reconnect: { maxAttempts: 20, windowSeconds: 60 },
};

// In-memory rate limit tracking
const rateLimits = new Map<string, Map<string, RateLimitEntry>>();

/**
 * Check if action is rate limited.
 */
export function checkRateLimit(action: string, identifier: string): { allowed: boolean; reason?: string } {
  const config = DEFAULT_RATE_LIMITS[action];
  if (!config) {
    return { allowed: true };
  }

  const key = `${action}:${identifier}`;

  if (!rateLimits.has(action)) {
    rateLimits.set(action, new Map());
  }

  const actionLimits = rateLimits.get(action)!;
  const entry = actionLimits.get(identifier);
  const now = new Date();

  if (!entry || now > entry.resetTime) {
    // Fresh window
    actionLimits.set(identifier, {
      count: 1,
      resetTime: new Date(now.getTime() + config.windowSeconds * 1000),
    });
    return { allowed: true };
  }

  entry.count += 1;

  if (entry.count > config.maxAttempts) {
    return { allowed: false, reason: 'RATE_LIMIT_EXCEEDED' };
  }

  return { allowed: true };
}

/**
 * Validate socket.io payload size.
 */
export function validatePayloadSize(data: any, maxBytes: number = 1024 * 5): { valid: boolean; reason?: string } {
  try {
    const jsonString = JSON.stringify(data);
    const bytes = Buffer.byteLength(jsonString, 'utf8');

    if (bytes > maxBytes) {
      return { valid: false, reason: 'PAYLOAD_TOO_LARGE' };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'INVALID_JSON' };
  }
}

/**
 * Validate card IDs to prevent injection.
 */
export function validateCardIds(cardIds: any[]): { valid: boolean; reason?: string } {
  if (!Array.isArray(cardIds)) {
    return { valid: false, reason: 'INVALID_CARD_ID_FORMAT' };
  }

  if (cardIds.length > 20) {
    return { valid: false, reason: 'TOO_MANY_CARDS' };
  }

  for (const cardId of cardIds) {
    if (typeof cardId !== 'string' || cardId.length > 100) {
      return { valid: false, reason: 'INVALID_CARD_ID' };
    }
  }

  return { valid: true };
}

/**
 * Validate username to prevent injection.
 */
export function validateUsername(username: any): { valid: boolean; reason?: string } {
  if (typeof username !== 'string') {
    return { valid: false, reason: 'INVALID_USERNAME_TYPE' };
  }

  if (username.length < 1 || username.length > 50) {
    return { valid: false, reason: 'INVALID_USERNAME_LENGTH' };
  }

  // Allow alphanumeric, spaces, and basic punctuation
  if (!/^[\w\s\-\.]{1,50}$/i.test(username)) {
    return { valid: false, reason: 'INVALID_USERNAME_CHARACTERS' };
  }

  return { valid: true };
}

/**
 * Validate lobby code format.
 */
export function validateLobbyCode(code: any): { valid: boolean; reason?: string } {
  if (typeof code !== 'string') {
    return { valid: false, reason: 'INVALID_CODE_TYPE' };
  }

  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return { valid: false, reason: 'INVALID_CODE_FORMAT' };
  }

  return { valid: true };
}

/**
 * Extract client IP from Socket.io connection.
 */
export function extractClientIP(socket: any): string {
  return (
    socket.handshake?.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    socket.handshake?.address ||
    'unknown'
  );
}

/**
 * Log security event.
 */
export function logSecurityEvent(event: string, details: Record<string, any>) {
  console.log(`[Security] ${event}`, details);
}

/**
 * TESTING ONLY: Clear rate limits.
 */
export function clearRateLimits() {
  rateLimits.clear();
}
