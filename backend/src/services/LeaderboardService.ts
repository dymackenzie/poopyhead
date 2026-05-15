import { supabaseAdmin } from '../supabase/client.js';

export interface LeaderboardRow {
  userId: string;
  displayName: string;
  isAnonymous: boolean;
  avatar?: string | null;
  gamesPlayed: number;
  wins: number;
  poopyheadCount: number;
  currentStreak: number;
  bestStreak: number;
  isSelf: boolean;
}

export async function getLeaderboardFor(userId: string): Promise<LeaderboardRow[]> {
  const { data, error } = await supabaseAdmin
    .rpc('get_played_with_leaderboard', { p_user_id: userId });
  if (error) {
    console.error('[Leaderboard] rpc failed', error);
    return [];
  }
  // NOTE: requires get_played_with_leaderboard RPC to return an `avatar` text column
  // joined from public.profiles.avatar. Update the SQL function in Supabase dashboard if missing.
  return (data ?? []).map((r: any) => ({
    userId: r.user_id,
    displayName: r.display_name,
    isAnonymous: r.is_anonymous,
    avatar: r.avatar ?? null,
    gamesPlayed: r.games_played,
    wins: r.wins,
    poopyheadCount: r.poopyhead_count,
    currentStreak: r.current_streak,
    bestStreak: r.best_streak,
    isSelf: r.is_self,
  }));
}

export async function hideOpponent(userId: string, hiddenUserId: string): Promise<void> {
  if (userId === hiddenUserId) throw new Error('CANNOT_HIDE_SELF');
  const { error } = await supabaseAdmin
    .from('hidden_opponents')
    .upsert({ user_id: userId, hidden_user_id: hiddenUserId });
  if (error) throw error;
}

export async function unhideOpponent(userId: string, hiddenUserId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('hidden_opponents')
    .delete()
    .eq('user_id', userId)
    .eq('hidden_user_id', hiddenUserId);
  if (error) throw error;
}
