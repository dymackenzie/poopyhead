import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Runs once at module load — shared across all React renders/remounts
export const authReady: Promise<void> = (async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) await supabase.auth.signInAnonymously();
})();
