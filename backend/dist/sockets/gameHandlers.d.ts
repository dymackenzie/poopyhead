/**
 * Socket.io Event Handlers
 *
 * Handles all real-time communication:
 * - Lobby creation/joining
 * - Game start
 * - Card plays
 * - State broadcasts
 */
import { Server } from 'socket.io';
import { Lobby } from '../services/LobbyManager.js';
import { GameInstance } from '../services/GameManager.js';
export interface PoopyheadNamespace {
    lobbies: Map<string, Lobby>;
    games: Map<string, GameInstance>;
    playerToSocket: Map<string, string>;
    socketToPlayer: Map<string, string>;
}
/**
 * Creates and registers socket event handlers.
 */
export declare function setupSocketHandlers(io: Server, ns: PoopyheadNamespace): void;
//# sourceMappingURL=gameHandlers.d.ts.map