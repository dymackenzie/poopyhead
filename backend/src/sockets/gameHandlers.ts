/**
 * Socket.io Event Handlers
 *
 * Handles all real-time communication:
 * - Lobby creation/joining
 * - Game start
 * - Card plays
 * - State broadcasts
 * - Reconnection & persistence
 * - AI bot players
 */

import { Socket, Server } from 'socket.io';
import { Lobby } from '../services/LobbyManager.js';
import { GameInstance, PlayCardActionOutput } from '../services/GameManager.js';
import {
  createLobby,
  addPlayerToLobby,
  addBotsToLobby,
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

const BOT_TAKEOVER_DELAY_MS = 30_000;
const AI_TURN_DELAY_MS = 1_500;

export interface PoopyheadNamespace {
  lobbies: Map<string, Lobby>;
  games: Map<string, GameInstance>;
  playerToSocket: Map<string, string>; // playerId -> socketId
  socketToPlayer: Map<string, string>; // socketId -> playerId
  sessions: Map<string, string>; // sessionId -> playerId
  pendingBotTakeovers: Map<string, ReturnType<typeof setTimeout>>; // playerId -> timeout
}

/**
 * Creates and registers socket event handlers.
 */
export function setupSocketHandlers(io: Server, ns: PoopyheadNamespace) {

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('createLobby', (data, callback) => {
      handleCreateLobby(socket, data, callback, io, ns);
    });

    socket.on('joinLobby', (data, callback) => {
      handleJoinLobby(socket, data, callback, io, ns);
    });

    socket.on('setReady', (data, callback) => {
      handleSetReady(socket, data, callback, io, ns);
    });

    socket.on('startGame', (data, callback) => {
      handleStartGame(socket, data, callback, io, ns);
    });

    socket.on('swapCards', (data, callback) => {
      handleSwapCards(socket, data, callback, io, ns);
    });

    socket.on('playCard', (data, callback) => {
      handlePlayCard(socket, data, callback, io, ns);
    });

    socket.on('pickupPile', (data, callback) => {
      handlePickupPile(socket, data, callback, io, ns);
    });

    socket.on('debugAutoPlay', (data, callback) => {
      handleDebugAutoPlay(socket, data, callback, io, ns);
    });

    socket.on('rematch', (data, callback) => {
      handleRematch(socket, data, callback, io, ns);
    });

    socket.on('reconnect', (data, callback) => {
      handleReconnectSession(socket, data, callback, io, ns);
    });

    socket.on('heartbeat', () => {
      const playerId = ns.socketToPlayer.get(socket.id);
      if (playerId) {
        console.log(`[Heartbeat] ${playerId}`);
      }
    });

    socket.on('disconnect', () => {
      handleDisconnect(socket, io, ns);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// BROADCAST HELPERS (shared by socket handlers + AI turns)
// ─────────────────────────────────────────────────────────────

function buildPublicPlayerState(game: GameInstance) {
  return game.players.map(p => ({
    id: p.id,
    cardsInHand: p.hand.length,
    tableVisible: p.tableVisible,
    tableBlindCount: p.tableBlind.length,
    isBot: p.isBot,
  }));
}

/**
 * Emit cardPlayed or pilePicked (for blind_fail) after a successful play action.
 * Also checks for game end and schedules the next AI turn if needed.
 */
function broadcastPlayResult(
  updatedGame: GameInstance,
  originalLobbyCode: string,
  playerId: string,
  cardIds: string[],
  actionResult: PlayCardActionOutput,
  io: Server,
  ns: PoopyheadNamespace
): void {
  const endCheck = checkGameEnd(updatedGame);
  if (endCheck.ended) {
    const finalGame = endGame(updatedGame, endCheck.loserId!);
    ns.games.set(updatedGame.id, finalGame);
    const loserPlayer = updatedGame.players.find(p => p.id === endCheck.loserId);
    io.to(`lobby:${originalLobbyCode}`).emit('gameEnded', {
      loserId: endCheck.loserId,
      loserUsername: loserPlayer?.username,
      loserTableCards: loserPlayer?.tableVisible ?? [],
      loserBlindCards: loserPlayer?.tableBlind ?? [],
    });
    return;
  }

  if (actionResult.eventType === 'blind_fail') {
    const nextPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
    io.to(`lobby:${originalLobbyCode}`).emit('pilePicked', {
      playerId,
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
  } else {
    io.to(`lobby:${originalLobbyCode}`).emit('cardPlayed', {
      playerId,
      cardsPlayed: cardIds,
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
  }

  scheduleNextAITurnIfNeeded(updatedGame, io, ns);
}

/**
 * Emit pilePicked after a manual pickup action.
 * Also schedules the next AI turn if needed.
 */
function broadcastPickupResult(
  updatedGame: GameInstance,
  originalLobbyCode: string,
  playerId: string,
  io: Server,
  ns: PoopyheadNamespace
): void {
  const nextPlayer = updatedGame.players.find(
    p => p.id === updatedGame.playOrder[updatedGame.currentPlayerIndex]
  );
  io.to(`lobby:${originalLobbyCode}`).emit('pilePicked', {
    playerId,
    nextPlayerId: updatedGame.playOrder[updatedGame.currentPlayerIndex],
    nextPlayerUsername: nextPlayer?.username,
    pileState: [],
    deckCount: updatedGame.deck.length,
    activeConstraints: updatedGame.activeConstraints,
    players: buildPublicPlayerState(updatedGame),
  });
  scheduleNextAITurnIfNeeded(updatedGame, io, ns);
}

// ─────────────────────────────────────────────────────────────
// AI TURN EXECUTION
// ─────────────────────────────────────────────────────────────

/**
 * If the current player is a bot, schedules an AI turn after a short delay.
 */
function scheduleNextAITurnIfNeeded(game: GameInstance, io: Server, ns: PoopyheadNamespace): void {
  if (game.status !== 'playing') return;

  const currentPlayer = game.players.find(
    p => p.id === game.playOrder[game.currentPlayerIndex]
  );
  if (!currentPlayer?.isBot) return;

  const gameId = game.id;
  setTimeout(() => {
    const currentGame = ns.games.get(gameId);
    if (!currentGame || currentGame.status !== 'playing') return;

    const player = currentGame.players.find(
      p => p.id === currentGame.playOrder[currentGame.currentPlayerIndex]
    );
    if (!player?.isBot) return;

    console.log(`[AI] ${player.username} taking turn in ${gameId}`);
    executeAndBroadcastAITurn(currentGame, io, ns);
  }, AI_TURN_DELAY_MS);
}

/**
 * Executes one greedy AI turn: lowest valid rank → lowest table card → blind flip.
 * Broadcasts result using the same events as human plays.
 */
function executeAndBroadcastAITurn(game: GameInstance, io: Server, ns: PoopyheadNamespace): void {
  const currentPlayerId = game.playOrder[game.currentPlayerIndex];
  const player = game.players.find(p => p.id === currentPlayerId);
  if (!player) return;

  const endCheck = checkGameEnd(game);
  if (endCheck.ended) {
    const finalGame = endGame(game, endCheck.loserId!);
    ns.games.set(game.id, finalGame);
    const loserPlayer = game.players.find(p => p.id === endCheck.loserId);
    io.to(`lobby:${game.lobbyCode}`).emit('gameEnded', {
      loserId: endCheck.loserId,
      loserUsername: loserPlayer?.username,
      loserTableCards: loserPlayer?.tableVisible ?? [],
      loserBlindCards: loserPlayer?.tableBlind ?? [],
    });
    return;
  }

  // Player already out — advance and broadcast so frontend learns the new currentTurnPlayerId
  if (player.hand.length === 0 && player.tableVisible.length === 0 && player.tableBlind.length === 0) {
    const nextIndex = advancePlayerIndex(game.currentPlayerIndex, 1, game.playOrder.length, game.direction);
    const advanced = { ...game, currentPlayerIndex: nextIndex };
    ns.games.set(game.id, advanced);
    io.to(`lobby:${game.lobbyCode}`).emit('cardPlayed', {
      playerId: currentPlayerId,
      cardsPlayed: [],
      nextPlayerId: advanced.playOrder[nextIndex],
      pileState: advanced.playPile,
      deckCount: advanced.deck.length,
      activeConstraints: advanced.activeConstraints,
      players: buildPublicPlayerState(advanced),
    });
    scheduleNextAITurnIfNeeded(advanced, io, ns);
    return;
  }

  // Blind zone: flip first card
  if (player.hand.length === 0 && player.tableVisible.length === 0) {
    const cardId = player.tableBlind[0].id;
    const result = processPlayCardAction({ game, playerId: currentPlayerId, cardIds: [cardId] });
    if (result.success && result.updatedGame) {
      ns.games.set(game.id, result.updatedGame);
      broadcastPlayResult(result.updatedGame, game.lobbyCode, currentPlayerId, [cardId], result, io, ns);
      return;
    }
  }

  const isTableZone = player.hand.length === 0 && player.tableVisible.length > 0;
  const candidates = player.hand.length > 0 ? player.hand : player.tableVisible;
  const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const rankGroups: Record<string, string[]> = {};
  for (const card of candidates) {
    rankGroups[card.rank] = rankGroups[card.rank] || [];
    // Table cards can't stack same-rank — only keep one card per rank group in table zone
    if (!isTableZone || rankGroups[card.rank].length === 0) {
      rankGroups[card.rank].push(card.id);
    }
  }

  for (const rank of rankOrder) {
    if (!rankGroups[rank]) continue;
    const cardIds = rankGroups[rank];
    const result = processPlayCardAction({ game, playerId: currentPlayerId, cardIds });
    if (result.success && result.updatedGame) {
      ns.games.set(game.id, result.updatedGame);
      broadcastPlayResult(result.updatedGame, game.lobbyCode, currentPlayerId, cardIds, result, io, ns);
      return;
    }
  }

  // Nothing playable — pick up pile
  if (game.playPile.length > 0) {
    const result = processPickupAction({ game, playerId: currentPlayerId });
    if (result.success && result.updatedGame) {
      ns.games.set(game.id, result.updatedGame);
      broadcastPickupResult(result.updatedGame, game.lobbyCode, currentPlayerId, io, ns);
      return;
    }
  }

  // Pile empty and nothing valid — advance turn and broadcast so frontend doesn't freeze
  const nextIndex = advancePlayerIndex(game.currentPlayerIndex, 1, game.playOrder.length, game.direction);
  const advanced = { ...game, currentPlayerIndex: nextIndex };
  ns.games.set(game.id, advanced);
  io.to(`lobby:${game.lobbyCode}`).emit('cardPlayed', {
    playerId: currentPlayerId,
    cardsPlayed: [],
    nextPlayerId: advanced.playOrder[nextIndex],
    pileState: advanced.playPile,
    deckCount: advanced.deck.length,
    activeConstraints: advanced.activeConstraints,
    players: buildPublicPlayerState(advanced),
  });
  scheduleNextAITurnIfNeeded(advanced, io, ns);
}

/**
 * Auto-swap table cards for all bot players in a swapping-phase game.
 * Bots pick their 3 highest-value cards for the visible table.
 * Emits swapUpdate after all bots swap (with phase transition payload if applicable).
 */
function processBotSwaps(game: GameInstance, io: Server, ns: PoopyheadNamespace): void {
  let currentGame = game;

  for (const player of currentGame.players) {
    if (!player.isBot) continue;
    if (currentGame.status !== 'swapping') break;

    const sortedHand = [...player.hand].sort((a, b) => b.value - a.value);
    const cardIds = sortedHand.slice(0, 3).map(c => c.id);
    const swapResult = applySwap({ game: currentGame, playerId: player.id, cardIds });
    if (swapResult.success && swapResult.updatedGame) {
      currentGame = swapResult.updatedGame;
    }
  }

  if (currentGame === game) return; // no bots swapped
  ns.games.set(game.id, currentGame);

  const payload: Record<string, unknown> = {
    swappedCount: currentGame.swappedPlayers.length,
    totalPlayers: currentGame.players.length,
    phase: currentGame.status,
  };

  if (currentGame.status === 'playing') {
    const firstTurnPlayer = currentGame.players[currentGame.currentPlayerIndex];
    payload.game = currentGame;
    payload.currentTurnPlayerId = firstTurnPlayer?.id;
    payload.currentTurnPlayerUsername = firstTurnPlayer?.username;
    payload.deckCount = currentGame.deck.length;
    payload.players = buildPublicPlayerState(currentGame);
    scheduleNextAITurnIfNeeded(currentGame, io, ns);
  }

  io.to(`lobby:${game.lobbyCode}`).emit('swapUpdate', payload);
}

// ─────────────────────────────────────────────────────────────
// SOCKET HANDLERS
// ─────────────────────────────────────────────────────────────

function handleCreateLobby(
  socket: Socket,
  data: { username: string; bombEnabled: boolean; turnTimerSeconds: number; botCount?: number },
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
      { bombEnabled: data.bombEnabled, turnTimerSeconds: data.turnTimerSeconds }
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

function handleJoinLobby(
  socket: Socket,
  data: { code: string; username: string },
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
      })),
      settings: lobby.settings,
      direction: data.direction,
    });

    ns.games.set(game.id, game);

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

    if (!swapResult.success) return callback({ success: false, reason: swapResult.reason });

    const updatedGame = swapResult.updatedGame!;
    ns.games.set(data.gameId, updatedGame);

    callback({ success: true });

    const payload: Record<string, unknown> = {
      playerId: data.playerId,
      swappedCount: updatedGame.swappedPlayers.length,
      totalPlayers: updatedGame.players.length,
      phase: updatedGame.status,
    };

    if (swapResult.allPlayersSwapped) {
      const firstTurnPlayer = updatedGame.players[updatedGame.currentPlayerIndex];
      payload.game = updatedGame;
      payload.currentTurnPlayerId = firstTurnPlayer?.id;
      payload.currentTurnPlayerUsername = firstTurnPlayer?.username;
      payload.deckCount = updatedGame.deck.length;
      payload.players = buildPublicPlayerState(updatedGame);
      scheduleNextAITurnIfNeeded(updatedGame, io, ns);
    }

    io.to(`lobby:${game.lobbyCode}`).emit('swapUpdate', payload);

    console.log(`[Game] ${data.playerId} swapped cards in ${data.gameId}` +
      (swapResult.allPlayersSwapped ? ' — all swapped, game starting' : ''));
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

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

    if (!actionResult.success) return callback({ success: false, reason: actionResult.reason });

    const updatedGame = actionResult.updatedGame!;
    ns.games.set(data.gameId, updatedGame);

    if (actionResult.eventType === 'blind_fail') {
      const me = updatedGame.players.find(p => p.id === data.playerId);
      callback({ success: true, game: updatedGame, hand: me?.hand || [] });
    } else {
      callback({ success: true, game: updatedGame });
    }

    broadcastPlayResult(updatedGame, game.lobbyCode, data.playerId, data.cardIds, actionResult, io, ns);

    console.log(`[Game] ${data.playerId} played cards in ${data.gameId}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

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

    broadcastPickupResult(updatedGame, game.lobbyCode, data.playerId, io, ns);

    console.log(`[Game] ${data.playerId} picked up pile in ${data.gameId}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}

/**
 * Auto-play one turn with a simple greedy strategy (lowest valid rank group first).
 * Used only by the debug handler.
 */
function debugAutoPlayOneTurn(game: GameInstance): GameInstance {
  const currentPlayerId = game.playOrder[game.currentPlayerIndex];
  const player = game.players.find(p => p.id === currentPlayerId);
  if (!player) return game;

  if (player.hand.length === 0 && player.tableVisible.length === 0 && player.tableBlind.length === 0) {
    const nextIndex = advancePlayerIndex(game.currentPlayerIndex, 1, game.playOrder.length, game.direction);
    return { ...game, currentPlayerIndex: nextIndex };
  }

  const isBlindZone = player.hand.length === 0 && player.tableVisible.length === 0;
  if (isBlindZone) {
    const result = processPlayCardAction({ game, playerId: currentPlayerId, cardIds: [player.tableBlind[0].id] });
    if (result.success && result.updatedGame) return result.updatedGame;
  }

  const isTableZone = player.hand.length === 0 && player.tableVisible.length > 0;
  const candidates = player.hand.length > 0 ? player.hand : player.tableVisible;
  const rankOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const rankGroups: Record<string, string[]> = {};
  for (const card of candidates) {
    rankGroups[card.rank] = rankGroups[card.rank] || [];
    if (!isTableZone || rankGroups[card.rank].length === 0) {
      rankGroups[card.rank].push(card.id);
    }
  }

  for (const rank of rankOrder) {
    if (!rankGroups[rank]) continue;
    const result = processPlayCardAction({ game, playerId: currentPlayerId, cardIds: rankGroups[rank] });
    if (result.success && result.updatedGame) return result.updatedGame;
  }

  if (game.playPile.length > 0) {
    const result = processPickupAction({ game, playerId: currentPlayerId });
    if (result.success && result.updatedGame) return result.updatedGame;
  }

  const nextIndex = advancePlayerIndex(game.currentPlayerIndex, 1, game.playOrder.length, game.direction);
  return { ...game, currentPlayerIndex: nextIndex };
}

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

    const existingGame = lobby.currentGameId ? ns.games.get(lobby.currentGameId) : null;
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
      })),
      settings: lobby.settings,
      direction: 'clockwise',
    });

    ns.games.set(game.id, game);
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

