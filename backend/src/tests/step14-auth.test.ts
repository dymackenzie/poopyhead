import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client before importing authMiddleware
vi.mock('../supabase/client.js', () => ({
  supabaseAnon: {
    auth: {
      getUser: vi.fn(),
    },
  },
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import { authMiddleware } from '../sockets/authMiddleware.js';
import { supabaseAnon } from '../supabase/client.js';

function makeSocket(token?: string) {
  return {
    handshake: { auth: token ? { token } : {} },
    data: {} as Record<string, any>,
  } as any;
}

describe('authMiddleware', () => {
  const next = vi.fn();

  beforeEach(() => {
    next.mockReset();
    vi.mocked(supabaseAnon.auth.getUser).mockReset();
  });

  it('no token → guest fallback', async () => {
    const socket = makeSocket();
    await authMiddleware(socket, next);
    expect(socket.data.userId).toBeNull();
    expect(socket.data.isAnonymous).toBe(true);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(); // no error
  });

  it('valid token → userId attached', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-abc', is_anonymous: true } },
      error: null,
    } as any);
    const socket = makeSocket('valid-jwt');
    await authMiddleware(socket, next);
    expect(socket.data.userId).toBe('user-abc');
    expect(socket.data.isAnonymous).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it('valid token for linked user → isAnonymous false', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-xyz', is_anonymous: false } },
      error: null,
    } as any);
    const socket = makeSocket('valid-jwt');
    await authMiddleware(socket, next);
    expect(socket.data.userId).toBe('user-xyz');
    expect(socket.data.isAnonymous).toBe(false);
    expect(next).toHaveBeenCalledOnce();
  });

  it('invalid token → guest fallback, no rejection', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid JWT' },
    } as any);
    const socket = makeSocket('bad-token');
    await authMiddleware(socket, next);
    expect(socket.data.userId).toBeNull();
    expect(socket.data.isAnonymous).toBe(true);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(); // no error — connection not rejected
  });
});
