/**
 * Lobby Manager Service
 *
 * Manages lobby creation, joining, and player readiness.
 * Lobbies are temporary containers for games; they persist across rematch.
 */
export interface Lobby {
    id: string;
    code: string;
    createdBy: string;
    createdAt: Date;
    players: LobbyPlayer[];
    status: 'waiting' | 'ready' | 'playing' | 'ended';
    currentGameId?: string;
    settings: {
        bombEnabled: boolean;
        turnTimerSeconds: number;
    };
    maxPlayers: number;
}
export interface LobbyPlayer {
    id: string;
    userId?: string;
    username: string;
    isGuest: boolean;
    joinedAt: Date;
    ready: boolean;
    socketId: string;
}
/**
 * Generates a 6-character alphanumeric lobby code.
 * Used for easy sharing (e.g., "ABC123").
 */
export declare function generateLobbyCode(): string;
/**
 * Creates a new lobby.
 */
export declare function createLobby(createdBy: string, username: string, isGuest: boolean, socketId: string, settings: {
    bombEnabled: boolean;
    turnTimerSeconds: number;
}): Lobby;
/**
 * Adds player to existing lobby.
 */
export interface AddPlayerInput {
    lobby: Lobby;
    userId?: string;
    username: string;
    isGuest: boolean;
    socketId: string;
}
export interface AddPlayerOutput {
    success: boolean;
    reason?: string;
    playerId?: string;
    updatedLobby?: Lobby;
}
export declare function addPlayerToLobby(input: AddPlayerInput): AddPlayerOutput;
/**
 * Marks player as ready in lobby.
 */
export declare function setPlayerReady(lobby: Lobby, playerId: string, ready: boolean): Lobby;
/**
 * Checks if all players are ready to start game.
 */
export declare function canStartGame(lobby: Lobby): boolean;
/**
 * Removes player from lobby.
 */
export declare function removePlayerFromLobby(lobby: Lobby, playerId: string): Lobby;
/**
 * Checks if lobby is empty (all players left).
 */
export declare function isLobbyEmpty(lobby: Lobby): boolean;
/**
 * Updates lobby status.
 */
export declare function updateLobbyStatus(lobby: Lobby, status: 'waiting' | 'ready' | 'playing' | 'ended', gameId?: string): Lobby;
//# sourceMappingURL=LobbyManager.d.ts.map