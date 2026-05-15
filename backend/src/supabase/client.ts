import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// Node 20 has no native WebSocket; pass the ws package to Supabase's realtime client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const realtimeOpts = { transport: ws } as any;

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false }, realtime: realtimeOpts }
);

export const supabaseAnon = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  { auth: { persistSession: false }, realtime: realtimeOpts }
);
