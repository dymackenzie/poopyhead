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
