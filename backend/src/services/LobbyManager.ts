/**
 * Lobby Manager Service
 * 
 * Manages lobby creation, joining, and player readiness.
 * Lobbies are temporary containers for games; they persist across rematch.
 */

import { v4 as uuid } from 'uuid';
import { pickAIName } from './AIPlayerService.js';

export interface Lobby {
  id: string;
  code: string;                    // 6-char alphanumeric code
  createdBy: string;               // User ID or guest name
  createdAt: Date;
  players: LobbyPlayer[];
  status: 'waiting' | 'ready' | 'playing' | 'ended';
  currentGameId?: string;
  settings: {
    bombEnabled: boolean;
    turnTimerSeconds: number;
    mode: 'live' | 'async';
  };
  maxPlayers: number;
}

export interface LobbyPlayer {
  id: string;
  userId?: string;
  username: string;
  isGuest: boolean;
  isBot?: boolean;
  avatar?: string;
  joinedAt: Date;
  ready: boolean;
  socketId: string;
}

/**
 * Generates a 6-character alphanumeric lobby code.
 * Used for easy sharing (e.g., "ABC123").
 */
export function generateLobbyCode(): string {
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
export function createLobby(
  createdBy: string,
  username: string,
  isGuest: boolean,
  socketId: string,
  settings: { bombEnabled: boolean; turnTimerSeconds: number; mode?: 'live' | 'async' },
  avatar?: string
): Lobby {
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
        avatar,
        joinedAt: new Date(),
        ready: false,
        socketId,
      },
    ],
    status: 'waiting',
    settings: { ...settings, mode: settings.mode ?? 'async' },
    maxPlayers: 5,
  };
}

/**
 * Adds player to existing lobby.
 */
export interface AddPlayerInput {
  lobby: Lobby;
  userId?: string;
  username: string;
  isGuest: boolean;
  socketId: string;
  avatar?: string;
}

export interface AddPlayerOutput {
  success: boolean;
  reason?: string;
  playerId?: string;
  updatedLobby?: Lobby;
}

export function addPlayerToLobby(input: AddPlayerInput): AddPlayerOutput {
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
        avatar: input.avatar,
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
export function setPlayerReady(lobby: Lobby, playerId: string, ready: boolean): Lobby {
  return {
    ...lobby,
    players: lobby.players.map(p =>
      p.id === playerId ? { ...p, ready } : p
    ),
  };
}

/**
 * Checks if all players are ready to start game.
 */
export function canStartGame(lobby: Lobby): boolean {
  return (
    lobby.players.length >= 2 &&
    lobby.players.every(p => p.ready)
  );
}

/**
 * Removes player from lobby.
 */
export function removePlayerFromLobby(lobby: Lobby, playerId: string): Lobby {
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
export function isLobbyEmpty(lobby: Lobby): boolean {
  return lobby.players.length === 0;
}

/**
 * Updates lobby status.
 */
export function updateLobbyStatus(
  lobby: Lobby,
  status: 'waiting' | 'ready' | 'playing' | 'ended',
  gameId?: string
): Lobby {
  return {
    ...lobby,
    status,
    currentGameId: gameId || lobby.currentGameId,
  };
}

/**
 * Adds bot players to a lobby. Bots are pre-readied with generated names.
 */
export function addBotsToLobby(lobby: Lobby, count: number): Lobby {
  const usedNames = lobby.players.map(p => p.username);
  const newBots: LobbyPlayer[] = [];

  for (let i = 0; i < count; i++) {
    if (lobby.players.length + newBots.length >= lobby.maxPlayers) break;
    const name = pickAIName([...usedNames, ...newBots.map(b => b.username)]);
    newBots.push({
      id: uuid(),
      username: name,
      isGuest: true,
      isBot: true,
      joinedAt: new Date(),
      ready: true,
      socketId: `bot_${uuid()}`,
    });
  }

  return { ...lobby, players: [...lobby.players, ...newBots] };
}

/**
 * Reset lobby for rematch (same players, new game).
 */
export function resetLobbyForRematch(lobby: Lobby): Lobby {
  return {
    ...lobby,
    status: 'waiting',
    currentGameId: undefined,
    players: lobby.players.map(p => ({
      ...p,
      ready: false,
    })),
  };
}
