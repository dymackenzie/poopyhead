/**
 * Socket.io Event Handlers
 * 
 * Handles all real-time communication:
 * - Lobby creation/joining
 * - Game start
 * - Card plays
 * - State broadcasts
 * - Reconnection & persistence
 */

import { Socket, Server } from 'socket.io';
import { Lobby } from '../services/LobbyManager.js';
import { GameInstance } from '../services/GameManager.js';
import {
  createLobby,
  addPlayerToLobby,
  setPlayerReady,
  canStartGame,
  updateLobbyStatus,
} from '../services/LobbyManager.js';
import {
  createGame,
  processPlayCardAction,
  checkGameEnd,
  endGame,
  applySwap,
} from '../services/GameManager.js';
import {
  createSession,
  handleReconnect,
  handleDisconnect as handleSessionDisconnect,
  updateHeartbeat,
  getSession,
} from '../services/SessionManager.js';

export interface PoopyheadNamespace {
  lobbies: Map<string, Lobby>;
  games: Map<string, GameInstance>;
  playerToSocket: Map<string, string>; // playerId -> socketId
  socketToPlayer: Map<string, string>; // socketId -> playerId
  sessions: Map<string, string>; // sessionId -> playerId
}

/**
 * Creates and registers socket event handlers.
 */
export function setupSocketHandlers(io: Server, ns: PoopyheadNamespace) {
  
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    
    // LOBBY: Create new lobby
    socket.on('createLobby', (data, callback) => {
      handleCreateLobby(socket, data, callback, io, ns);
    });
    
    // LOBBY: Join existing lobby by code
    socket.on('joinLobby', (data, callback) => {
      handleJoinLobby(socket, data, callback, io, ns);
    });
    
    // LOBBY: Player ready toggle
    socket.on('setReady', (data, callback) => {
      handleSetReady(socket, data, callback, io, ns);
    });
    
    // GAME: Start game (lobby creator only)
    socket.on('startGame', (data, callback) => {
      handleStartGame(socket, data, callback, io, ns);
    });
    
    // GAME: Swap table-visible cards (swapping phase)
    socket.on('swapCards', (data, callback) => {
      handleSwapCards(socket, data, callback, io, ns);
    });

    // GAME: Play cards
    socket.on('playCard', (data, callback) => {
      handlePlayCard(socket, data, callback, io, ns);
    });
    
    // RECONNECT: Recover session after disconnect
    socket.on('reconnect', (data, callback) => {
      handleReconnectSession(socket, data, callback, io, ns);
    });
    
    // HEARTBEAT: Keep session alive during play
    socket.on('heartbeat', () => {
      const playerId = ns.socketToPlayer.get(socket.id);
      if (playerId) {
        // Update heartbeat in session manager (optional for MVP)
        console.log(`[Heartbeat] ${playerId}`);
      }
    });
    
    // Disconnect
    socket.on('disconnect', () => {
      handleDisconnect(socket, io, ns);
    });
  });
}

/**
 * Handle: Create lobby
 */
