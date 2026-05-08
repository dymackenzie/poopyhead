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
  processPickupAction,
  checkGameEnd,
  endGame,
  applySwap,
} from '../services/GameManager.js';
import { advancePlayerIndex } from '../services/TurnResolutionService.js';
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

    // GAME: Manual pickup pile
    socket.on('pickupPile', (data, callback) => {
      handlePickupPile(socket, data, callback, io, ns);
    });

    // DEBUG: Auto-play until draw pile is empty
    socket.on('debugAutoPlay', (data, callback) => {
      handleDebugAutoPlay(socket, data, callback, io, ns);
    });

    // GAME: Rematch — start new game with same lobby players
    socket.on('rematch', (data, callback) => {
      handleRematch(socket, data, callback, io, ns);
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
      payload.deckCount = updatedGame.deck.length;
      payload.players = buildPublicPlayerState(updatedGame);
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

    // Check for game end (applies to all outcomes including blind_fail)
    const endCheck = checkGameEnd(updatedGame);
    if (endCheck.ended) {
      const finalGame = endGame(updatedGame, endCheck.loserId!);
      ns.games.set(data.gameId, finalGame);

      const loserPlayer = updatedGame.players.find((p: any) => p.id === endCheck.loserId);
      io.to(`lobby:${game.lobbyCode}`).emit('gameEnded', {
        loserId: endCheck.loserId,
        loserUsername: loserPlayer?.username,
        loserTableCards: loserPlayer?.tableVisible ?? [],
        loserBlindCards: loserPlayer?.tableBlind ?? [],
      });
    }

    // Failed table/blind play: emit as pilePicked so frontend clears pile and advances turn
    if (actionResult.eventType === 'blind_fail') {
      const me = updatedGame.players.find(p => p.id === data.playerId);
      callback({ success: true, game: updatedGame, hand: me?.hand || [] });

      const nextPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
      io.to(`lobby:${game.lobbyCode}`).emit('pilePicked', {
        playerId: data.playerId,
        nextPlayerId: updatedGame.playOrder[updatedGame.currentPlayerIndex],
        nextPlayerUsername: nextPlayer?.username,
        pileState: [],
        deckCount: updatedGame.deck.length,
        activeConstraints: updatedGame.activeConstraints,
        players: buildPublicPlayerState(updatedGame),
        blindFail: true,
        isBlindPlay: actionResult.sourceZone === 'blind',
        revealedCard: actionResult.cardsPlayed?.[0] ?? null,
      });

      console.log(`[Game] ${data.playerId} blind flip failed in ${data.gameId}`);
      return;
    }

    callback({ success: true, game: updatedGame });
    io.to(`lobby:${game.lobbyCode}`).emit('cardPlayed', {
      playerId: data.playerId,
      cardsPlayed: data.cardIds,
      nextPlayerId: updatedGame.playOrder[updatedGame.currentPlayerIndex],
      pileState: updatedGame.playPile,
      bombTriggered: actionResult.eventType === 'bomb_triggered',
      deckCount: updatedGame.deck.length,
      activeConstraints: updatedGame.activeConstraints,
      players: buildPublicPlayerState(updatedGame),
      isBlindPlay: actionResult.sourceZone === 'blind',
      isTablePlay: actionResult.sourceZone === 'table',
      revealedCard: (actionResult.sourceZone === 'blind' || actionResult.sourceZone === 'table')
        ? (actionResult.cardsPlayed?.[0] ?? null)
        : null,
    });

    console.log(`[Game] ${data.playerId} played cards in ${data.gameId}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

/**
 * Returns public (non-secret) player state visible to all clients.
 */
function buildPublicPlayerState(game: GameInstance) {
  return game.players.map(p => ({
    id: p.id,
    cardsInHand: p.hand.length,
    tableVisible: p.tableVisible,   // visible to all by rule
    tableBlindCount: p.tableBlind.length,
  }));
}

/**
 * Handle: Pickup pile
 */
function handlePickupPile(
  socket: Socket,
  data: { gameId: string; playerId: string },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const game = ns.games.get(data.gameId);
    if (!game) return callback({ success: false, reason: 'GAME_NOT_FOUND' });

    const result = processPickupAction({ game, playerId: data.playerId });
    if (!result.success) return callback({ success: false, reason: result.reason });

    const updatedGame = result.updatedGame!;
    ns.games.set(data.gameId, updatedGame);

    const me = updatedGame.players.find(p => p.id === data.playerId);
    callback({ success: true, hand: me?.hand || [] });

    const nextPlayer = updatedGame.players.find(p => p.id === updatedGame.playOrder[updatedGame.currentPlayerIndex]);
    io.to(`lobby:${game.lobbyCode}`).emit('pilePicked', {
      playerId: data.playerId,
      nextPlayerId: updatedGame.playOrder[updatedGame.currentPlayerIndex],
      nextPlayerUsername: nextPlayer?.username,
      pileState: [],
      deckCount: updatedGame.deck.length,
      activeConstraints: updatedGame.activeConstraints,
      players: buildPublicPlayerState(updatedGame),
    });

    console.log(`[Game] ${data.playerId} picked up pile in ${data.gameId}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

/**
 * Auto-play one turn with a simple greedy strategy (lowest valid rank group first).
 */
function debugAutoPlayOneTurn(game: GameInstance): GameInstance {
  const currentPlayerId = game.playOrder[game.currentPlayerIndex];
  const player = game.players.find(p => p.id === currentPlayerId);
  if (!player) return game;

  // Player already out — advance past them
  if (player.hand.length === 0 && player.tableVisible.length === 0 && player.tableBlind.length === 0) {
    const nextIndex = advancePlayerIndex(game.currentPlayerIndex, 1, game.playOrder.length, game.direction);
    return { ...game, currentPlayerIndex: nextIndex };
  }

  const isBlindZone = player.hand.length === 0 && player.tableVisible.length === 0;

  // Blind zone: just flip the first card
  if (isBlindZone) {
    const result = processPlayCardAction({ game, playerId: currentPlayerId, cardIds: [player.tableBlind[0].id] });
    if (result.success && result.updatedGame) return result.updatedGame;
  }

  const candidates = player.hand.length > 0 ? player.hand : player.tableVisible;
  const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const rankGroups: Record<string, string[]> = {};
  for (const card of candidates) {
    rankGroups[card.rank] = rankGroups[card.rank] || [];
    rankGroups[card.rank].push(card.id);
  }

  for (const rank of rankOrder) {
    if (!rankGroups[rank]) continue;
    const result = processPlayCardAction({ game, playerId: currentPlayerId, cardIds: rankGroups[rank] });
    if (result.success && result.updatedGame) return result.updatedGame;
  }

  // Nothing playable — pick up pile
  if (game.playPile.length > 0) {
    const result = processPickupAction({ game, playerId: currentPlayerId });
    if (result.success && result.updatedGame) return result.updatedGame;
  }

  // Pile empty and nothing valid (shouldn't happen) — skip turn
  const nextIndex = advancePlayerIndex(game.currentPlayerIndex, 1, game.playOrder.length, game.direction);
  return { ...game, currentPlayerIndex: nextIndex };
}

/**
 * Handle: Debug auto-play until draw pile is empty
 */
function handleDebugAutoPlay(
  socket: Socket,
  data: { gameId: string },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const game = ns.games.get(data.gameId);
    if (!game) return callback({ success: false, reason: 'GAME_NOT_FOUND' });
    if (game.status !== 'playing') return callback({ success: false, reason: 'GAME_NOT_PLAYING' });

    let currentGame = game;
    let iterations = 0;
    while (currentGame.deck.length > 0 && iterations < 2000) {
      const endCheck = checkGameEnd(currentGame);
      if (endCheck.ended) break;
      currentGame = debugAutoPlayOneTurn(currentGame);
      iterations++;
    }

    ns.games.set(data.gameId, currentGame);

    const currentTurnPlayer = currentGame.players[currentGame.currentPlayerIndex];
    callback({ success: true, iterations });
    io.to(`lobby:${game.lobbyCode}`).emit('debugStateSync', {
      game: currentGame,
      currentTurnPlayerId: currentGame.playOrder[currentGame.currentPlayerIndex],
      currentTurnPlayerUsername: currentTurnPlayer?.username,
      deckCount: currentGame.deck.length,
      players: buildPublicPlayerState(currentGame),
    });

    console.log(`[Debug] Auto-played ${iterations} turns in ${data.gameId}, deck now ${currentGame.deck.length}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

/**
 * Handle: Rematch — create a new game with the same lobby players
 */
function handleRematch(
  socket: Socket,
  data: { code: string },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const lobby = ns.lobbies.get(data.code);
    if (!lobby) return callback({ success: false, reason: 'LOBBY_NOT_FOUND' });

    // Guard: don't create a second game if one is already active
    const existingGame = lobby.currentGameId ? ns.games.get(lobby.currentGameId) : null;
    if (existingGame && existingGame.status !== 'ended') {
      return callback({ success: false, reason: 'GAME_STILL_ACTIVE' });
    }

    const game = createGame({
      lobbyCode: data.code,
      players: lobby.players.map((p) => ({ id: p.id, username: p.username, poopyheadCount: 0 })),
      settings: lobby.settings,
      direction: 'clockwise',
    });

    ns.games.set(game.id, game);
    const updatedLobby = updateLobbyStatus(lobby, 'playing', game.id);
    ns.lobbies.set(data.code, updatedLobby);

    for (const player of lobby.players) {
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
