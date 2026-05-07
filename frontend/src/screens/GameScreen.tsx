/**
 * Game Screen
 *
 * Layout (mobile portrait):
 *   - Swap phase: select 3 cards from hand to place face-up, then confirm
 *   - Opponents zone (top / sides)
 *   - Center board: play pile + draw deck
 *   - Your table cards (visible + blind)
 *   - Your hand (scrollable row, fixed bottom)
 *   - Action controls
 */

import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../store';
import { playCards, swapCards, pickupPile } from '../socketClient';
import type { GameState } from '../store';
import Card from '../components/Card';
import PileDisplay from '../components/PileDisplay';
import './GameScreen.css';
import type { GameCard, LobbyPlayer } from '../types/game';

/* ── Constants ──────────────────────────────── */

const WILDCARD_RANKS = ['2', '3', '10'];

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

const AUTO_PICKUP_DELAY_MS = 600;
const PILE_COUNTS_DISMISS_MS = 2500;

/* ── Helpers ────────────────────────────────── */

/** Number of face-down placeholder cards for an opponent's hand count */
function faceDownCount(cardsRemaining: number | undefined): number {
  return Math.min(cardsRemaining ?? 3, 7);
}

function rankToValue(rank: string): number {
  return RANK_VALUES[rank] ?? 0;
}

