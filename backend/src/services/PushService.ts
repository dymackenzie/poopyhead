import webpush from 'web-push';
import { supabaseAdmin } from '../supabase/client.js';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function notifyTurn(
  userId: string,
  opts: { gameId: string; lobbyCode: string; opponentName?: string }
): Promise<void> {
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({
    title: 'Your turn in Poopyhead',
    body: opts.opponentName
      ? `${opts.opponentName} just played. Your move in lobby ${opts.lobbyCode}.`
      : `Your move in lobby ${opts.lobbyCode}.`,
    url: `/?resume=${opts.gameId}`,
    tag: `turn-${opts.gameId}`,
  });

  await Promise.all(
    subs.map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
          payload
        );
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('endpoint', sub.endpoint);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .eq('endpoint', sub.endpoint);
        } else {
          console.error('[Push] send failed', err);
        }
      }
    })
  );
}
