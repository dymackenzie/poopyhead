/**
 * Shared namespace type for the Poopyhead Socket.io server state.
 * Extracted here to avoid circular imports between handler modules.
 */

import { Lobby } from '../services/LobbyManager.js';
import { GameInstance } from '../services/GameManager.js';

export interface PoopyheadNamespace {
  lobbies: Map<string, Lobby>;
  games: Map<string, GameInstance>;
  playerToSocket: Map<string, string>; // playerId -> socketId
  socketToPlayer: Map<string, string>; // socketId -> playerId
  sessions: Map<string, string>; // sessionId -> playerId
  pendingBotTakeovers: Map<string, ReturnType<typeof setTimeout>>; // playerId -> timeout
  pendingAITurns: Map<string, ReturnType<typeof setTimeout>>; // gameId -> timeout
}