function handleCreateLobby(
  socket: Socket,
  data: { username: string; userId?: string; bombEnabled: boolean; turnTimerSeconds: number },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const isGuest = !data.userId;
    const lobby = createLobby(
      data.userId || 'guest_' + socket.id,
      data.username,
      isGuest,
      socket.id,
      { bombEnabled: data.bombEnabled, turnTimerSeconds: data.turnTimerSeconds }
    );
    
    ns.lobbies.set(lobby.code, lobby);
    const playerId = lobby.players[0].id;
    ns.playerToSocket.set(playerId, socket.id);
    ns.socketToPlayer.set(socket.id, playerId);
    
    socket.join(`lobby:${lobby.code}`);
    
    callback({ success: true, lobby, playerId });
    socket.to(`lobby:${lobby.code}`).emit('playerJoined', {
      lobby,
    });
    
    console.log(`[Lobby] ${data.username} created lobby ${lobby.code}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

/**
 * Handle: Join lobby by code
 */
function handleJoinLobby(
  socket: Socket,
  data: { code: string; username: string; userId?: string },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const lobby = ns.lobbies.get(data.code);
    
    if (!lobby) {
      return callback({ success: false, reason: 'LOBBY_NOT_FOUND' });
    }
    
    const isGuest = !data.userId;
    
    const result = addPlayerToLobby({
      lobby,
      userId: data.userId,
      username: data.username,
      isGuest,
      socketId: socket.id,
    });
    
    if (!result.success) {
      return callback({ success: false, reason: result.reason });
    }
    
    const updatedLobby = result.updatedLobby!;
    ns.lobbies.set(data.code, updatedLobby);
    
    const playerId = result.playerId!;
    ns.playerToSocket.set(playerId, socket.id);
    ns.socketToPlayer.set(socket.id, playerId);
    
    socket.join(`lobby:${data.code}`);
    
    callback({ success: true, lobby: updatedLobby, playerId });
    io.to(`lobby:${data.code}`).emit('playerJoined', {
      lobby: updatedLobby,
    });
    
    console.log(`[Lobby] ${data.username} joined lobby ${data.code}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

/**
 * Handle: Set player ready
 */
function handleSetReady(
  socket: Socket,
  data: { code: string; playerId: string; ready: boolean },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const lobby = ns.lobbies.get(data.code);
    if (!lobby) return callback({ success: false, reason: 'LOBBY_NOT_FOUND' });
    
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

/**
 * Handle: Start game
 */
function handleStartGame(
  socket: Socket,
  data: { code: string; playerId: string; direction: 'clockwise' | 'counterclockwise' },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const lobby = ns.lobbies.get(data.code);
    if (!lobby) return callback({ success: false, reason: 'LOBBY_NOT_FOUND' });
    
    // Only creator can start
    const senderPlayerId = ns.socketToPlayer.get(socket.id);
    if (lobby.createdBy !== senderPlayerId && lobby.players[0]?.id !== senderPlayerId) {
      return callback({ success: false, reason: 'NOT_LOBBY_CREATOR' });
    }
    
    const game = createGame({
      lobbyCode: data.code,
      players: lobby.players.map((p: any) => ({
        id: p.id,
        username: p.username,
        poopyheadCount: 0, // TODO: Fetch from database
      })),
      settings: lobby.settings,
      direction: data.direction,
    });
    
    ns.games.set(game.id, game);
    
    // Create sessions for all players (for reconnection support)
    const sessions: any = {};
    for (const player of lobby.players) {
      const playerSocket = ns.playerToSocket.get(player.id);
      if (playerSocket) {
        const session = createSession(player.id, game.id, data.code, playerSocket);
        sessions[player.id] = session;
      }
    }
    
    // Update lobby status
    const updatedLobby = updateLobbyStatus(lobby, 'playing', game.id);
    ns.lobbies.set(data.code, updatedLobby);
    
    // Derive the current turn player's username so clients can display it
    const currentTurnPlayer = game.players[game.currentPlayerIndex];

    callback({ success: true, game, sessions });
    io.to(`lobby:${data.code}`).emit('gameStarted', {
      game,
      sessions, // Send session tokens to clients
      currentTurnPlayerId: currentTurnPlayer?.id,
      currentTurnPlayerUsername: currentTurnPlayer?.username,
    });
    
    console.log(`[Game] ${data.code} started game ${game.id}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

/**
 * Handle: Swap table-visible cards (swapping phase)
 */
function handleSwapCards(
  socket: Socket,
  data: { gameId: string; playerId: string; cardIds: string[] },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const game = ns.games.get(data.gameId);
    if (!game) return callback({ success: false, reason: 'GAME_NOT_FOUND' });

    const swapResult = applySwap({
      game,
      playerId: data.playerId,
      cardIds: data.cardIds,
    });

    if (!swapResult.success) {
      return callback({ success: false, reason: swapResult.reason });
    }

    const updatedGame = swapResult.updatedGame!;
    ns.games.set(data.gameId, updatedGame);

    callback({ success: true });

    // Notify room of swap progress and, when all done, the phase transition
    const payload: Record<string, unknown> = {
      playerId: data.playerId,
      swappedCount: updatedGame.swappedPlayers.length,
      totalPlayers: updatedGame.players.length,
      phase: updatedGame.status,
    };

    if (swapResult.allPlayersSwapped) {
      // Include full game state so clients can update hand/tableVisible atomically.
      // Also include who goes first so the turn banner populates immediately.
      const firstTurnPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
      payload.game = updatedGame;
      payload.currentTurnPlayerId = firstTurnPlayer?.id;
      payload.currentTurnPlayerUsername = firstTurnPlayer?.username;
    }

    io.to(`lobby:${game.lobbyCode}`).emit('swapUpdate', payload);

    console.log(`[Game] ${data.playerId} swapped cards in ${data.gameId}` +
      (swapResult.allPlayersSwapped ? ' — all swapped, game starting' : ''));
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

/**
 * Handle: Play card
 */
function handlePlayCard(
  socket: Socket,
  data: { gameId: string; playerId: string; cardIds: string[] },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const game = ns.games.get(data.gameId);
    if (!game) return callback({ success: false, reason: 'GAME_NOT_FOUND' });
    
    const actionResult = processPlayCardAction({
      game,
      playerId: data.playerId,
      cardIds: data.cardIds,
    });
    
    if (!actionResult.success) {
      return callback({ success: false, reason: actionResult.reason });
    }
    
    const updatedGame = actionResult.updatedGame!;
    ns.games.set(data.gameId, updatedGame);
    
    // Check for game end
    const endCheck = checkGameEnd(updatedGame);
    if (endCheck.ended) {
      const finalGame = endGame(updatedGame, endCheck.loserId!);
      ns.games.set(data.gameId, finalGame);
      
      io.to(`lobby:${game.lobbyCode}`).emit('gameEnded', {
        loserId: endCheck.loserId,
        loserUsername: updatedGame.players.find((p: any) => p.id === endCheck.loserId)?.username,
      });
    }
    
    callback({ success: true, game: updatedGame });
    io.to(`lobby:${game.lobbyCode}`).emit('cardPlayed', {
      playerId: data.playerId,
      cardsPlayed: data.cardIds,
      nextPlayerId: updatedGame.playOrder[updatedGame.currentPlayerIndex],
      pileState: updatedGame.playPile,
      bombTriggered: actionResult.eventType === 'bomb_triggered',
    });
    
    console.log(`[Game] ${data.playerId} played cards in ${data.gameId}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

/**
 * Handle: Disconnect
 */
function handleDisconnect(socket: Socket, io: Server, ns: PoopyheadNamespace) {
  try {
    const playerId = ns.socketToPlayer.get(socket.id);

    if (playerId) {
      ns.playerToSocket.delete(playerId);
      ns.socketToPlayer.delete(socket.id);

      console.log(`[Socket] ${playerId} disconnected`);

      // Notify only the rooms this socket was in (lobby and/or game)
      // socket.rooms still contains the rooms at disconnect time
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          io.to(room).emit('playerDisconnected', { playerId });
        }
      }
    }
  } catch (error) {
    console.error('[Socket] Disconnect error:', error);
  }
}

/**
 * Handle: Reconnect (recover session)
 */
function handleReconnectSession(
  socket: Socket,
  data: { sessionId: string; gameId: string },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const session = getSession(data.sessionId);
    
    if (!session) {
      return callback({ success: false, reason: 'SESSION_NOT_FOUND' });
    }
    
    // Validate game still exists
    const game = ns.games.get(data.gameId);
    if (!game) {
      return callback({ success: false, reason: 'GAME_NOT_FOUND' });
    }
    
    // Handle reconnect with grace period
    const recoveryResult = handleReconnect(data.sessionId, socket.id);
    
    if (!recoveryResult.recovered) {
      return callback({ success: false, reason: recoveryResult.reason });
    }
    
    // Update mappings
    ns.playerToSocket.set(session.playerId, socket.id);
    ns.socketToPlayer.set(socket.id, session.playerId);
    
    // Rejoin game room
    socket.join(`lobby:${session.lobbyCode}`);
    socket.join(`game:${session.gameId}`);
    
    // Notify game of reconnection
    io.to(`lobby:${session.lobbyCode}`).emit('playerReconnected', {
      playerId: session.playerId,
      gameId: session.gameId,
    });
    
    callback({
      success: true,
      session: recoveryResult.session,
      game,
    });
    
    console.log(`[Reconnect] ${session.playerId} recovered in game ${data.gameId}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}
