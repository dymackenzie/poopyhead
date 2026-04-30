/**
 * Socket.io Event Handlers
 *
 * Handles all real-time communication:
 * - Lobby creation/joining
 * - Game start
 * - Card plays
 * - State broadcasts
 */
import { createLobby, addPlayerToLobby, setPlayerReady, canStartGame, updateLobbyStatus, } from '../services/LobbyManager.js';
import { createGame, processPlayCardAction, checkGameEnd, endGame, } from '../services/GameManager.js';
/**
 * Creates and registers socket event handlers.
 */
export function setupSocketHandlers(io, ns) {
    io.on('connection', (socket) => {
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
        // GAME: Play cards
        socket.on('playCard', (data, callback) => {
            handlePlayCard(socket, data, callback, io, ns);
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
function handleCreateLobby(socket, data, callback, io, ns) {
    try {
        const isGuest = !data.userId;
        const lobby = createLobby(data.userId || 'guest_' + socket.id, data.username, isGuest, socket.id, { bombEnabled: data.bombEnabled, turnTimerSeconds: data.turnTimerSeconds });
        ns.lobbies.set(lobby.code, lobby);
        const playerId = lobby.players[0].id;
        ns.playerToSocket.set(playerId, socket.id);
        ns.socketToPlayer.set(socket.id, playerId);
        socket.join(`lobby:${lobby.code}`);
        callback({ success: true, lobby, playerId });
        socket.to(`lobby:${lobby.code}`).emit('playerJoined', {
            username: data.username,
            playerCount: lobby.players.length,
        });
        console.log(`[Lobby] ${data.username} created lobby ${lobby.code}`);
    }
    catch (error) {
        callback({ success: false, reason: 'ERROR', error: error.message });
    }
}
/**
 * Handle: Join lobby by code
 */
function handleJoinLobby(socket, data, callback, io, ns) {
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
        const updatedLobby = result.updatedLobby;
        ns.lobbies.set(data.code, updatedLobby);
        const playerId = result.playerId;
        ns.playerToSocket.set(playerId, socket.id);
        ns.socketToPlayer.set(socket.id, playerId);
        socket.join(`lobby:${data.code}`);
        callback({ success: true, lobby: updatedLobby, playerId });
        io.to(`lobby:${data.code}`).emit('playerJoined', {
            username: data.username,
            playerCount: updatedLobby.players.length,
        });
        console.log(`[Lobby] ${data.username} joined lobby ${data.code}`);
    }
    catch (error) {
        callback({ success: false, reason: 'ERROR', error: error.message });
    }
}
/**
 * Handle: Set player ready
 */
function handleSetReady(socket, data, callback, io, ns) {
    try {
        const lobby = ns.lobbies.get(data.code);
        if (!lobby)
            return callback({ success: false, reason: 'LOBBY_NOT_FOUND' });
        const updatedLobby = setPlayerReady(lobby, data.playerId, data.ready);
        ns.lobbies.set(data.code, updatedLobby);
        callback({ success: true, lobby: updatedLobby });
        io.to(`lobby:${data.code}`).emit('playerReady', {
            playerId: data.playerId,
            ready: data.ready,
            canStart: canStartGame(updatedLobby),
        });
        console.log(`[Lobby] ${data.playerId} set ready=${data.ready}`);
    }
    catch (error) {
        callback({ success: false, reason: 'ERROR', error: error.message });
    }
}
/**
 * Handle: Start game
 */
function handleStartGame(socket, data, callback, io, ns) {
    try {
        const lobby = ns.lobbies.get(data.code);
        if (!lobby)
            return callback({ success: false, reason: 'LOBBY_NOT_FOUND' });
        // Only creator can start
        const senderPlayerId = ns.socketToPlayer.get(socket.id);
        if (lobby.createdBy !== senderPlayerId && lobby.players[0]?.id !== senderPlayerId) {
            return callback({ success: false, reason: 'NOT_LOBBY_CREATOR' });
        }
        const game = createGame({
            lobbyCode: data.code,
            players: lobby.players.map((p) => ({
                id: p.id,
                username: p.username,
                poopyheadCount: 0, // TODO: Fetch from database
            })),
            settings: lobby.settings,
            direction: data.direction,
        });
        ns.games.set(game.id, game);
        // Update lobby status
        const updatedLobby = updateLobbyStatus(lobby, 'playing', game.id);
        ns.lobbies.set(data.code, updatedLobby);
        callback({ success: true, game });
        io.to(`lobby:${data.code}`).emit('gameStarted', {
            gameId: game.id,
            currentPlayer: game.players[game.currentPlayerIndex],
            playPile: game.playPile,
        });
        console.log(`[Game] ${data.code} started game ${game.id}`);
    }
    catch (error) {
        callback({ success: false, reason: 'ERROR', error: error.message });
    }
}
/**
 * Handle: Play card
 */
function handlePlayCard(socket, data, callback, io, ns) {
    try {
        const game = ns.games.get(data.gameId);
        if (!game)
            return callback({ success: false, reason: 'GAME_NOT_FOUND' });
        const actionResult = processPlayCardAction({
            game,
            playerId: data.playerId,
            cardIds: data.cardIds,
        });
        if (!actionResult.success) {
            return callback({ success: false, reason: actionResult.reason });
        }
        const updatedGame = actionResult.updatedGame;
        ns.games.set(data.gameId, updatedGame);
        // Check for game end
        const endCheck = checkGameEnd(updatedGame);
        if (endCheck.ended) {
            const finalGame = endGame(updatedGame, endCheck.loserId);
            ns.games.set(data.gameId, finalGame);
            io.to(`lobby:${game.lobbyCode}`).emit('gameEnded', {
                loserId: endCheck.loserId,
                loserUsername: updatedGame.players.find((p) => p.id === endCheck.loserId)?.username,
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
    }
    catch (error) {
        callback({ success: false, reason: 'ERROR', error: error.message });
    }
}
/**
 * Handle: Disconnect
 */
function handleDisconnect(socket, io, ns) {
    try {
        const playerId = ns.socketToPlayer.get(socket.id);
        if (playerId) {
            ns.playerToSocket.delete(playerId);
            ns.socketToPlayer.delete(socket.id);
            console.log(`[Socket] ${playerId} disconnected`);
            // Notify lobby/game of disconnection
            io.emit('playerDisconnected', { playerId });
        }
    }
    catch (error) {
        console.error('[Socket] Disconnect error:', error);
    }
}
//# sourceMappingURL=gameHandlers.js.map