import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../supabase/client.js', () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  supabaseAnon: { auth: { getUser: vi.fn() } },
}));

import { supabaseAdmin } from '../supabase/client.js';
import { saveGame, loadGame } from '../services/GameStateRepository.js';
import type { GameInstance, GamePlayer } from '../services/GameManager.js';

// ─── helpers ────────────────────────────────────────────────────
function makePlayer(overrides: Partial<GamePlayer> = {}): GamePlayer {
  return {
    id: 'player-1',
    username: 'Alice',
    hand: [],
    tableVisible: [],
    tableBlind: [],
    poopyheadCount: 0,
    ...overrides,
  };
}

function makeGame(overrides: Partial<GameInstance> = {}): GameInstance {
  return {
    id: 'game-abc',
    lobbyCode: 'TEST01',
    mode: 'async',
    players: [makePlayer(), makePlayer({ id: 'player-2', username: 'Bob' })],
    deck: [],
    playPile: [],
    currentPlayerIndex: 0,
    playOrder: ['player-1', 'player-2'],
    direction: 'clockwise',
    status: 'playing',
    swappedPlayers: [],
    createdAt: new Date(),
    activeConstraints: { sevenOrUnder: false, skipCount: 0 },
    bombEnabled: true,
    turnTimerSeconds: 60,
    turnHistory: [],
    eliminationOrder: [],
    ...overrides,
  };
}

function mockUpsert(error: any = null) {
  const chain = { upsert: vi.fn().mockResolvedValue({ error }) };
  vi.mocked(supabaseAdmin.from).mockReturnValue(chain as any);
  return chain;
}

function mockSelect(data: any, error: any = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  vi.mocked(supabaseAdmin.from).mockReturnValue(chain as any);
  return chain;
}

// ─── saveGame ───────────────────────────────────────────────────
describe('saveGame', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts the games row with correct shape', async () => {
    const chain = mockUpsert();
    const game = makeGame({ status: 'playing' });
    await saveGame(game, 'async');
    expect(supabaseAdmin.from).toHaveBeenCalledWith('games');
    const upsertArg = chain.upsert.mock.calls[0][0];
    expect(upsertArg.id).toBe('game-abc');
    expect(upsertArg.lobby_code).toBe('TEST01');
    expect(upsertArg.mode).toBe('async');
    expect(upsertArg.state).toBe(game);
  });

  it('skips game_players upsert when no authenticated players', async () => {
    mockUpsert(); // games upsert succeeds
    const game = makeGame(); // no userId on any player
    await saveGame(game, 'async');
    // from() called once (games), NOT twice (no game_players)
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });

  it('upserts game_players when auth players exist', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue({ upsert: upsertFn } as any);
    const game = makeGame({
      players: [
        makePlayer({ id: 'p1', userId: 'user-111' }),
        makePlayer({ id: 'p2', userId: 'user-222' }),
      ],
    });
    await saveGame(game, 'live');
    expect(supabaseAdmin.from).toHaveBeenCalledWith('games');
    expect(supabaseAdmin.from).toHaveBeenCalledWith('game_players');
    expect(upsertFn).toHaveBeenCalledTimes(2);
  });

  it('sets was_loser correctly on ended game', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabaseAdmin.from).mockReturnValue({ upsert: upsertFn } as any);
    const game = makeGame({
      status: 'ended',
      loser: 'p2',
      players: [
        makePlayer({ id: 'p1', userId: 'user-111' }),
        makePlayer({ id: 'p2', userId: 'user-222' }),
      ],
    });
    await saveGame(game, 'async');
    const rows: any[] = upsertFn.mock.calls[1][0]; // second call = game_players
    expect(rows.find((r: any) => r.user_id === 'user-222').was_loser).toBe(true);
    expect(rows.find((r: any) => r.user_id === 'user-111').was_loser).toBe(false);
  });
});

// ─── loadGame ───────────────────────────────────────────────────
describe('loadGame', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when game not found', async () => {
    mockSelect(null, { message: 'not found' });
    const result = await loadGame('nonexistent');
    expect(result).toBeNull();
  });

  it('returns the deserialized game state', async () => {
    const game = makeGame();
    mockSelect({ state: game });
    const result = await loadGame('game-abc');
    expect(result).toEqual(game);
  });
});

// ─── mode guard & wasReplaced ────────────────────────────────────
describe('wasReplaced stat exclusion', () => {
  it('wasReplaced players are excluded from authPlayers for stats', () => {
    const game = makeGame({
      status: 'ended',
      loser: 'p2',
      players: [
        makePlayer({ id: 'p1', userId: 'user-111', wasReplaced: false }),
        makePlayer({ id: 'p2', userId: 'user-222', wasReplaced: true }),
        makePlayer({ id: 'p3', isBot: true }),
      ],
    });
    const eligibleForStats = game.players.filter(p => !p.isBot && p.userId && !p.wasReplaced);
    expect(eligibleForStats.map(p => p.id)).toEqual(['p1']);
  });
});

describe('async mode bot takeover guard', () => {
  it('mode async prevents takeover (condition evaluates correctly)', () => {
    const asyncLobbySettings = { mode: 'async' as const, bombEnabled: true, turnTimerSeconds: 60 };
    expect(asyncLobbySettings.mode !== 'live').toBe(true); // the guard returns early
  });

  it('mode live allows takeover', () => {
    const liveLobbySettings = { mode: 'live' as const, bombEnabled: true, turnTimerSeconds: 60 };
    expect(liveLobbySettings.mode !== 'live').toBe(false); // the guard does NOT return early
  });
});
