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

export function App(): React.ReactElement {
  const gameStatus = useGameStore((state: any) => state.gameStatus);
  const connect = useGameStore((state: any) => state.connect);
  const updateGameState = useGameStore((state: any) => state.updateGameState);

  useEffect(() => {
    // Initialize socket connection
    initSocket({
      onConnect: () => {
        connect();
      },
      onPlayerJoined: (data: Record<string, any>) => {
        if (data?.lobby) {
          updateGameState({ lobbyPlayers: data.lobby.players, lobbyCode: data.lobby.code });
        }
      },
      onPlayerReady: (data: Record<string, any>) => {
        if (data?.lobby) {
          updateGameState({ lobbyPlayers: data.lobby.players, lobbyCode: data.lobby.code, canStartGame: data.canStart ?? false });
        } else if (data?.playerId) {
          // fallback: update single player's ready flag
          useGameStore.setState((state: any) => ({
            lobbyPlayers: state.lobbyPlayers.map((p: any) => (p.id === data.playerId ? { ...p, ready: data.ready } : p)),
            canStartGame: data.canStart ?? state.canStartGame,
          }));
        }
      },
      onLobbyCreated: (data: Record<string, any>) => {
        updateGameState(data);
      },
      onGameStarted: (data: Record<string, any>) => {
        updateGameState({ gameStatus: 'playing', ...data });
      },
      onCardPlayed: (data: Record<string, any>) => {
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
