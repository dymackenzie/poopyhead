/**
 * Step 17 — Leaderboard Tests
 *
 * Tests LeaderboardService:
 * - getLeaderboardFor maps RPC rows → LeaderboardRow
 * - Returns empty array when RPC errors
 * - hideOpponent upserts a hidden_opponents row
 * - hideOpponent throws CANNOT_HIDE_SELF for self-hide
 * - unhideOpponent deletes the row
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoist mock references ────────────────────────────────────────────────────
const { mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('../supabase/client.js', () => ({
  supabaseAdmin: {
    rpc: mockRpc,
    from: mockFrom,
  },
}));

import {
  getLeaderboardFor,
  hideOpponent,
  unhideOpponent,
} from '../services/LeaderboardService.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRpcRow(overrides: Partial<Record<string, any>> = {}) {
  return {
    user_id: 'u1',
    display_name: 'Alice',
    is_anonymous: false,
    games_played: 5,
    wins: 3,
    poopyhead_count: 2,
    current_streak: 1,
    best_streak: 3,
    is_self: false,
    ...overrides,
  };
}

function buildChain(result: { data?: any; error?: any }) {
  const chain: any = {
    eq: (..._args: any[]) => chain,
    upsert: vi.fn().mockResolvedValue(result),
    delete: (..._args: any[]) => chain,
  };
  chain.delete = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(result),
    }),
  });
  chain.upsert = vi.fn().mockResolvedValue(result);
  return chain;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('LeaderboardService.getLeaderboardFor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps RPC rows to LeaderboardRow shape', async () => {
    const row = makeRpcRow({ user_id: 'abc', display_name: 'Bob', is_self: true });
    mockRpc.mockResolvedValue({ data: [row], error: null });

    const result = await getLeaderboardFor('abc');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      userId: 'abc',
      displayName: 'Bob',
      isAnonymous: false,
      gamesPlayed: 5,
      wins: 3,
      poopyheadCount: 2,
      currentStreak: 1,
      bestStreak: 3,
      isSelf: true,
    });
  });

  it('maps multiple rows preserving isSelf flag', async () => {
    mockRpc.mockResolvedValue({
      data: [
        makeRpcRow({ user_id: 'u1', is_self: true }),
        makeRpcRow({ user_id: 'u2', is_self: false }),
      ],
      error: null,
    });
    const result = await getLeaderboardFor('u1');
    expect(result).toHaveLength(2);
    expect(result[0].isSelf).toBe(true);
    expect(result[1].isSelf).toBe(false);
  });

  it('returns empty array when RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'function not found' } });
    const result = await getLeaderboardFor('u1');
    expect(result).toEqual([]);
  });

  it('returns empty array when data is null', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const result = await getLeaderboardFor('u1');
    expect(result).toEqual([]);
  });

  it('calls RPC with correct function name and param', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    await getLeaderboardFor('user-xyz');
    expect(mockRpc).toHaveBeenCalledWith('get_played_with_leaderboard', { p_user_id: 'user-xyz' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('LeaderboardService.hideOpponent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws CANNOT_HIDE_SELF when userId === hiddenUserId', async () => {
    await expect(hideOpponent('u1', 'u1')).rejects.toThrow('CANNOT_HIDE_SELF');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('calls upsert on hidden_opponents table', async () => {
    const chain = buildChain({ error: null });
    mockFrom.mockReturnValue(chain);

    await hideOpponent('u1', 'u2');

    expect(mockFrom).toHaveBeenCalledWith('hidden_opponents');
    expect(chain.upsert).toHaveBeenCalledWith({ user_id: 'u1', hidden_user_id: 'u2' });
  });

  it('throws when supabase returns an error', async () => {
    const chain = buildChain({ error: { message: 'DB error' } });
    mockFrom.mockReturnValue(chain);

    await expect(hideOpponent('u1', 'u2')).rejects.toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('LeaderboardService.unhideOpponent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls delete with matching eq chain', async () => {
    const innerEq = vi.fn().mockResolvedValue({ error: null });
    const outerEq = vi.fn().mockReturnValue({ eq: innerEq });
    const deleteFn = vi.fn().mockReturnValue({ eq: outerEq });
    mockFrom.mockReturnValue({ delete: deleteFn });

    await unhideOpponent('u1', 'u2');

    expect(mockFrom).toHaveBeenCalledWith('hidden_opponents');
    expect(deleteFn).toHaveBeenCalled();
    expect(outerEq).toHaveBeenCalledWith('user_id', 'u1');
    expect(innerEq).toHaveBeenCalledWith('hidden_user_id', 'u2');
  });

  it('throws when supabase returns an error', async () => {
    const innerEq = vi.fn().mockResolvedValue({ error: { message: 'DB error' } });
    const outerEq = vi.fn().mockReturnValue({ eq: innerEq });
    mockFrom.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: outerEq }) });

    await expect(unhideOpponent('u1', 'u2')).rejects.toBeTruthy();
  });
});
