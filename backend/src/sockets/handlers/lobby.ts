/**
 * Lobby socket event handlers.
 * Handles: createLobby, joinLobby, setReady, startGame, rematch
 */

import { Socket, Server } from 'socket.io';
import {
  createLobby,
  addPlayerToLobby,
  addBotsToLobby,
  setPlayerReady,
  canStartGame,
  updateLobbyStatus,
} from '../../services/LobbyManager.js';
import { createGame } from '../../services/GameManager.js';
import { createSession } from '../../services/SessionManager.js';
import { PoopyheadNamespace } from '../namespace.js';
import { persistGame, getGame } from '../broadcast.js';
import { processBotSwaps } from '../ai/botTurn.js';

export function handleCreateLobby(
  socket: Socket,
  data: { username: string; bombEnabled: boolean; turnTimerSeconds: number; botCount?: number; mode?: 'live' | 'async'; avatar?: string },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const userId: string | null = socket.data.userId ?? null;
    const isGuest = !userId;
    let lobby = createLobby(
      userId || 'guest_' + socket.id,
      data.username,
      isGuest,
      socket.id,
      { bombEnabled: data.bombEnabled, turnTimerSeconds: data.turnTimerSeconds, mode: data.mode },
      data.avatar
    );

    if (data.botCount && data.botCount > 0) {
      lobby = addBotsToLobby(lobby, data.botCount);
      for (const player of lobby.players) {
        if (player.isBot) ns.playerToSocket.set(player.id, player.socketId);
      }
    }

    ns.lobbies.set(lobby.code, lobby);
    const playerId = lobby.players[0].id; // human creator is always first
    ns.playerToSocket.set(playerId, socket.id);
    ns.socketToPlayer.set(socket.id, playerId);

    socket.join(`lobby:${lobby.code}`);

    callback({ success: true, lobby, playerId });
    socket.to(`lobby:${lobby.code}`).emit('playerJoined', { lobby });

    console.log(`[Lobby] ${data.username} created lobby ${lobby.code}${data.botCount ? ` with ${data.botCount} bots` : ''}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

export function handleJoinLobby(
  socket: Socket,
  data: { code: string; username: string; avatar?: string },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const lobby = ns.lobbies.get(data.code);
    if (!lobby) return callback({ success: false, reason: 'LOBBY_NOT_FOUND' });

    const userId: string | null = socket.data.userId ?? null;
    const isGuest = !userId;
    const result = addPlayerToLobby({
      lobby,
      userId: userId ?? undefined,
      username: data.username,
      isGuest,
      socketId: socket.id,
      avatar: data.avatar,
    });

    if (!result.success) return callback({ success: false, reason: result.reason });

    const updatedLobby = result.updatedLobby!;
    ns.lobbies.set(data.code, updatedLobby);

    const playerId = result.playerId!;
    ns.playerToSocket.set(playerId, socket.id);
    ns.socketToPlayer.set(socket.id, playerId);

    socket.join(`lobby:${data.code}`);

    callback({ success: true, lobby: updatedLobby, playerId });
    io.to(`lobby:${data.code}`).emit('playerJoined', { lobby: updatedLobby });

    console.log(`[Lobby] ${data.username} joined lobby ${data.code}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

export function handleSetReady(
  socket: Socket,
  data: { code: string; playerId: string; ready: boolean },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const lobby = ns.lobbies.get(data.code);
    if (!lobby) return callback({ success: false, reason: 'LOBBY_NOT_FOUND' });

    const senderPlayerId = ns.socketToPlayer.get(socket.id);
    if (senderPlayerId !== data.playerId) return callback({ success: false, reason: 'UNAUTHORIZED' });

    const updatedLobby = setPlayerReady(lobby, data.playerId, data.ready);
    ns.lobbies.set(data.code, updatedLobby);

    callback({ success: true, lobby: updatedLobby });
    io.to(`lobby:${data.code}`).emit('playerReady', {
      lobby: updatedLobby,
      playerId: data.playerId,
      ready: data.ready,
      canStart: canStartGame(updatedLobby),
    });

    console.log(`[Lobby] ${data.playerId} set ready=${data.ready}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

export function handleStartGame(
  socket: Socket,
  data: { code: string; playerId: string; direction: 'clockwise' | 'counterclockwise' },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const lobby = ns.lobbies.get(data.code);
    if (!lobby) return callback({ success: false, reason: 'LOBBY_NOT_FOUND' });

    const senderPlayerId = ns.socketToPlayer.get(socket.id);
    if (lobby.createdBy !== senderPlayerId && lobby.players[0]?.id !== senderPlayerId) {
      return callback({ success: false, reason: 'NOT_LOBBY_CREATOR' });
    }

    const game = createGame({
      lobbyCode: data.code,
      players: lobby.players.map((p: any) => ({
        id: p.id,
        username: p.username,
        poopyheadCount: 0,
        isBot: p.isBot || false,
        userId: p.userId,
      })),
      settings: lobby.settings,
      direction: data.direction,
      mode: lobby.settings.mode,
    });

    persistGame(game, ns);

    // Create sessions for human players only (bots don't reconnect)
    const sessions: any = {};
    for (const player of lobby.players) {
      if (player.isBot) continue;
      const playerSocket = ns.playerToSocket.get(player.id);
      if (playerSocket) {
        const session = createSession(player.id, game.id, data.code, playerSocket);
        sessions[player.id] = session;
      }
    }

    const updatedLobby = updateLobbyStatus(lobby, 'playing', game.id);
    ns.lobbies.set(data.code, updatedLobby);

    const currentTurnPlayer = game.players[game.currentPlayerIndex];
    callback({ success: true, game, sessions });
    io.to(`lobby:${data.code}`).emit('gameStarted', {
      game,
      sessions,
      currentTurnPlayerId: currentTurnPlayer?.id,
      currentTurnPlayerUsername: currentTurnPlayer?.username,
    });

    console.log(`[Game] ${data.code} started game ${game.id}`);

    // Auto-swap for bots (non-blocking, emits swapUpdate when done)
    processBotSwaps(game, io, ns);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

export async function handleRematch(
  socket: Socket,
  data: { code: string },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const lobby = ns.lobbies.get(data.code);
    if (!lobby) return callback({ success: false, reason: 'LOBBY_NOT_FOUND' });

    const senderPlayerId = ns.socketToPlayer.get(socket.id);
    if (!senderPlayerId || !lobby.players.find(p => p.id === senderPlayerId)) {
      return callback({ success: false, reason: 'NOT_IN_LOBBY' });
    }

    const existingGame = lobby.currentGameId ? await getGame(lobby.currentGameId, ns) : null;
    if (existingGame && existingGame.status !== 'ended') {
      return callback({ success: false, reason: 'GAME_STILL_ACTIVE' });
    }

    const game = createGame({
      lobbyCode: data.code,
      players: lobby.players.map((p) => ({
        id: p.id,
        username: p.username,
        poopyheadCount: 0,
        isBot: p.isBot || false,
        userId: p.userId,
      })),
      settings: lobby.settings,
      direction: 'clockwise',
      mode: lobby.settings.mode,
    });

    persistGame(game, ns);
    const updatedLobby = updateLobbyStatus(lobby, 'playing', game.id);
    ns.lobbies.set(data.code, updatedLobby);

    for (const player of lobby.players) {
      if (player.isBot) continue;
      const playerSocket = ns.playerToSocket.get(player.id);
      if (playerSocket) createSession(player.id, game.id, data.code, playerSocket);
    }

    const currentTurnPlayer = game.players[game.currentPlayerIndex];
    callback({ success: true });
    io.to(`lobby:${data.code}`).emit('gameStarted', {
      game,
      currentTurnPlayerId: currentTurnPlayer?.id,
      currentTurnPlayerUsername: currentTurnPlayer?.username,
    });

    console.log(`[Rematch] New game ${game.id} in lobby ${data.code}`);

    processBotSwaps(game, io, ns);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}
