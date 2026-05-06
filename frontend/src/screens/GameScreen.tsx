/**
 * Game Screen
 *
 * Layout (mobile portrait):
 *   - Swap phase: select 3 cards from hand to place face-up, then confirm
 *   - Opponents zone (top / sides)
 *   - Center board: discard pile + draw deck
 *   - Your table cards (visible + blind)
 *   - Your hand (scrollable row, fixed bottom)
 *   - Action controls
 */

import React, { useState } from 'react';
import { useGameStore } from '../store';
import { playCards, swapCards } from '../socketClient';
import type { GameState } from '../store';
import Card from '../components/Card';
import PileDisplay from '../components/PileDisplay';
import './GameScreen.css';
import type { GameCard, LobbyPlayer } from '../types/game';

/* ── Helpers ────────────────────────────────── */

/** Number of face-down placeholder cards for an opponent's hand count */
function faceDownCount(cardsRemaining: number | undefined): number {
  return Math.min(cardsRemaining ?? 3, 7);
}

/* ── Swap Phase UI ───────────────────────────── */

interface SwapPhaseProps {
  hand: GameCard[];
  gameId: string;
  currentPlayerId: string;
  swappedCount: number;
  totalPlayers: number;
}

function SwapPhase({ hand, gameId, currentPlayerId, swappedCount, totalPlayers }: SwapPhaseProps): React.ReactElement {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const toggleCard = (cardId: string): void => {
    if (submitted) return;
    setSelected((prev) => {
      if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, cardId];
    });
  };

  const handleConfirm = async (): Promise<void> => {
    if (selected.length !== 3 || submitted) return;
    setSubmitted(true);
    await swapCards(gameId, currentPlayerId, selected);
  };

  const waitingFor = totalPlayers - swappedCount;

  return (
    <div className="gs-swap-phase">
      <div className="gs-swap-header">
        <h2 className="gs-swap-title">Choose Your Table Cards</h2>
        <p className="gs-swap-subtitle">
          Select exactly 3 cards to place face-up on the table.
          These cards will be visible to all players.
        </p>
        {totalPlayers > 1 && (
          <p className="gs-swap-progress">
            {submitted
              ? `Waiting for ${waitingFor} other player${waitingFor !== 1 ? 's' : ''}…`
              : `${swappedCount} / ${totalPlayers} players ready`}
          </p>
        )}
      </div>

      <div className="gs-swap-cards" role="group" aria-label="Select 3 cards for your table">
        {hand.map((card: GameCard, i: number) => {
          const isSelected = selected.includes(card.id);
          const isDisabled = submitted || (!isSelected && selected.length >= 3);
          return (
            <Card
              key={card.id}
              rank={card.rank}
              suit={card.suit}
              size="md"
              selected={isSelected}
              disabled={isDisabled}
              onClick={() => toggleCard(card.id)}
              className="gs-swap-card animate-slide-up"
              style={{ animationDelay: `${i * 20}ms` }}
              aria-label={`${card.rank} of ${card.suit}${isSelected ? ', selected for table' : ''}`}
            />
          );
        })}
      </div>

      <div className="gs-swap-footer">
        <span className="gs-swap-count">{selected.length} / 3 selected</span>
        <button
          className={`gs-btn gs-btn--primary ${selected.length === 3 ? 'gs-btn--active' : ''}`}
          onClick={handleConfirm}
          disabled={selected.length !== 3 || submitted}
          aria-label="Confirm table card selection"
        >
          {submitted ? 'Waiting…' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────── */

export function GameScreen(): React.ReactElement {
  const hand              = useGameStore((s) => s.hand);
  const tableCards        = useGameStore((s) => s.tableCards);
  const blindCards        = useGameStore((s) => s.blindCards);
  const playPile          = useGameStore((s) => s.playPile);
  const currentPlayerUsername = useGameStore((s) => s.currentPlayerUsername);
  const currentTurnPlayerId   = useGameStore((s) => s.currentTurnPlayerId);
  const gameId            = useGameStore((s) => s.gameId);
  const currentPlayerId   = useGameStore((s) => s.currentPlayerId);
  const lobbyPlayers      = useGameStore((s) => s.lobbyPlayers);
  const phase             = useGameStore((s) => s.phase);
  const swappedCount      = useGameStore((s) => s.swappedCount);
  const totalPlayers      = useGameStore((s) => s.totalPlayers);

  const [selectedCards, setSelectedCards] = useState<string[]>([]);

  const opponents = lobbyPlayers.filter((p: LobbyPlayer) => p.id !== currentPlayerId);
  const topPileCard = playPile.length > 0 ? playPile[playPile.length - 1] : null;
  // Use ID comparison — more reliable than matching username strings
  const isYourTurn = !!currentPlayerId && currentTurnPlayerId === currentPlayerId;

  // Determine which zone is active for card selection
  const activeZoneIds = new Set<string>(
    hand.length > 0
      ? hand.map((c: GameCard) => c.id)
      : tableCards.length > 0
        ? tableCards.map((c: GameCard) => c.id)
        : []
  );

  const handleSelectCard = (cardId: string): void => {
    // Only allow selecting cards from the active zone
    if (!activeZoneIds.has(cardId)) return;
    setSelectedCards((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  const handlePlayCards = async (): Promise<void> => {
    if (selectedCards.length === 0 || !gameId || !currentPlayerId) return;
    const result = await playCards(gameId, currentPlayerId, selectedCards) as any;
    setSelectedCards([]);
    // Update local hand/table zones from server response
    if (result?.success && result?.game) {
      const me = result.game.players.find((p: any) => p.id === currentPlayerId);
      if (me) {
        useGameStore.getState().updateGameState({
          hand: me.hand || [],
          tableCards: me.tableVisible || [],
          blindCards: me.tableBlind || [],
        } as Partial<GameState>);
      }
    }
  };

  /* ── Swap phase: show simplified selection UI ── */
  if (phase === 'swapping' && gameId && currentPlayerId) {
    return (
      <div className="game-screen">
        <SwapPhase
          hand={hand}
          gameId={gameId}
          currentPlayerId={currentPlayerId}
          swappedCount={swappedCount}
          totalPlayers={totalPlayers}
        />
      </div>
    );
  }

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
      {blindCards.length > 0 && (
        <div className="gs-table-zone">
          <div className="gs-zone-label">Table</div>
          <div className="gs-table-stacks">
            {blindCards.map((_: GameCard, i: number) => {
              const visibleCard = tableCards[i] ?? null;
              return (
                <div key={i} className="gs-table-slot" aria-label={`Table slot ${i + 1}`}>
                  {/* Blind card — base of stack */}
                  <Card
                    faceDown
                    size="sm"
                    className="gs-table-slot__blind animate-slide-up"
                    style={{ animationDelay: `${i * 30}ms` }}
                    aria-label="Blind card"
                  />
                  {/* Visible card — rests on top of blind */}
                  {visibleCard && (
                    <Card
                      rank={visibleCard.rank}
                      suit={visibleCard.suit}
                      size="sm"
                      className="gs-table-slot__visible animate-slide-up"
                      style={{ animationDelay: `${i * 30 + 15}ms` }}
                      aria-label={`${visibleCard.rank} of ${visibleCard.suit}, table card`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              const selected = selectedCards.includes(card.id);
              return (
                <Card
                  key={card.id}
                  rank={card.rank}
                  suit={card.suit}
                  size="md"
                  selected={selected}
                  onClick={() => handleSelectCard(card.id)}
                  className="gs-hand-card animate-slide-up"
                  style={{ animationDelay: `${i * 20}ms` }}
                  aria-label={`${card.rank} of ${card.suit}${selected ? ', selected' : ''}`}
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
