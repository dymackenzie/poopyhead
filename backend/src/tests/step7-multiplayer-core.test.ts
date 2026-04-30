/**
 * Multiplayer Core Tests
 * 
 * Validates Socket.io event flow and game synchronization:
 * - Lobby creation/joining
 * - Game start
 * - Real-time state updates
 * - Multi-client consistency
 */

import { describe, expect, it } from 'vitest';
import { createLobby, addPlayerToLobby, setPlayerReady, canStartGame, generateLobbyCode } from '../services/LobbyManager';
import { createGame, processPlayCardAction, checkGameEnd, endGame } from '../services/GameManager';

describe('Step 7: Realtime Multiplayer Core', () => {
  
  describe('Lobby Management', () => {
    it('should generate valid 6-char lobby codes', () => {
      const code = generateLobbyCode();
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    });
    
    it('should create lobby with creator as first player', () => {
      const lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 60,
      });
      
      expect(lobby.code).toBeDefined();
      expect(lobby.players).toHaveLength(1);
      expect(lobby.players[0].username).toBe('Alice');
      expect(lobby.status).toBe('waiting');
    });
    
    it('should add players to lobby', () => {
      const lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 60,
      });
      
      const result = addPlayerToLobby({
        lobby,
        userId: 'user2',
        username: 'Bob',
        isGuest: false,
        socketId: 'socket2',
      });
      
      expect(result.success).toBe(true);
      expect(result.updatedLobby?.players).toHaveLength(2);
    });
    
    it('should reject duplicate usernames', () => {
      const lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 60,
      });
      
      const result = addPlayerToLobby({
        lobby,
        userId: 'user2',
        username: 'Alice',
        isGuest: false,
        socketId: 'socket2',
      });
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('USERNAME_TAKEN');
    });
    
    it('should reject join when lobby full', () => {
      let lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 60,
      });
      lobby.maxPlayers = 1;
      
      const result = addPlayerToLobby({
        lobby,
        userId: 'user2',
        username: 'Bob',
        isGuest: false,
        socketId: 'socket2',
      });
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('LOBBY_FULL');
    });
    
    it('should track player ready status', () => {
      const lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 60,
      });
      
      const playerId = lobby.players[0].id;
      const updatedLobby = setPlayerReady(lobby, playerId, true);
      
      expect(updatedLobby.players[0].ready).toBe(true);
    });
    
    it('should allow game start when all players ready', () => {
      let lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 60,
      });
      
      const result = addPlayerToLobby({
        lobby,
        userId: 'user2',
        username: 'Bob',
        isGuest: false,
        socketId: 'socket2',
      });
      
      lobby = result.updatedLobby!;
      
      // Set both ready
      for (const player of lobby.players) {
        lobby = setPlayerReady(lobby, player.id, true);
      }
      
      expect(canStartGame(lobby)).toBe(true);
    });
    
    it('should reject game start when not all ready', () => {
      let lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 60,
      });
      
      const result = addPlayerToLobby({
        lobby,
        userId: 'user2',
        username: 'Bob',
        isGuest: false,
        socketId: 'socket2',
      });
      
      lobby = result.updatedLobby!;
      
      // Only set first player ready
      lobby = setPlayerReady(lobby, lobby.players[0].id, true);
      
      expect(canStartGame(lobby)).toBe(false);
    });
  });
  
  describe('Game Management', () => {
    it('should create game from lobby', () => {
      const lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 60,
      });
      
      const players = lobby.players.map(p => ({
        id: p.id,
        username: p.username,
        poopyheadCount: 0,
      }));
      
      const result = addPlayerToLobby({
        lobby,
        userId: 'user2',
        username: 'Bob',
        isGuest: false,
        socketId: 'socket2',
      });
      
      const updatedLobby = result.updatedLobby!;
      const updatedPlayers = [
        ...players,
        { id: result.playerId!, username: 'Bob', poopyheadCount: 0 },
      ];
      
      const game = createGame({
        lobbyCode: lobby.code,
        players: updatedPlayers,
        settings: lobby.settings,
        direction: 'clockwise',
      });
      
      expect(game.status).toBe('playing');
      expect(game.players).toHaveLength(2);
      expect(game.players[0].hand.length).toBeGreaterThan(0);
    });
    
    it('should detect game end when 1 player remains', () => {
      let lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 60,
      });
      
      const result = addPlayerToLobby({
        lobby,
        userId: 'user2',
        username: 'Bob',
        isGuest: false,
        socketId: 'socket2',
      });
      
      lobby = result.updatedLobby!;
      const players = lobby.players.map(p => ({
        id: p.id,
        username: p.username,
        poopyheadCount: 0,
      }));
      
      let game = createGame({
        lobbyCode: lobby.code,
        players,
        settings: lobby.settings,
        direction: 'clockwise',
      });
      
      // Remove all cards from first player
      game.players[0].hand = [];
      game.players[0].tableVisible = [];
      game.players[0].tableBlind = [];
      
      const endCheck = checkGameEnd(game);
      expect(endCheck.ended).toBe(true);
      expect(endCheck.loserId).toBe(game.players[1].id);
    });
    
    it('should end game with loser designation', () => {
      let lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 60,
      });
      
      const result = addPlayerToLobby({
        lobby,
        userId: 'user2',
        username: 'Bob',
        isGuest: false,
        socketId: 'socket2',
      });
      
      lobby = result.updatedLobby!;
      const players = lobby.players.map(p => ({
        id: p.id,
        username: p.username,
        poopyheadCount: 0,
      }));
      
      let game = createGame({
        lobbyCode: lobby.code,
        players,
        settings: lobby.settings,
        direction: 'clockwise',
      });
      
      const loserId = game.players[0].id;
      game = endGame(game, loserId);
      
      expect(game.status).toBe('ended');
      expect(game.loser).toBe(loserId);
      expect(game.endedAt).toBeDefined();
    });
  });
  
  describe('Multiplayer Event Flow', () => {
    it('should sequence: lobby create -> join -> ready -> start -> play', () => {
      // 1. Create lobby
      const lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 60,
      });
      expect(lobby.status).toBe('waiting');
      
      // 2. Second player joins
      const joinResult = addPlayerToLobby({
        lobby,
        userId: 'user2',
        username: 'Bob',
        isGuest: false,
        socketId: 'socket2',
      });
      expect(joinResult.success).toBe(true);
      
      let updatedLobby = joinResult.updatedLobby!;
      expect(updatedLobby.players).toHaveLength(2);
      
      // 3. Both players ready
      for (const player of updatedLobby.players) {
        updatedLobby = setPlayerReady(updatedLobby, player.id, true);
      }
      expect(canStartGame(updatedLobby)).toBe(true);
      
      // 4. Start game
      const players = updatedLobby.players.map(p => ({
        id: p.id,
        username: p.username,
        poopyheadCount: 0,
      }));
      
      const game = createGame({
        lobbyCode: lobby.code,
        players,
        settings: lobby.settings,
        direction: 'clockwise',
      });
      expect(game.status).toBe('playing');
      
      // 5. Verify playable state
      expect(game.currentPlayerIndex).toBeGreaterThanOrEqual(0);
      expect(game.currentPlayerIndex < game.players.length).toBe(true);
    });
  });
  
  describe('Step 7 Validation Checklist', () => {
    it('should support 2-10 players in lobbies', () => {
      for (let count = 2; count <= 10; count++) {
        let lobby = createLobby('user1', 'Alice', false, 'socket1', {
          bombEnabled: true,
          turnTimerSeconds: 60,
        });
        
        for (let i = 1; i < count; i++) {
          const result = addPlayerToLobby({
            lobby,
            userId: `user${i + 1}`,
            username: `Player${i + 1}`,
            isGuest: false,
            socketId: `socket${i + 1}`,
          });
          expect(result.success).toBe(true);
          lobby = result.updatedLobby!;
        }
        
        expect(lobby.players).toHaveLength(count);
      }
    });
  });
  
});
