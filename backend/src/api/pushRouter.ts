import { Router } from 'express';
import { requireAuth, AuthRequest } from './requireAuth.js';
import { supabaseAdmin } from '../supabase/client.js';

const router = Router();

router.post('/api/push/subscribe', requireAuth, async (req, res) => {
  try {
    const { endpoint, keys, deviceLabel } = req.body as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
      deviceLabel?: string;
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      res.status(400).json({ error: 'missing endpoint or keys' });
      return;
    }

    const { error } = await supabaseAdmin.from('push_subscriptions').upsert({
      user_id: (req as AuthRequest).userId,
      endpoint,
      p256dh_key: keys.p256dh,
      auth_key: keys.auth,
      device_label: deviceLabel ?? null,
    });

    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    console.error('[Push] subscribe failed', e);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

export default router;
