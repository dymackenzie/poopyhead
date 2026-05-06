/**
 * Main App Component
 */

import React, { useEffect } from 'react';
import { useGameStore } from './store';
import { initSocket } from './socketClient';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import EndgameScreen from './screens/EndgameScreen';
import './App.css';
import type { GamePlayer } from './store';
import type { LobbyResponse, PlayerJoinedPayload, PlayerReadyPayload } from './types/game';

export function App(): React.ReactElement {
  const gameStatus = useGameStore((state) => state.gameStatus);
  const connect = useGameStore((state) => state.connect);
  const updateGameState = useGameStore((state) => state.updateGameState);
  const currentPlayerId = useGameStore((state) => state.currentPlayerId);

  useEffect(() => {
    // Initialize socket connection
    initSocket({
      onConnect: () => {
        connect();
      },
      onPlayerJoined: (data: PlayerJoinedPayload) => {
        if (data?.lobby) {
          updateGameState({ lobbyPlayers: data.lobby.players, lobbyCode: data.lobby.code });
        }
      },
      onPlayerReady: (data: PlayerReadyPayload) => {
        if (data?.lobby) {
          updateGameState({ lobbyPlayers: data.lobby.players, lobbyCode: data.lobby.code, canStartGame: data.canStart ?? false });
        } else if (data?.playerId) {
          // fallback: update single player's ready flag
          useGameStore.setState((state) => ({
            lobbyPlayers: state.lobbyPlayers.map((player: GamePlayer) => (player.id === data.playerId ? { ...player, ready: data.ready } : player)),
            canStartGame: data.canStart ?? state.canStartGame,
          }));
        }
      },
      onLobbyCreated: (data: LobbyResponse) => {
        if (data.lobby) {
          updateGameState({ lobbyPlayers: data.lobby.players, lobbyCode: data.lobby.code });
        }
      },
      onGameStarted: (data) => {
        const dataAny = data as any;
        if (dataAny?.game) {
          const game = dataAny.game as any;
          const me = game.players.find((p: any) => p.id === currentPlayerId);
          const lobbyPlayers = game.players.map((p: any) => ({ id: p.id, username: p.username, ready: true }));

          updateGameState({
            gameStatus: 'playing',
            gameId: game.id,
            playPile: game.playPile,
            hand: me?.hand || [],
            tableCards: me?.tableVisible || [],
            blindCards: me?.tableBlind || [],
            lobbyPlayers,
          });
        } else {
          updateGameState({ gameStatus: 'playing', ...data });
        }
      },
      onCardPlayed: (data) => {
        updateGameState(data);
      },
    });
  }, []);

  return (
    <div className="app">
      {gameStatus === 'lobby' && <LobbyScreen />}
      {gameStatus === 'playing' && <GameScreen />}
      {(gameStatus === 'ended' || gameStatus === 'rematch') && <EndgameScreen />}
    </div>
  );
}

export default App;
