/**
 * Poopyhead Backend Server
 * 
 * Express.js with Socket.io for real-time multiplayer card game.
 * 
 * Environment variables:
 * - PORT: Server port (default 3001)
 * - NODE_ENV: 'development' or 'production'
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { join } from 'path';
import { setupSocketHandlers, PoopyheadNamespace } from './sockets/gameHandlers';
import { supabaseAdmin } from './supabase/client';
import { deleteStaleGames } from './services/GameStateRepository';
import { authMiddleware } from './sockets/authMiddleware';
import gamesRouter from './api/gamesRouter';
import pushRouter from './api/pushRouter';
import leaderboardRouter from './api/leaderboardRouter';
const FRONTEND_DIST = join(__dirname, '../../frontend/dist');

const app = express();
const httpServer = createServer(app);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Global namespace for game state management
const gameNamespace: PoopyheadNamespace = {
  lobbies: new Map(),
  games: new Map(),
  playerToSocket: new Map(),
  socketToPlayer: new Map(),
  sessions: new Map(),
  pendingBotTakeovers: new Map(),
  pendingAITurns: new Map(),
};

// API Routes
app.use(gamesRouter);
app.use(pushRouter);
app.use(leaderboardRouter);

app.get('/health', async (req, res) => {
  let db: 'ok' | 'error' = 'error';
  try {
    const { error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    if (error) console.error('[Health] DB ping error:', error);
    if (!error) db = 'ok';
  } catch (e) {
    console.error('[Health] DB ping threw:', e);
    db = 'error';
  }
  res.json({ status: 'ok', timestamp: new Date().toISOString(), db });
});

app.get('/stats', (req, res) => {
  res.json({
    lobbies: gameNamespace.lobbies.size,
    games: gameNamespace.games.size,
    connectedPlayers: gameNamespace.playerToSocket.size,
  });
});

// Socket.io event handlers
io.use(authMiddleware);
setupSocketHandlers(io, gameNamespace);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (_req, res) => res.sendFile(join(FRONTEND_DIST, 'index.html')));
}

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

httpServer.listen(PORT, () => {
  console.log(`Poopyhead server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  deleteStaleGames().catch(e => console.error('[Cleanup] startup sweep failed', e));
  cleanupInterval = setInterval(() => {
    deleteStaleGames().catch(e => console.error('[Cleanup] periodic sweep failed', e));
  }, 60 * 60 * 1000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  if (cleanupInterval) clearInterval(cleanupInterval);
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
