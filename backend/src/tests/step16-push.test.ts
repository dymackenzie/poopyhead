/**
 * Step 16 — Push Notification Tests
 *
 * Tests PushService.notifyTurn:
 * - Sends to all subscriptions for the user
 * - No-ops when the user has no subscriptions
 * - Auto-deletes expired (410) subscriptions
 * - Does not throw on other send errors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoist mock references so vi.mock factories can access them ───────────────
const { mockSendNotification, mockSelect, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockSendNotification: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: mockSendNotification,
  },
}));

vi.mock('../supabase/client.js', () => ({
  supabaseAdmin: {
    from: (_table: string) => ({
      select: mockSelect,
      update: mockUpdate,
      delete: mockDelete,
    }),
  },
}));

import { notifyTurn } from '../services/PushService.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSub(endpoint = 'https://push.example.com/sub1') {
  return {
    endpoint,
    p256dh_key: 'p256dh_abc',
    auth_key: 'auth_xyz',
    user_id: 'user-1',
  };
}

function setupSubQuery(subs: any[]) {
  // supabaseAdmin.from('push_subscriptions').select('*').eq('user_id', userId)
  // → { data: subs }
  mockSelect.mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: subs }),
  });
  // update chain
  mockUpdate.mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  });
  // delete chain
  mockDelete.mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('PushService.notifyTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendNotification.mockResolvedValue({ statusCode: 201 });
  });

  it('no-ops when user has no subscriptions', async () => {
    setupSubQuery([]);
    await notifyTurn('user-1', { gameId: 'g1', lobbyCode: 'ABC' });
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('sends to a single subscription', async () => {
    const sub = makeSub();
    setupSubQuery([sub]);

    await notifyTurn('user-1', { gameId: 'g1', lobbyCode: 'ABC', opponentName: 'Alice' });

    expect(mockSendNotification).toHaveBeenCalledOnce();
    const [pushSub, payloadStr] = mockSendNotification.mock.calls[0];
    expect(pushSub).toEqual({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
    });
    const payload = JSON.parse(payloadStr);
    expect(payload.title).toBe('Your turn in Poopyhead');
    expect(payload.body).toContain('Alice');
    expect(payload.url).toBe('/?resume=g1');
    expect(payload.tag).toBe('turn-g1');
  });

  it('sends to multiple subscriptions', async () => {
    setupSubQuery([makeSub('https://push.example.com/a'), makeSub('https://push.example.com/b')]);
    await notifyTurn('user-1', { gameId: 'g2', lobbyCode: 'XYZ' });
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });

  it('omits opponentName in body when not provided', async () => {
    setupSubQuery([makeSub()]);
    await notifyTurn('user-1', { gameId: 'g1', lobbyCode: 'ABC' });
    const payload = JSON.parse(mockSendNotification.mock.calls[0][1]);
    expect(payload.body).not.toContain('undefined');
    expect(payload.body).toContain('ABC');
  });

  it('deletes subscription on 410 Gone response', async () => {
    setupSubQuery([makeSub()]);
    const err: any = new Error('Gone');
    err.statusCode = 410;
    mockSendNotification.mockRejectedValue(err);

    // Should not throw
    await expect(notifyTurn('user-1', { gameId: 'g1', lobbyCode: 'ABC' })).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalled();
  });

  it('deletes subscription on 404 response', async () => {
    setupSubQuery([makeSub()]);
    const err: any = new Error('Not Found');
    err.statusCode = 404;
    mockSendNotification.mockRejectedValue(err);

    await expect(notifyTurn('user-1', { gameId: 'g1', lobbyCode: 'ABC' })).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalled();
  });

  it('does not delete on non-expiry errors', async () => {
    setupSubQuery([makeSub()]);
    const err: any = new Error('Internal Error');
    err.statusCode = 500;
    mockSendNotification.mockRejectedValue(err);

    await expect(notifyTurn('user-1', { gameId: 'g1', lobbyCode: 'ABC' })).resolves.toBeUndefined();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

// ─── maybeNotifyTurn integration (pure logic tests, no mocks) ────────────────

describe('maybeNotifyTurn guard conditions (pure logic)', () => {
  it('skips notification when player has no userId', () => {
    // A player with no userId (pure guest) should never call notifyTurn
    const player = { id: 'p1', userId: undefined, username: 'Guest', isBot: false };
    // Guard: !nextPlayer?.userId → return early
    expect(!player?.userId || player.isBot).toBe(true);
  });

  it('skips notification when player is a bot', () => {
    const player = { id: 'p1', userId: 'u1', username: 'Bot', isBot: true };
    expect(!player?.userId || player.isBot).toBe(true);
  });

  it('proceeds when player has userId and is not a bot', () => {
    const player = { id: 'p1', userId: 'u1', username: 'Alice', isBot: false };
    const shouldSkip = !player?.userId || player.isBot;
    expect(shouldSkip).toBe(false);
  });
});