function isCardPlayable(
  card: GameCard,
  pile: GameCard[],
  constraints: { sevenOrUnder: boolean }
): boolean {
  // Wildcards are always playable
  if (WILDCARD_RANKS.includes(card.rank)) return true;

  // Empty pile: any card is playable
  if (pile.length === 0) return true;

  const topCard = pile[pile.length - 1];

  // 7-or-under constraint: must play 7 or lower
  if (constraints.sevenOrUnder) {
    return rankToValue(card.rank) <= 7;
  }

  // Normal: must be >= top card value
  return rankToValue(card.rank) >= rankToValue(topCard.rank);
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

/* ── Pile Counts Overlay ─────────────────────── */

interface PileCountsOverlayProps {
  pileCardCounts: Record<string, number>;
  onDismiss: () => void;
}

function PileCountsOverlay({ pileCardCounts, onDismiss }: PileCountsOverlayProps): React.ReactElement {
  const sortedRanks = Object.keys(pileCardCounts).sort(
    (a, b) => rankToValue(b) - rankToValue(a)
  );

  return (
    <div className="gs-pile-overlay" onClick={onDismiss} role="dialog" aria-label="Pile card breakdown">
      <div className="gs-pile-overlay-card" onClick={(e) => e.stopPropagation()}>
        <div className="gs-pile-overlay-title">Play Pile</div>
        <div className="gs-pile-overlay-list">
          {sortedRanks.map((rank) => (
            <div key={rank} className="gs-pile-overlay-row">
              <span className="gs-pile-overlay-rank">{rank}</span>
              <span className="gs-pile-overlay-count">×{pileCardCounts[rank]}</span>
            </div>
          ))}
        </div>
        <button className="gs-pile-overlay-dismiss" onClick={onDismiss} aria-label="Close">
          Done
        </button>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────── */

export function GameScreen(): React.ReactElement {
  const hand                  = useGameStore((s) => s.hand);
  const tableCards            = useGameStore((s) => s.tableCards);
  const blindCards            = useGameStore((s) => s.blindCards);
  const playPile              = useGameStore((s) => s.playPile);
  const currentPlayerUsername = useGameStore((s) => s.currentPlayerUsername);
  const currentTurnPlayerId   = useGameStore((s) => s.currentTurnPlayerId);
  const gameId                = useGameStore((s) => s.gameId);
  const currentPlayerId       = useGameStore((s) => s.currentPlayerId);
  const lobbyPlayers          = useGameStore((s) => s.lobbyPlayers);
  const phase                 = useGameStore((s) => s.phase);
  const swappedCount          = useGameStore((s) => s.swappedCount);
  const totalPlayers          = useGameStore((s) => s.totalPlayers);
  const deckCount             = useGameStore((s) => s.deckCount);
  const activeConstraints     = useGameStore((s) => s.activeConstraints);

  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [showPileCounts, setShowPileCounts] = useState(false);
  const pileCountsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to prevent double-firing of auto-pickup
  const autoPickupPendingRef = useRef(false);

  const opponents = lobbyPlayers.filter((p: LobbyPlayer) => p.id !== currentPlayerId);
  const topPileCard = playPile.length > 0 ? playPile[playPile.length - 1] : null;
  const isYourTurn = !!currentPlayerId && currentTurnPlayerId === currentPlayerId;

  // Determine which zone is active for card selection
  const activeZoneIds = new Set<string>(
    hand.length > 0
      ? hand.map((c: GameCard) => c.id)
      : tableCards.length > 0
        ? tableCards.map((c: GameCard) => c.id)
        : []
  );

  const isHandZone = hand.length > 0;

  /* Fix E — compute playability for each active zone card */
  const playableIds = new Set<string>(
    Array.from(activeZoneIds).filter((id) => {
      const card = hand.find((c) => c.id === id) ?? tableCards.find((c) => c.id === id);
      if (!card) return false;
      return isCardPlayable(card, playPile, activeConstraints);
    })
  );

  /* Fix F — auto-select same-rank cards on click (hand zone only) */
  const handleSelectCard = (cardId: string): void => {
    if (!activeZoneIds.has(cardId)) return;

    // Respect playability: don't select unplayable cards
    if (!playableIds.has(cardId) && isYourTurn) return;

    const allCards = [...hand, ...tableCards];
    const clickedCard = allCards.find((c) => c.id === cardId);
    if (!clickedCard) return;

    // For table zone, single selection only (no same-rank stacking per rules)
    if (!isHandZone) {
      setSelectedCards((prev) =>
        prev.includes(cardId) ? [] : [cardId]
      );
      return;
    }

    // Hand zone: auto-select all same-rank playable cards
    if (selectedCards.includes(cardId)) {
      // Deselect all of same rank
      setSelectedCards((prev) =>
        prev.filter((id) => {
          const c = allCards.find((card) => card.id === id);
          return c?.rank !== clickedCard.rank;
        })
      );
      return;
    }

    const sameRankIds = hand
      .filter((c) => c.rank === clickedCard.rank && activeZoneIds.has(c.id) && playableIds.has(c.id))
      .map((c) => c.id);

    setSelectedCards((prev) => {
      // Remove cards of other ranks, then add all same-rank
      const otherRanks = prev.filter((id) => {
        const c = allCards.find((card) => card.id === id);
        return c && c.rank !== clickedCard.rank;
      });
      return [...otherRanks, ...sameRankIds];
    });
  };

  const handlePlayCards = async (): Promise<void> => {
    if (selectedCards.length === 0 || !gameId || !currentPlayerId) return;
    const result = await playCards(gameId, currentPlayerId, selectedCards) as any;
    setSelectedCards([]);
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

  /* Fix G — pick up pile */
  const handlePickupPile = async (): Promise<void> => {
    if (!gameId || !currentPlayerId || !isYourTurn) return;
    const result = await pickupPile(gameId, currentPlayerId) as any;
    if (result?.success && result?.hand) {
      useGameStore.getState().updateGameState({ hand: result.hand });
    }
    setSelectedCards([]);
  };

  /* Fix G — auto-pickup when no playable cards on your turn */
  useEffect(() => {
    if (!isYourTurn || !gameId || !currentPlayerId) {
      autoPickupPendingRef.current = false;
      return;
    }

    // Only auto-pickup when hand zone is active and pile is non-empty
    if (playPile.length === 0) return;
    if (!isHandZone && hand.length === 0) return;

    const hasAnyPlayable = Array.from(activeZoneIds).some((id) => playableIds.has(id));
    if (hasAnyPlayable) {
      autoPickupPendingRef.current = false;
      return;
    }

    if (autoPickupPendingRef.current) return;
    autoPickupPendingRef.current = true;

    const timer = setTimeout(async () => {
      autoPickupPendingRef.current = false;
      // Re-check conditions right before firing to avoid stale closure issues
      const state = useGameStore.getState();
      if (state.currentTurnPlayerId !== currentPlayerId) return;
      if (state.playPile.length === 0) return;
      const result = await pickupPile(gameId, currentPlayerId) as any;
      if (result?.success && result?.hand) {
        useGameStore.getState().updateGameState({ hand: result.hand });
      }
    }, AUTO_PICKUP_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [isYourTurn, currentTurnPlayerId, playPile.length, hand.length]);

  /* Fix H — pile counts overlay auto-dismiss */
  const handleShowPileCounts = (): void => {
    if (playPile.length === 0) return;
    setShowPileCounts(true);
    if (pileCountsTimerRef.current) clearTimeout(pileCountsTimerRef.current);
    pileCountsTimerRef.current = setTimeout(() => {
      setShowPileCounts(false);
    }, PILE_COUNTS_DISMISS_MS);
  };

  const handleDismissPileCounts = (): void => {
    if (pileCountsTimerRef.current) clearTimeout(pileCountsTimerRef.current);
    setShowPileCounts(false);
  };

  const pileCardCounts = playPile.reduce<Record<string, number>>((acc, card) => {
    acc[card.rank] = (acc[card.rank] || 0) + 1;
    return acc;
  }, {});

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

      {/* ── Pile Counts Overlay ───────────────────── */}
      {showPileCounts && (
        <PileCountsOverlay
          pileCardCounts={pileCardCounts}
          onDismiss={handleDismissPileCounts}
        />
      )}

      {/* ── Turn Banner ──────────────────────────── */}
      <div className={`gs-turn-banner ${isYourTurn ? 'gs-turn-banner--you' : ''}`}>
        <span className="gs-turn-label">
          {isYourTurn ? 'Your Turn' : `${currentPlayerUsername || '—'}'s Turn`}
        </span>
        {isYourTurn && <span className="gs-turn-dot" aria-hidden="true" />}
        {activeConstraints.sevenOrUnder && (
          <span className="gs-constraint-badge" aria-label="Seven or under constraint active">
            7 or under
          </span>
        )}
      </div>

      {/* ── Opponents Top ────────────────────────── */}
      {topOpponents.length > 0 && (
        <div className="gs-opponents-row" role="list" aria-label="Opponents">
          {topOpponents.map((player: LobbyPlayer) => {
            const isActive = currentTurnPlayerId === player.id;
            const handCount = player.cardsInHand ?? player.cardsRemaining;
            const blindCount = player.tableBlindCount ?? 0;
            const visibleCards = player.tableVisible ?? [];
            return (
              <div
                key={player.id}
                className={`gs-opponent ${isActive ? 'gs-opponent--active' : ''}`}
                role="listitem"
              >
                {/* Face-down hand fan */}
                <div className="gs-opponent-cards" aria-hidden="true">
                  {Array.from({ length: faceDownCount(handCount) }).map((_, i) => (
                    <Card
                      key={i}
                      faceDown
                      size="xs"
                      className="gs-opponent-card"
                      style={{ transform: `translateX(${i * -10}px) rotate(${(i - 1) * 3}deg)` }}
                    />
                  ))}
                </div>

                {/* Table cards: blind slots with visible on top */}
                {blindCount > 0 && (
                  <div className="gs-opp-table" aria-hidden="true">
                    {Array.from({ length: blindCount }).map((_, i) => (
                      <div key={i} className="gs-opp-table-slot">
                        <Card faceDown size="xs" />
                        {visibleCards[i] && (
                          <Card
                            rank={visibleCards[i].rank}
                            suit={visibleCards[i].suit}
                            size="xs"
                            className="gs-opp-table-visible"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className={`gs-opponent-label ${isActive ? 'gs-opponent-label--active' : ''}`}>
                  {isActive && <span className="gs-active-dot" aria-hidden="true" />}
                  <span className="gs-opponent-name">{player.username}</span>
                  <span className="gs-opponent-count">{handCount ?? '?'}</span>
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
            const isActive = currentTurnPlayerId === player.id;
            return (
              <div key={player.id} className={`gs-side-opponent ${isActive ? 'gs-opponent--active' : ''}`}>
                <span className="gs-opponent-name">{player.username}</span>
                <span className="gs-opponent-count">{player.cardsInHand ?? player.cardsRemaining ?? '?'}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Center Board ─────────────────────────── */}
      <div className="gs-board">
        <div className="gs-center">
          {/* Fix A — renamed to "Play Pile" */}
          <PileDisplay
            title="Play Pile"
            count={playPile.length}
            topCard={topPileCard}
            onClick={handleShowPileCounts}
          />
          {/* Fix B — use deckCount from store */}
          <PileDisplay
            title="Draw"
            count={deckCount}
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
              const isActiveZone = !isHandZone && tableCards.length > 0;
              const isSelected = isActiveZone && visibleCard && selectedCards.includes(visibleCard.id);
              const isDisabled = !isActiveZone || !isYourTurn || (visibleCard ? !playableIds.has(visibleCard.id) : true);
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
                      selected={!!isSelected}
                      disabled={isDisabled}
                      onClick={!isDisabled ? () => handleSelectCard(visibleCard.id) : undefined}
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
              const isSelected = selectedCards.includes(card.id);
              const isPlayable = playableIds.has(card.id);
              const isDisabled = !isYourTurn || !isPlayable;
              return (
                <Card
                  key={card.id}
                  rank={card.rank}
                  suit={card.suit}
                  size="md"
                  selected={isSelected}
                  disabled={isDisabled}
                  onClick={!isDisabled ? () => handleSelectCard(card.id) : undefined}
                  className="gs-hand-card animate-slide-up"
                  style={{ animationDelay: `${i * 20}ms` }}
                  aria-label={`${card.rank} of ${card.suit}${isSelected ? ', selected' : ''}${isDisabled ? ', not playable' : ''}`}
                />
              );
            })
          )}
        </div>
      </div>

      {/* ── Controls ─────────────────────────────── */}
      <div className="gs-controls">
        {/* Fix G — Pick Up button enabled when it's your turn and pile is non-empty */}
        <button
          className="gs-btn gs-btn--secondary"
          onClick={handlePickupPile}
          disabled={!isYourTurn || playPile.length === 0}
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
