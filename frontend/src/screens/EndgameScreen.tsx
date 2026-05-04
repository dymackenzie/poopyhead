/**
 * Endgame Screen Component
 */

import React from 'react';
import { useGameStore } from '../store';
import Button from '../components/Button';
import './EndgameScreen.css';
import type { GamePlayer } from '../store';

export function EndgameScreen(): React.ReactElement {
  const gameStatus = useGameStore((state) => state.gameStatus);
  const lobbyPlayers = useGameStore((state) => state.lobbyPlayers);

  const standings = [...lobbyPlayers].sort((a: GamePlayer, b: GamePlayer) => {
    const aCards = a.cardsRemaining ?? Number.MAX_SAFE_INTEGER;
    const bCards = b.cardsRemaining ?? Number.MAX_SAFE_INTEGER;
    return aCards - bCards;
  });

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
            <p className="endgame-kicker">Round Complete</p>
            <h1 className="animate-slide-up">Game Over</h1>
            <p className="loser-text">Review the final table and jump into a rematch.</p>

            {standings.length > 0 && (
              <div className="standings">
                <div className="standings-header">
                  <span>Player</span>
                  <span>Cards</span>
                </div>
                {standings.map((player: GamePlayer) => (
                  <div key={player.id} className="standings-row animate-slide-in">
                    <span>{player.username}</span>
                    <span>{player.cardsRemaining ?? '-'}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="button-group">
              <Button variant="primary" onClick={handleRematch}>
                Play Again
              </Button>
              <Button variant="secondary" onClick={handleExit}>
                Exit
              </Button>
            </div>
          </>
        )}

        {gameStatus === 'rematch' && (
          <>
            <h2>Starting Rematch...</h2>
            <div className="spinner" aria-label="Loading rematch"></div>
          </>
        )}
      </div>
    </div>
  );
}

export default EndgameScreen;
