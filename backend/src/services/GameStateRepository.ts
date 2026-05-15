import { supabaseAdmin } from '../supabase/client.js';
import type { GameInstance } from './GameManager.js';

export async function saveGame(game: GameInstance, lobbyMode: 'live' | 'async'): Promise<void> {
  // Hoist authPlayers so we can gate both FK columns with the same set of
  // verified auth users (only non-bots with userId are safe to write to profiles FK).
  const authPlayers = game.players.filter(p => !p.isBot && p.userId);
  const authUserIds = new Set(authPlayers.map(p => p.userId!));

  const currentPlayer = game.players[game.currentPlayerIndex];
  const currentTurnUserId =
    currentPlayer?.userId && authUserIds.has(currentPlayer.userId)
      ? currentPlayer.userId
      : null;

  const loserPlayer = game.loser
    ? game.players.find(p => p.id === game.loser)
    : undefined;
  const loserUserId =
    loserPlayer?.userId && authUserIds.has(loserPlayer.userId)
      ? loserPlayer.userId
      : null;

  const { error: gameError } = await supabaseAdmin.from('games').upsert({
    id: game.id,
    lobby_code: game.lobbyCode,
    mode: lobbyMode,
    status: game.status,
    state: game,
    current_turn_user_id: currentTurnUserId,
    bomb_enabled: game.bombEnabled,
    player_count: game.players.length,
    bot_count: game.players.filter(p => p.isBot).length,
    loser_user_id: loserUserId,
    started_at: game.startedAt ?? null,
    last_action_at: new Date().toISOString(),
    ended_at: game.endedAt ?? null,
  });

  if (gameError) throw gameError;

  if (authPlayers.length === 0) return;

  // De-duplicate by user_id — the same auth user may occupy multiple player
  // slots (e.g. reconnect into a new slot while the old slot lingers as
  // wasReplaced). Postgres rejects ON CONFLICT DO UPDATE when source rows
  // collide on the conflict key, so keep exactly one row per user.
  const rowsByUserId = new Map<string, {
    game_id: string;
    user_id: string;
    player_id: string;
    was_loser: boolean | null;
  }>();
  for (const p of authPlayers) {
    const row = {
      game_id: game.id,
      user_id: p.userId!,
      player_id: p.id,
      was_loser: game.status === 'ended' ? p.id === game.loser : null,
    };
    const existing = rowsByUserId.get(row.user_id);
    if (!existing || p.wasReplaced !== true) {
      rowsByUserId.set(row.user_id, row);
    }
  }
  const rows = Array.from(rowsByUserId.values());

  const { error: playersError } = await supabaseAdmin.from('game_players').upsert(rows);
  if (playersError) throw playersError;
}

export async function loadGame(gameId: string): Promise<GameInstance | null> {
  const { data, error } = await supabaseAdmin
    .from('games')
    .select('state')
    .eq('id', gameId)
    .single();
  if (error || !data) return null;
  return data.state as GameInstance;
}

export async function listInProgressForUser(userId: string): Promise<Array<{
  id: string;
  lobby_code: string;
  status: string;
  last_action_at: string;
  current_turn_user_id: string | null;
  players: string[];
}>> {
  const { data } = await supabaseAdmin
    .from('game_players')
    .select('game_id, games!inner(id, lobby_code, status, last_action_at, current_turn_user_id, state)')
    .eq('user_id', userId)
    .neq('games.status', 'ended');
  return (data ?? []).map((r: any) => {
    const g = r.games;
    const state = g.state as GameInstance | null;
    const players = (state?.players ?? []).map((p: any) => p.username).filter(Boolean) as string[];
    return {
      id: g.id,
      lobby_code: g.lobby_code,
      status: g.status,
      last_action_at: g.last_action_at,
      current_turn_user_id: g.current_turn_user_id,
      players,
    };
  });
}

export async function deleteGame(gameId: string): Promise<void> {
  await supabaseAdmin.from('game_players').delete().eq('game_id', gameId);
  const { error } = await supabaseAdmin.from('games').delete().eq('id', gameId);
  if (error) console.error('[Cleanup] deleteGame failed', gameId, error);
}

export async function deleteStaleGames(): Promise<void> {
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  await supabaseAdmin.from('games').delete().eq('status', 'ended');
  await supabaseAdmin.from('games').delete().lt('last_action_at', twoDaysAgo);
}
