import React from 'react';
import { useGameStore } from '../store';
import { requestRematch } from '../socketClient';
import Button from '../components/Button';
import Card from '../components/Card';
import Avatar from '../components/Avatar';
import './EndgameScreen.css';
import type { GamePlayer } from '../store';

export function EndgameScreen(): React.ReactElement {
  const gameStatus      = useGameStore((s) => s.gameStatus);
  const lobbyPlayers    = useGameStore((s) => s.lobbyPlayers);
  const currentPlayerId = useGameStore((s) => s.currentPlayerId);
  const lobbyCode       = useGameStore((s) => s.lobbyCode);
  const loserId         = useGameStore((s) => s.loserId);
  const loserTableCards = useGameStore((s) => s.loserTableCards);
  const loserBlindCards = useGameStore((s) => s.loserBlindCards);

  const loser     = lobbyPlayers.find((p: GamePlayer) => p.id === loserId);
  const isYouLoser = loserId === currentPlayerId;

  const handleRematch = async (): Promise<void> => {
    if (!lobbyCode) return;
    useGameStore.setState({ gameStatus: 'rematch' });
    const result = await requestRematch(lobbyCode) as any;
    if (!result?.success) {
      useGameStore.setState({ gameStatus: 'ended' });
    }
  };

  const handleExit = (): void => {
    useGameStore.setState({
      gameStatus: 'lobby',
      lobbyCode: undefined,
      gameId: undefined,
      loserId: undefined,
      loserTableCards: [],
      loserBlindCards: [],
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

  const hasLoserCards = loserTableCards.length > 0 || loserBlindCards.length > 0;

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

        {/* Players */}
        {lobbyPlayers.length > 0 && (
          <div className="endgame-players">
            <div className="endgame-section-label">Players</div>
            <div className="endgame-players-list">
              {lobbyPlayers.map((player: GamePlayer) => {
                const isLoser = player.id === loserId;
                const isMe    = player.id === currentPlayerId;
                return (
                  <div
                    key={player.id}
                    className={[
                      'endgame-player-row',
                      isLoser ? 'endgame-player-row--loser' : '',
                      isMe    ? 'endgame-player-row--me'    : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="endgame-player-main">
                      <Avatar slug={player.avatar} size={36} alt="" />
                      <span className="endgame-player-name">
                        {player.username}
                        {isMe && <span className="endgame-you-tag">you</span>}
                      </span>
                    </div>
                    {isLoser && (
                      <span className="endgame-poop-badge" aria-hidden="true">&#128169;</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Loser's remaining cards */}
        {hasLoserCards && (
          <div className="endgame-loser-cards">
            <div className="endgame-section-label">
              {isYouLoser ? 'Your' : `${loser?.username ?? 'Their'}`} remaining cards
            </div>

            {loserTableCards.length > 0 && (
              <div className="endgame-card-group">
                <div className="endgame-card-group-label">Table cards</div>
                <div className="endgame-card-row">
                  {loserTableCards.map((card) => (
                    <Card key={card.id} rank={card.rank} suit={card.suit} size="sm" />
                  ))}
                </div>
              </div>
            )}

            {loserBlindCards.length > 0 && (
              <div className="endgame-card-group">
                <div className="endgame-card-group-label">Blind cards — revealed</div>
                <div className="endgame-card-row">
                  {loserBlindCards.map((card) => (
                    <Card key={card.id} rank={card.rank} suit={card.suit} size="sm" />
                  ))}
                </div>
              </div>
            )}
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
