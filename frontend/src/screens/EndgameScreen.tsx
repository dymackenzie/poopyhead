/**
 * Endgame Screen Component
 */

import React from 'react';
import { useGameStore } from '../store';
import './EndgameScreen.css';

export function EndgameScreen(): React.ReactElement {
  const gameStatus = useGameStore((state: any) => state.gameStatus);

  const handleRematch = (): void => {
    useGameStore.setState({ gameStatus: 'rematch' });
  };

  const handleExit = (): void => {
    useGameStore.setState({ gameStatus: 'lobby' });
  };

  return (
    <div className="endgame-screen">
      <div className="endgame-card">
        {gameStatus === 'ended' && (
          <>
            <h1>🎉 Game Over!</h1>
            <p className="loser-text">Better luck next time!</p>
            <div className="button-group">
              <button className="button button-primary" onClick={handleRematch}>
                Play Again
              </button>
              <button className="button button-secondary" onClick={handleExit}>
                Exit
              </button>
            </div>
          </>
        )}

        {gameStatus === 'rematch' && (
          <>
            <h2>Starting Rematch...</h2>
            <div className="spinner"></div>
          </>
        )}
      </div>
    </div>
  );
}

export default EndgameScreen;
