import { Router } from 'express';
import { requireAuth, AuthRequest } from './requireAuth.js';
import { getLeaderboardFor, hideOpponent, unhideOpponent } from '../services/LeaderboardService.js';

const router = Router();

router.get('/api/leaderboard', requireAuth, async (req, res) => {
  try {
    const rows = await getLeaderboardFor((req as AuthRequest).userId);
    res.json({ leaderboard: rows });
  } catch (e) {
    console.error('[Leaderboard] GET failed', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/leaderboard/hide', requireAuth, async (req, res) => {
  const { userId: hiddenUserId } = req.body;
  if (!hiddenUserId || typeof hiddenUserId !== 'string') {
    res.status(400).json({ error: 'userId required' });
    return;
  }
  try {
    await hideOpponent((req as AuthRequest).userId, hiddenUserId);
    res.json({ success: true });
  } catch (e: any) {
    if (e?.message === 'CANNOT_HIDE_SELF') {
      res.status(400).json({ error: 'CANNOT_HIDE_SELF' });
    } else {
      console.error('[Leaderboard] hide failed', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

router.delete('/api/leaderboard/hide/:userId', requireAuth, async (req, res) => {
  const hiddenUserId = req.params.userId;
  try {
    await unhideOpponent((req as AuthRequest).userId, hiddenUserId);
    res.json({ success: true });
  } catch (e) {
    console.error('[Leaderboard] unhide failed', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