// ─────────────────────────────────────────────────────────────
// DISCONNECT / RECONNECT
// ─────────────────────────────────────────────────────────────

function findGameForPlayer(playerId: string, ns: PoopyheadNamespace): GameInstance | undefined {
  for (const game of ns.games.values()) {
    if (game.status === 'playing' && game.players.some(p => p.id === playerId)) {
      return game;
    }
  }
  return undefined;
}

function handleDisconnect(socket: Socket, io: Server, ns: PoopyheadNamespace) {
  try {
    const playerId = ns.socketToPlayer.get(socket.id);

    if (playerId) {
      ns.playerToSocket.delete(playerId);
      ns.socketToPlayer.delete(socket.id);

      console.log(`[Socket] ${playerId} disconnected`);

      for (const room of socket.rooms) {
        if (room !== socket.id) {
          io.to(room).emit('playerDisconnected', { playerId });
        }
      }

      // Schedule bot takeover if player is in an active game
      const game = findGameForPlayer(playerId, ns);
      if (game) {
        const timeout = setTimeout(() => {
          const currentGame = ns.games.get(game.id);
          if (!currentGame || currentGame.status !== 'playing') return;
          if (ns.playerToSocket.has(playerId)) return; // player reconnected

          const updatedGame = {
            ...currentGame,
            players: currentGame.players.map(p =>
              p.id === playerId ? { ...p, isBot: true } : p
            ),
          };
          ns.games.set(game.id, updatedGame);
          ns.pendingBotTakeovers.delete(playerId);

          const takenOverPlayer = updatedGame.players.find(p => p.id === playerId);
          console.log(`[AI] Bot takeover for disconnected player ${takenOverPlayer?.username ?? playerId}`);

          // If it's currently their turn, schedule AI move
          const currentTurnId = updatedGame.playOrder[updatedGame.currentPlayerIndex];
          if (currentTurnId === playerId) {
            scheduleNextAITurnIfNeeded(updatedGame, io, ns);
          }
        }, BOT_TAKEOVER_DELAY_MS);

        ns.pendingBotTakeovers.set(playerId, timeout);
      }
    }
  } catch (error) {
    console.error('[Socket] Disconnect error:', error);
  }
}

