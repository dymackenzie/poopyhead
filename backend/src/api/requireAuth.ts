import { Request, Response, NextFunction } from 'express';
import { supabaseAnon } from '../supabase/client.js';

export interface AuthRequest extends Request {
  userId: string;
  isAnonymous: boolean;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'no token' });
    return;
  }
  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: 'invalid token' });
    return;
  }
  (req as AuthRequest).userId = data.user.id;
  (req as AuthRequest).isAnonymous = data.user.is_anonymous ?? false;
  next();
}
