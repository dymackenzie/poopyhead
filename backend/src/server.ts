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
import { setupSocketHandlers, PoopyheadNamespace } from './sockets/gameHandlers';
import { supabaseAdmin } from './supabase/client';
import { authMiddleware } from './sockets/authMiddleware';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*', // TODO: Restrict in production
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Global namespace for game state management
const gameNamespace: PoopyheadNamespace = {
  lobbies: new Map(),
  games: new Map(),
  playerToSocket: new Map(),
  socketToPlayer: new Map(),
  sessions: new Map(),
  pendingBotTakeovers: new Map(),
};

// API Routes (for future use)
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

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Poopyhead server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
