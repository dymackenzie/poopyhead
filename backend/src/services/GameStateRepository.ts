import { supabaseAdmin } from '../supabase/client.js';
import type { GameInstance } from './GameManager.js';

export async function saveGame(game: GameInstance, lobbyMode: 'live' | 'async'): Promise<void> {
  const currentPlayer = game.players[game.currentPlayerIndex];
  const currentTurnUserId = currentPlayer?.userId ?? null;

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
    loser_user_id: game.loser
      ? game.players.find(p => p.id === game.loser)?.userId ?? null
      : null,
    started_at: game.startedAt ?? null,
    last_action_at: new Date().toISOString(),
    ended_at: game.endedAt ?? null,
  });

  if (gameError) throw gameError;

  const authPlayers = game.players.filter(p => !p.isBot && p.userId);
  if (authPlayers.length === 0) return;

  const rows = authPlayers.map(p => ({
    game_id: game.id,
    user_id: p.userId!,
    player_id: p.id,
    was_loser: game.status === 'ended' ? p.id === game.loser : null,
  }));

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
}>> {
  const { data } = await supabaseAdmin
    .from('game_players')
    .select('game_id, games!inner(id, lobby_code, status, last_action_at, current_turn_user_id)')
    .eq('user_id', userId)
    .neq('games.status', 'ended');
  return (data ?? []).map((r: any) => r.games);
}
