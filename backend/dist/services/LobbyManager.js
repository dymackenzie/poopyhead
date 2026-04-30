/**
 * Lobby Manager Service
 *
 * Manages lobby creation, joining, and player readiness.
 * Lobbies are temporary containers for games; they persist across rematch.
 */
import { v4 as uuid } from 'uuid';
/**
 * Generates a 6-character alphanumeric lobby code.
 * Used for easy sharing (e.g., "ABC123").
 */
export function generateLobbyCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
/**
 * Creates a new lobby.
 */
export function createLobby(createdBy, username, isGuest, socketId, settings) {
    const playerId = uuid();
    return {
        id: uuid(),
        code: generateLobbyCode(),
        createdBy,
        createdAt: new Date(),
        players: [
            {
                id: playerId,
                userId: isGuest ? undefined : createdBy,
                username,
                isGuest,
                joinedAt: new Date(),
                ready: false,
                socketId,
            },
        ],
        status: 'waiting',
        settings,
        maxPlayers: 10,
    };
}
export function addPlayerToLobby(input) {
    if (input.lobby.status !== 'waiting') {
        return {
            success: false,
            reason: 'LOBBY_NOT_ACCEPTING_PLAYERS',
        };
    }
    if (input.lobby.players.length >= input.lobby.maxPlayers) {
        return {
            success: false,
            reason: 'LOBBY_FULL',
        };
    }
    if (input.lobby.players.some(p => p.username === input.username && !input.isGuest)) {
        return {
            success: false,
            reason: 'USERNAME_TAKEN',
        };
    }
    const playerId = uuid();
    const updatedLobby = {
        ...input.lobby,
        players: [
            ...input.lobby.players,
            {
                id: playerId,
                userId: input.isGuest ? undefined : input.userId,
                username: input.username,
                isGuest: input.isGuest,
                joinedAt: new Date(),
                ready: false,
                socketId: input.socketId,
            },
        ],
    };
    return {
        success: true,
        playerId,
        updatedLobby,
    };
}
/**
 * Marks player as ready in lobby.
 */
export function setPlayerReady(lobby, playerId, ready) {
    return {
        ...lobby,
        players: lobby.players.map(p => p.id === playerId ? { ...p, ready } : p),
    };
}
/**
 * Checks if all players are ready to start game.
 */
export function canStartGame(lobby) {
    return (lobby.players.length >= 2 &&
        lobby.players.every(p => p.ready));
}
/**
 * Removes player from lobby.
 */
export function removePlayerFromLobby(lobby, playerId) {
    const updatedPlayers = lobby.players.filter(p => p.id !== playerId);
    // If creator left, reassign to next player or end lobby
    let newCreatedBy = lobby.createdBy;
    if (lobby.createdBy === updatedPlayers.find(p => p.id)?.userId) {
        newCreatedBy = updatedPlayers[0]?.userId || 'system';
    }
    return {
        ...lobby,
        createdBy: newCreatedBy,
        players: updatedPlayers,
    };
}
/**
 * Checks if lobby is empty (all players left).
 */
export function isLobbyEmpty(lobby) {
    return lobby.players.length === 0;
}
/**
 * Updates lobby status.
 */
export function updateLobbyStatus(lobby, status, gameId) {
    return {
        ...lobby,
        status,
        currentGameId: gameId || lobby.currentGameId,
    };
}
//# sourceMappingURL=LobbyManager.js.map