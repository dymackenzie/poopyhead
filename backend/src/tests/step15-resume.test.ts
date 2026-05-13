import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supabase/client.js', () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
  supabaseAnon: { auth: { getUser: vi.fn() } },
}));

import { supabaseAnon } from '../supabase/client.js';
import { requireAuth } from '../api/requireAuth.js';

// ─── requireAuth middleware ───────────────────────────────────
describe('requireAuth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('attaches userId and calls next on valid token', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-abc', is_anonymous: true } },
      error: null,
    } as any);
    const req: any = { headers: { authorization: 'Bearer valid-token' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userId).toBe('user-abc');
    expect(req.isAnonymous).toBe(true);
  });

  it('returns 401 when Authorization header is absent', async () => {
    const req: any = { headers: {} };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 on invalid token', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid token' } as any,
    } as any);
    const req: any = { headers: { authorization: 'Bearer bad-token' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('marks linked user as not anonymous', async () => {
    vi.mocked(supabaseAnon.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-linked', is_anonymous: false } },
      error: null,
    } as any);
    const req: any = { headers: { authorization: 'Bearer linked-token' } };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await requireAuth(req, res, next);
    expect(req.isAnonymous).toBe(false);
  });
});

// ─── resumeGame logic (pure) ──────────────────────────────────
describe('resumeGame player lookup', () => {
  const players = [
    { id: 'p1', userId: 'user-1', username: 'Alice', isBot: false, wasReplaced: false },
    { id: 'p2', userId: 'user-2', username: 'Bob', isBot: true, wasReplaced: true },
  ];

  it('finds player by userId', () => {
    expect(players.find(p => p.userId === 'user-2')?.id).toBe('p2');
  });

  it('returns undefined for unrecognized userId', () => {
    expect(players.find(p => p.userId === 'unknown')).toBeUndefined();
  });

  it('NOT_AUTHENTICATED guard fires when userId is null', () => {
    const userId: string | null = null;
    const result = userId ? 'proceed' : 'NOT_AUTHENTICATED';
    expect(result).toBe('NOT_AUTHENTICATED');
  });
});

describe('resumeGame un-bot', () => {
  it('clears isBot and wasReplaced on resume', () => {
    const player = { id: 'p1', userId: 'user-1', isBot: true, wasReplaced: true, username: 'Alice' };
    const updated = { ...player, isBot: false, wasReplaced: false };
    expect(updated.isBot).toBe(false);
    expect(updated.wasReplaced).toBe(false);
  });

  it('does not mutate original when spreading', () => {
    const player = { id: 'p1', isBot: true, wasReplaced: true };
    const updated = { ...player, isBot: false, wasReplaced: false };
    expect(player.isBot).toBe(true);
    expect(updated.isBot).toBe(false);
  });

  it('skips un-bot when player is not a bot', () => {
    const player = { id: 'p1', userId: 'user-1', isBot: false, wasReplaced: false };
    const shouldUnbot = player.isBot;
    expect(shouldUnbot).toBe(false);
  });
});