function handleReconnectSession(
  socket: Socket,
  data: { sessionId: string; gameId: string },
  callback: Function,
  io: Server,
  ns: PoopyheadNamespace
) {
  try {
    const session = getSession(data.sessionId);
    if (!session) return callback({ success: false, reason: 'SESSION_NOT_FOUND' });

    const game = ns.games.get(data.gameId);
    if (!game) return callback({ success: false, reason: 'GAME_NOT_FOUND' });

    const recoveryResult = handleReconnect(data.sessionId, socket.id);
    if (!recoveryResult.recovered) return callback({ success: false, reason: recoveryResult.reason });

    // Cancel pending bot takeover
    const pendingTakeover = ns.pendingBotTakeovers.get(session.playerId);
    if (pendingTakeover) {
      clearTimeout(pendingTakeover);
      ns.pendingBotTakeovers.delete(session.playerId);
    }

    // Un-bot the player if takeover already fired
    const currentGame = ns.games.get(data.gameId);
    if (currentGame) {
      const updatedGame = {
        ...currentGame,
        players: currentGame.players.map(p =>
          p.id === session.playerId ? { ...p, isBot: false } : p
        ),
      };
      ns.games.set(data.gameId, updatedGame);
    }

    ns.playerToSocket.set(session.playerId, socket.id);
    ns.socketToPlayer.set(socket.id, session.playerId);

    socket.join(`lobby:${session.lobbyCode}`);
    socket.join(`game:${session.gameId}`);

    io.to(`lobby:${session.lobbyCode}`).emit('playerReconnected', {
      playerId: session.playerId,
      gameId: session.gameId,
    });

    callback({
      success: true,
      session: recoveryResult.session,
      game: ns.games.get(data.gameId),
    });

    console.log(`[Reconnect] ${session.playerId} recovered in game ${data.gameId}`);
  } catch (error) {
    callback({ success: false, reason: 'ERROR', error: (error as Error).message });
  }
}
