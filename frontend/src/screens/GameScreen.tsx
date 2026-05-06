/**
 * Game Screen
 *
 * Layout (mobile portrait):
 *   - Opponents zone (top / sides)
 *   - Center board: discard pile + draw deck
 *   - Your table cards (visible + blind)
 *   - Your hand (scrollable row, fixed bottom)
 *   - Action controls
 */

import React, { useState } from 'react';
import { useGameStore } from '../store';
import { playCards } from '../socketClient';
import Card from '../components/Card';
import PileDisplay from '../components/PileDisplay';
import './GameScreen.css';
import type { GameCard, LobbyPlayer } from '../types/game';

/* ── Helpers ────────────────────────────────── */

/** Number of face-down placeholder cards for an opponent's hand count */
function faceDownCount(cardsRemaining: number | undefined): number {
  return Math.min(cardsRemaining ?? 3, 7);
}

export function GameScreen(): React.ReactElement {
  const hand              = useGameStore((s) => s.hand);
  const tableCards        = useGameStore((s) => s.tableCards);
  const blindCards        = useGameStore((s) => s.blindCards);
  const playPile          = useGameStore((s) => s.playPile);
  const playableCards     = useGameStore((s) => s.playableCards);
  const currentPlayerUsername = useGameStore((s) => s.currentPlayerUsername);
  const gameId            = useGameStore((s) => s.gameId);
  const currentPlayerId   = useGameStore((s) => s.currentPlayerId);
  const lobbyPlayers      = useGameStore((s) => s.lobbyPlayers);

  const [selectedCards, setSelectedCards] = useState<string[]>([]);

  const you      = lobbyPlayers.find((p: LobbyPlayer) => p.id === currentPlayerId);
  const opponents = lobbyPlayers.filter((p: LobbyPlayer) => p.id !== currentPlayerId);
  const topPileCard = playPile.length > 0 ? playPile[playPile.length - 1] : null;
  const isYourTurn = !!you && currentPlayerUsername === you.username;

  const handleSelectCard = (cardId: string): void => {
    if (!playableCards.includes(cardId)) return;
    setSelectedCards((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  const handlePlayCards = async (): Promise<void> => {
    if (selectedCards.length === 0 || !gameId || !currentPlayerId) return;
    await playCards(gameId, currentPlayerId, selectedCards);
    setSelectedCards([]);
  };

  /* Split opponents for layout: top-row vs side opponents */
  const topOpponents  = opponents.slice(0, 3);
  const sideOpponents = opponents.slice(3);

  return (
    <div className="game-screen">

      {/* ── Turn Banner ──────────────────────────── */}
      <div className={`gs-turn-banner ${isYourTurn ? 'gs-turn-banner--you' : ''}`}>
        <span className="gs-turn-label">
          {isYourTurn ? 'Your Turn' : `${currentPlayerUsername || '—'}'s Turn`}
        </span>
        {isYourTurn && <span className="gs-turn-dot" aria-hidden="true" />}
      </div>

      {/* ── Opponents Top ────────────────────────── */}
      {topOpponents.length > 0 && (
        <div className="gs-opponents-row" role="list" aria-label="Opponents">
          {topOpponents.map((player: LobbyPlayer) => {
            const isActive = currentPlayerUsername === player.username;
            return (
              <div
                key={player.id}
                className={`gs-opponent ${isActive ? 'gs-opponent--active' : ''}`}
                role="listitem"
              >
                <div className="gs-opponent-cards" aria-hidden="true">
                  {Array.from({ length: faceDownCount(player.cardsRemaining) }).map((_, i) => (
                    <Card
                      key={i}
                      faceDown
                      size="xs"
                      className="gs-opponent-card"
                      style={{ transform: `translateX(${i * -10}px) rotate(${(i - 1) * 3}deg)` }}
                    />
                  ))}
                </div>
                <div className={`gs-opponent-label ${isActive ? 'gs-opponent-label--active' : ''}`}>
                  {isActive && <span className="gs-active-dot" aria-hidden="true" />}
                  <span className="gs-opponent-name">{player.username}</span>
                  <span className="gs-opponent-count">{player.cardsRemaining ?? '?'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Side opponents (5-6 player games) ───── */}
      {sideOpponents.length > 0 && (
        <div className="gs-side-opponents" aria-label="Additional opponents">
          {sideOpponents.map((player: LobbyPlayer) => {
            const isActive = currentPlayerUsername === player.username;
            return (
              <div key={player.id} className={`gs-side-opponent ${isActive ? 'gs-opponent--active' : ''}`}>
                <span className="gs-opponent-name">{player.username}</span>
                <span className="gs-opponent-count">{player.cardsRemaining ?? '?'}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Center Board ─────────────────────────── */}
      <div className="gs-board">
        <div className="gs-center">
          <PileDisplay
            title="Discard"
            count={playPile.length}
            topCard={topPileCard}
          />
          <PileDisplay
            title="Draw"
            count={0}
            isDeck
          />
        </div>
      </div>

      {/* ── Player's Table Cards ─────────────────── */}
      <div className="gs-table-zone">
        {tableCards.length > 0 && (
          <div className="gs-table-section">
            <div className="gs-zone-label">Table</div>
            <div className="gs-table-cards">
              {tableCards.map((card: GameCard, i: number) => (
                <Card
                  key={card.id}
                  rank={card.rank}
                  suit={card.suit}
                  size="sm"
                  className="animate-slide-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {blindCards.length > 0 && (
          <div className="gs-table-section">
            <div className="gs-zone-label">Blind</div>
            <div className="gs-table-cards">
              {blindCards.map((_, i: number) => (
                <Card
                  key={i}
                  faceDown
                  size="sm"
                  className="animate-slide-up"
                  style={{ animationDelay: `${i * 30}ms` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Your Hand ────────────────────────────── */}
      <div className="gs-hand-zone">
        <div className="gs-hand-header">
          <span className="gs-zone-label">Hand</span>
          <span className="gs-hand-count">{hand.length} cards</span>
        </div>
        <div className="gs-hand-cards" role="group" aria-label="Your cards">
          {hand.length === 0 ? (
            <p className="gs-hand-empty">No cards in hand</p>
          ) : (
            hand.map((card: GameCard, i: number) => {
              const playable = playableCards.includes(card.id);
              const selected = selectedCards.includes(card.id);
              return (
                <Card
                  key={card.id}
                  rank={card.rank}
                  suit={card.suit}
                  size="md"
                  selected={selected}
                  disabled={!playable}
                  onClick={() => handleSelectCard(card.id)}
                  className="gs-hand-card animate-slide-up"
                  style={{ animationDelay: `${i * 20}ms` }}
                  aria-label={`${card.rank} of ${card.suit}${selected ? ', selected' : ''}${!playable ? ', not playable' : ''}`}
                />
              );
            })
          )}
        </div>
      </div>

      {/* ── Controls ─────────────────────────────── */}
      <div className="gs-controls">
        <button
          className="gs-btn gs-btn--secondary"
          disabled
          aria-label="Pick up pile"
        >
          Pick Up
        </button>
        <button
          className={`gs-btn gs-btn--primary ${selectedCards.length > 0 ? 'gs-btn--active' : ''}`}
          onClick={handlePlayCards}
          disabled={selectedCards.length === 0 || !isYourTurn}
          aria-label={`Play ${selectedCards.length} selected card${selectedCards.length !== 1 ? 's' : ''}`}
        >
          {selectedCards.length > 0 ? `Play ${selectedCards.length}` : 'Play'}
        </button>
      </div>

    </div>
  );
}

export default GameScreen;
