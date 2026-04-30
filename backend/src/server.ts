/**
 * Poopyhead Backend Server
 * 
 * Express.js with Socket.io for real-time multiplayer card game.
 * 
 * Environment variables:
 * - PORT: Server port (default 3001)
 * - NODE_ENV: 'development' or 'production'
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { setupSocketHandlers, PoopyheadNamespace } from './sockets/gameHandlers';

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
};

// API Routes (for future use)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/stats', (req, res) => {
  res.json({
    lobbies: gameNamespace.lobbies.size,
    games: gameNamespace.games.size,
    connectedPlayers: gameNamespace.playerToSocket.size,
  });
});

// Socket.io event handlers
setupSocketHandlers(io, gameNamespace);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🎮 Poopyhead server listening on port ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
