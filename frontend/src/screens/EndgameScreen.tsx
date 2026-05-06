/**
 * Endgame Screen
 */

import React from 'react';
import { useGameStore } from '../store';
import Button from '../components/Button';
import './EndgameScreen.css';
import type { GamePlayer } from '../store';

const PLACE_LABELS = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

export function EndgameScreen(): React.ReactElement {
  const gameStatus   = useGameStore((s) => s.gameStatus);
  const lobbyPlayers = useGameStore((s) => s.lobbyPlayers);
  const currentPlayerId = useGameStore((s) => s.currentPlayerId);

  const standings = [...lobbyPlayers].sort((a: GamePlayer, b: GamePlayer) => {
    const aCards = a.cardsRemaining ?? Number.MAX_SAFE_INTEGER;
    const bCards = b.cardsRemaining ?? Number.MAX_SAFE_INTEGER;
    return aCards - bCards;
  });

  const loser = standings[standings.length - 1];
  const isYouLoser = loser?.id === currentPlayerId;

  const handleRematch = (): void => {
    useGameStore.setState({ gameStatus: 'rematch' });
  };

  const handleExit = (): void => {
    useGameStore.setState({
      gameStatus: 'lobby',
      lobbyCode: undefined,
      gameId: undefined,
      hand: [],
      tableCards: [],
      blindCards: [],
      playPile: [],
      lobbyPlayers: [],
      canStartGame: false,
    });
  };

  if (gameStatus === 'rematch') {
    return (
      <div className="endgame-screen">
        <div className="endgame-panel animate-scale-in">
          <div className="endgame-spinner-wrap">
            <div className="spinner" aria-label="Starting rematch" />
          </div>
          <h2 className="endgame-rematch-title">Starting Rematch...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="endgame-screen">
      <div className="endgame-panel animate-scale-in">

        {/* Header */}
        <div className="endgame-header">
          <p className="endgame-kicker">Round Complete</p>
          <h1 className="endgame-title">Game Over</h1>
          {loser && (
            <div className={`endgame-loser-badge ${isYouLoser ? 'endgame-loser-badge--you' : ''}`}>
              <span className="endgame-loser-crown" aria-hidden="true">&#128169;</span>
              <span className="endgame-loser-name">
                {isYouLoser ? 'You are' : `${loser.username} is`} the Poopyhead
              </span>
            </div>
          )}
        </div>

        {/* Standings */}
        {standings.length > 0 && (
          <div className="endgame-standings">
            <div className="endgame-standings-title">Final Standings</div>
            <div className="endgame-standings-list">
              {standings.map((player: GamePlayer, index: number) => {
                const isLast = index === standings.length - 1;
                const isMe = player.id === currentPlayerId;
                return (
                  <div
                    key={player.id}
                    className={[
                      'endgame-row',
                      isLast ? 'endgame-row--loser' : '',
                      isMe   ? 'endgame-row--me'    : '',
                      'animate-slide-in',
                    ].filter(Boolean).join(' ')}
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <span className="endgame-row-place">{PLACE_LABELS[index] ?? `#${index + 1}`}</span>
                    <span className="endgame-row-name">
                      {player.username}
                      {isMe && <span className="endgame-you-tag">you</span>}
                    </span>
                    <span className="endgame-row-cards">
                      {isLast ? (
                        <span className="endgame-poop-badge" title="Poopyhead">&#128169;</span>
                      ) : (
                        `${player.cardsRemaining ?? 0} cards`
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="endgame-actions">
          <Button variant="primary" onClick={handleRematch}>
            Play Again
          </Button>
          <Button variant="secondary" onClick={handleExit}>
            Exit to Menu
          </Button>
        </div>

      </div>
    </div>
  );
}

export default EndgameScreen;
