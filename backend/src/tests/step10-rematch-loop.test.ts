/**
 * Step 10: Rematch Loop
 * 
 * Tests for rematch functionality:
 * - Reset lobby for rematch
 * - Create new game with same players
 * - Determine first player based on previous Poopyhead
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createLobby,
  addPlayerToLobby,
  setPlayerReady,
  updateLobbyStatus,
  resetLobbyForRematch,
} from '../services/LobbyManager';
import {
  createGame,
  prepareRematch,
  endGame,
} from '../services/GameManager';

describe('Step 10: Rematch Loop', () => {
  describe('Lobby Reset for Rematch', () => {
    it('should reset lobby status to waiting', () => {
      let lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 30,
      });

      const result = addPlayerToLobby({
        lobby,
        userId: 'user2',
        username: 'Bob',
        isGuest: false,
        socketId: 'socket2',
      });

      lobby = result.updatedLobby!;
      
      // Mark as playing with game
      lobby = updateLobbyStatus(lobby, 'playing', 'game123');
      expect(lobby.status).toBe('playing');

      // Reset for rematch
      const rematchLobby = resetLobbyForRematch(lobby);
      
      expect(rematchLobby.status).toBe('waiting');
      expect(rematchLobby.currentGameId).toBeUndefined();
      expect(rematchLobby.players).toHaveLength(2);
    });

    it('should reset player ready status', () => {
      let lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 30,
      });

      const result = addPlayerToLobby({
        lobby,
        userId: 'user2',
        username: 'Bob',
        isGuest: false,
        socketId: 'socket2',
      });

      lobby = result.updatedLobby!;

      // Mark both ready
      for (const player of lobby.players) {
        lobby = setPlayerReady(lobby, player.id, true);
      }

      // Verify ready
      lobby.players.forEach(p => expect(p.ready).toBe(true));

      // Reset for rematch
      const rematchLobby = resetLobbyForRematch(lobby);

      // Verify not ready
      rematchLobby.players.forEach(p => expect(p.ready).toBe(false));
    });

    it('should keep all players in rematch lobby', () => {
      let lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 30,
      });

      // Add 3 more players
      for (let i = 2; i <= 4; i++) {
        const result = addPlayerToLobby({
          lobby,
          userId: `user${i}`,
          username: `Player${i}`,
          isGuest: false,
          socketId: `socket${i}`,
        });
        lobby = result.updatedLobby!;
      }

      expect(lobby.players).toHaveLength(4);

      const rematchLobby = resetLobbyForRematch(lobby);
      expect(rematchLobby.players).toHaveLength(4);
      
      // Verify same usernames
      const originalUsernames = lobby.players.map(p => p.username).sort();
      const rematchUsernames = rematchLobby.players.map(p => p.username).sort();
      expect(rematchUsernames).toEqual(originalUsernames);
    });
  });

  describe('Rematch Game Creation', () => {
    it('should create new game with same players', () => {
      let lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 30,
      });

      const result = addPlayerToLobby({
        lobby,
        userId: 'user2',
        username: 'Bob',
        isGuest: false,
        socketId: 'socket2',
      });

      lobby = result.updatedLobby!;

      const game1 = createGame({
        lobbyCode: lobby.code,
        players: lobby.players.map(p => ({
          id: p.id,
          username: p.username,
          poopyheadCount: 0,
        })),
        settings: lobby.settings,
        direction: 'clockwise',
      });

      // Games start in swapping phase for table-card selection
      expect(game1.status).toBe('swapping');
      expect(game1.players).toHaveLength(2);

      // End game
      const endedGame = endGame(game1, game1.players[0].id);
      expect(endedGame.status).toBe('ended');

      // Create rematch
      const game2 = prepareRematch({
        lobbyCode: lobby.code,
        players: lobby.players.map(p => ({
          id: p.id,
          username: p.username,
          poopyheadCount: 0,
        })),
        settings: lobby.settings,
        direction: 'clockwise',
      });

      // Rematch also starts in swapping phase
      expect(game2.status).toBe('swapping');
      expect(game2.id).not.toBe(game1.id); // Different game ID
      expect(game2.players).toHaveLength(2);
      expect(game2.players.map(p => p.username).sort()).toEqual(
        game1.players.map(p => p.username).sort()
      );
    });

    it('should deal fresh cards for rematch', () => {
      let lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 30,
      });

      const result = addPlayerToLobby({
        lobby,
        userId: 'user2',
        username: 'Bob',
        isGuest: false,
        socketId: 'socket2',
      });

      lobby = result.updatedLobby!;

      const game1 = createGame({
        lobbyCode: lobby.code,
        players: lobby.players.map(p => ({
          id: p.id,
          username: p.username,
          poopyheadCount: 0,
        })),
        settings: lobby.settings,
        direction: 'clockwise',
      });

      // Get hand card IDs from game1
      const game1HandIds = new Set(game1.players[0].hand.map(c => c.id));

      // Create rematch
      const game2 = prepareRematch({
        lobbyCode: lobby.code,
        players: lobby.players.map(p => ({
          id: p.id,
          username: p.username,
          poopyheadCount: 0,
        })),
        settings: lobby.settings,
        direction: 'clockwise',
      });

      // Get hand card IDs from game2
      const game2HandIds = new Set(game2.players[0].hand.map(c => c.id));

      // Cards should be different (different deck instances)
      expect(game2HandIds).not.toEqual(game1HandIds);
    });
  });

  describe('Full Rematch Sequence', () => {
    it('should support: game1 -> end -> reset -> game2', () => {
      // 1. Create lobby with 2 players
      let lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 30,
      });

      const joinResult = addPlayerToLobby({
        lobby,
        userId: 'user2',
        username: 'Bob',
        isGuest: false,
        socketId: 'socket2',
      });

      lobby = joinResult.updatedLobby!;

      // 2. Create first game
      const game1 = createGame({
        lobbyCode: lobby.code,
        players: lobby.players.map(p => ({
          id: p.id,
          username: p.username,
          poopyheadCount: 0,
        })),
        settings: lobby.settings,
        direction: 'clockwise',
      });

      // Games start in swapping phase
      expect(game1.status).toBe('swapping');
      const loser1 = game1.players[0].id;

      // 3. End game
      const endedGame1 = endGame(game1, loser1);
      expect(endedGame1.status).toBe('ended');

      // 4. Reset lobby for rematch
      lobby = resetLobbyForRematch(lobby);
      expect(lobby.status).toBe('waiting');

      // 5. Players ready up
      for (const player of lobby.players) {
        lobby = setPlayerReady(lobby, player.id, true);
      }

      // 6. Create second game
      const game2 = prepareRematch({
        lobbyCode: lobby.code,
        players: lobby.players.map(p => ({
          id: p.id,
          username: p.username,
          poopyheadCount: game1.players.find(gp => gp.id === p.id)?.poopyheadCount || 0,
        })),
        settings: lobby.settings,
        direction: 'clockwise',
      });

      // Rematch starts in swapping phase
      expect(game2.status).toBe('swapping');
      expect(game2.id).not.toBe(game1.id);
      expect(game2.players).toHaveLength(2);
    });

    it('should update poopyhead count through rematch cycle', () => {
      let lobby = createLobby('user1', 'Alice', false, 'socket1', {
        bombEnabled: true,
        turnTimerSeconds: 30,
      });

      const result = addPlayerToLobby({
        lobby,
        userId: 'user2',
        username: 'Bob',
        isGuest: false,
        socketId: 'socket2',
      });

      lobby = result.updatedLobby!;

      // Game 1: Alice loses
      let game1 = createGame({
        lobbyCode: lobby.code,
        players: lobby.players.map(p => ({
          id: p.id,
          username: p.username,
          poopyheadCount: 0,
        })),
        settings: lobby.settings,
        direction: 'clockwise',
      });

      const aliceId = game1.players[0].id;
      game1 = endGame(game1, aliceId);

      // Reset & prepare rematch with updated counts
      lobby = resetLobbyForRematch(lobby);

      let game2 = prepareRematch({
        lobbyCode: lobby.code,
        players: lobby.players.map(p => ({
          id: p.id,
          username: p.username,
          poopyheadCount: p.id === aliceId ? 1 : 0, // Alice lost game1, so increment her count
        })),
        settings: lobby.settings,
        direction: 'clockwise',
      });

      // Game 2: Bob loses
      const bobId = game2.players[1].id;
      game2 = endGame(game2, bobId);

      // Verify counts are carried through
      const alicePoopyheadCount = game2.players.find(p => p.id === aliceId)?.poopyheadCount;
      expect(alicePoopyheadCount).toBe(1);
    });
  });
});
