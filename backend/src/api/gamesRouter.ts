import { Router } from 'express';
import { requireAuth, AuthRequest } from './requireAuth.js';
import { listInProgressForUser } from '../services/GameStateRepository.js';

const router = Router();

router.get('/api/games/active', requireAuth, async (req, res) => {
  try {
    const games = await listInProgressForUser((req as AuthRequest).userId);
    res.json({ games });
  } catch (e) {
    console.error('[Games] Failed to fetch active games', e);
    res.status(500).json({ error: 'Failed to fetch active games' });
  }
});

export default router;
