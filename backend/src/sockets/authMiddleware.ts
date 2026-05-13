import type { Socket } from 'socket.io';
import { supabaseAnon } from '../supabase/client.js';

export async function authMiddleware(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    socket.data.userId = null;
    socket.data.isAnonymous = true;
    return next();
  }
  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) {
    socket.data.userId = null;
    socket.data.isAnonymous = true;
    return next(); // invalid token falls back to guest — don't reject the connection
  }
  socket.data.userId = data.user.id;
  socket.data.isAnonymous = data.user.is_anonymous ?? false;
  next();
}
