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
import { playCards, swapCards, pickupPile, debugAutoPlay } from '../socketClient';
import { pileEffectiveTop } from '../lib/pileUtils';
import type { GameState, BlindReveal } from '../store';
import Card from '../components/Card';
import PileDisplay from '../components/PileDisplay';
import Avatar from '../components/Avatar';
import './GameScreen.css';
import type { GameCard, LobbyPlayer } from '../types/game';

/* ── Constants ──────────────────────────────── */

const ALWAYS_WILDCARD_RANKS = ['2', '3']; // 10 is only wildcard when bombEnabled


const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

const AUTO_PICKUP_DELAY_MS = 600;
const PILE_COUNTS_DISMISS_MS = 2500;

// Inline blind reveal timing (ms)
const INLINE_FLIP_DELAY = 100;
const INLINE_FLIP_HALF  = 150;
const INLINE_HOLD       = 700;
const INLINE_FADE       = 300;

// Feature 12 — pickup animation lifetime
const PICKUP_ANIM_MS = 800;

// Issue 8 — bomb animation lifetime
const BOMB_ANIM_MS = 600;

// Card play animation lifetime
const CARD_PLAY_ANIM_MS = 250;

// Issue 7 — hand overflow thresholds
const HAND_COMPACT_THRESHOLD = 8;   // groups before shrinking kicks in
const HAND_CARD_W_DEFAULT = 58;     // md card width
const HAND_CARD_H_DEFAULT = 98;     // md card height + lift headroom
const HAND_CARD_W_SM = 46;          // compact card width (between sm and md)
const HAND_CARD_H_SM = 84;
const HAND_GAP_DEFAULT = 8;
const HAND_GAP_SM = 4;

// Feature 7 — natural rank sort order for hand grouping
// Wildcards (2, 3) go to the end so strategic cards cluster together
const RANK_SORT_ORDER: Record<string, number> = {
  '4': 0, '5': 1, '6': 2, '7': 3, '8': 4, '9': 5, '10': 6,
  'J': 7, 'Q': 8, 'K': 9, 'A': 10, '2': 11, '3': 12,
};

// Stagger offsets (px) for the inline style --fly-x / --fly-rot CSS vars
const FLY_CARD_OFFSETS: Array<{ x: number; rot: number; delay: number }> = [
  { x: -60, rot: -12, delay: 0   },
  { x: -30, rot: -5,  delay: 40  },
  { x:   0, rot:  2,  delay: 80  },
  { x:  30, rot:  8,  delay: 120 },
  { x:  55, rot:  15, delay: 160 },
];

/* ── Helpers ────────────────────────────────── */

/** Number of face-down placeholder cards for an opponent's hand count */
function faceDownCount(cardsRemaining: number | undefined): number {
  return Math.min(cardsRemaining ?? 3, 7);
}

function rankToValue(rank: string): number {
  return RANK_VALUES[rank] ?? 0;
}

/** Feature 7 — Group hand cards by rank, sorted by natural play order */
interface HandGroup {
  rank: string;
  cards: GameCard[];
}

function groupHandByRank(hand: GameCard[]): HandGroup[] {
  const map = new Map<string, GameCard[]>();
  for (const card of hand) {
    const existing = map.get(card.rank);
    if (existing) {
      existing.push(card);
    } else {
      map.set(card.rank, [card]);
    }
  }
  return Array.from(map.entries())
    .map(([rank, cards]) => ({ rank, cards }))
    .sort((a, b) => {
      const ao = RANK_SORT_ORDER[a.rank] ?? 99;
      const bo = RANK_SORT_ORDER[b.rank] ?? 99;
      return ao - bo;
    });
}

function isCardPlayable(
  card: GameCard,
  pile: GameCard[],
  constraints: { sevenOrUnder: boolean },
  bombEnabled: boolean
): boolean {
  // 2 and 3 are always wildcards; 10 is only a wildcard when bomb mode is on
  const isWildcard = ALWAYS_WILDCARD_RANKS.includes(card.rank) || (card.rank === '10' && bombEnabled);
  if (isWildcard) return true;

  // Empty pile (or pile consisting entirely of invisible 3s): any card is playable
  const topCard = pileEffectiveTop(pile);
  if (!topCard) return true;

  // 7-or-under constraint: must play 7 or lower
  if (constraints.sevenOrUnder) {
    return rankToValue(card.rank) <= 7;
  }

  // Normal: must be >= effective top card value
  return rankToValue(card.rank) >= rankToValue(topCard.rank);
}

/* ── Feature 11: Blind Card Reveal (Issue 5 — pile-anchored) ──── */

interface BlindRevealOverlayProps {
  reveal: BlindReveal;
  onDone: () => void;
}

function InlineBlindReveal({ reveal, onDone }: BlindRevealOverlayProps): React.ReactElement {
  const [phase, setPhase] = useState<'back' | 'flipping-out' | 'flipping-in' | 'front' | 'fade'>('back');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('flipping-out'), INLINE_FLIP_DELAY);
    const t2 = setTimeout(() => setPhase('flipping-in'),  INLINE_FLIP_DELAY + INLINE_FLIP_HALF);
    const t3 = setTimeout(() => setPhase('front'),        INLINE_FLIP_DELAY + INLINE_FLIP_HALF * 2);
    const t4 = setTimeout(() => setPhase('fade'),         INLINE_FLIP_DELAY + INLINE_FLIP_HALF * 2 + INLINE_HOLD);
    const t5 = setTimeout(onDone,                         INLINE_FLIP_DELAY + INLINE_FLIP_HALF * 2 + INLINE_HOLD + INLINE_FADE);
    return () => { [t1, t2, t3, t4, t5].forEach(clearTimeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isFaceUp = phase === 'flipping-in' || phase === 'front' || phase === 'fade';
  const showColor = phase === 'front' || phase === 'fade';

  const cls = [
    'gs-blind-inline',
    showColor && reveal.success  ? 'gs-blind-inline--success' : '',
    showColor && !reveal.success ? 'gs-blind-inline--fail'    : '',
    phase === 'fade'             ? 'gs-blind-inline--fading'  : '',
  ].filter(Boolean).join(' ');

  const flipCls = [
    'gs-blind-inline__flip',
    phase === 'flipping-out' ? 'gs-blind-inline__flip--out' : '',
    phase === 'flipping-in'  ? 'gs-blind-inline__flip--in'  : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} role="status" aria-live="polite" aria-label="Blind card reveal">
      <div className={flipCls}>
        <Card
          rank={isFaceUp ? reveal.card.rank : undefined}
          suit={isFaceUp ? reveal.card.suit : undefined}
          faceDown={!isFaceUp}
          size="sm"
        />
      </div>
    </div>
  );
}

/* ── Feature 12: Pickup Pile Animation ───────── */

// Issue 3 — direction determines fly target: 'down' = local player (bottom),
// 'up' = opponent at top, 'left'/'right' = side opponents
type FlyDirection = 'down' | 'up' | 'left' | 'right';

const FLY_VECTORS: Record<FlyDirection, { x: number; y: number }> = {
  down:  { x:   0, y:  200 },
  up:    { x:   0, y: -200 },
  left:  { x: -220, y: -80 },
  right: { x:  220, y: -80 },
};

interface PickupAnimationProps {
  direction: FlyDirection;
}

function PickupAnimation({ direction }: PickupAnimationProps): React.ReactElement {
  const vec = FLY_VECTORS[direction];
  return (
    <div className="gs-pickup-animation" aria-hidden="true">
      {FLY_CARD_OFFSETS.map((cfg, i) => (
        <div
          key={i}
          className="gs-pickup-fly-card"
          style={{
            '--fly-x': `${cfg.x + vec.x}px`,
            '--fly-y': `${vec.y}px`,
            '--fly-rot': `${cfg.rot}deg`,
            animationDelay: `${cfg.delay}ms`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/* ── Card Play Animation ──────────────────────── */

function CardPlayAnimation({ fromBottom }: { fromBottom: boolean }): React.ReactElement {
  return (
    <div
      className={`gs-card-play-anim gs-card-play-anim--${fromBottom ? 'from-bottom' : 'from-top'}`}
      aria-hidden="true"
    />
  );
}

/* ── Issue 8: Bomb Animation ──────────────────── */

function BombAnimation(): React.ReactElement {
  return (
    <div className="gs-bomb-animation" aria-hidden="true">
      <div className="gs-bomb-burst" />
    </div>
  );
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
  const bombEnabled           = useGameStore((s) => s.bombEnabled);
  const blindReveal           = useGameStore((s) => s.blindReveal);
  const opponentBlindReveal   = useGameStore((s) => s.opponentBlindReveal);
  const pickupAnimation       = useGameStore((s) => s.pickupAnimation);
  const pickupPlayerId        = useGameStore((s) => s.pickupPlayerId);
  const bombAnimation         = useGameStore((s) => s.bombAnimation);
  const cardPlayAnimation     = useGameStore((s) => s.cardPlayAnimation);
  const currentPlayerAvatar   = useGameStore((s) => s.currentPlayerAvatar);

  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [showPileCounts, setShowPileCounts] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const pileCountsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to prevent double-firing of auto-pickup
  const autoPickupPendingRef = useRef(false);

  /* Feature 12 — reset pickupAnimation after the animation completes */
  useEffect(() => {
    if (!pickupAnimation) return;
    const t = setTimeout(() => {
      useGameStore.setState({ pickupAnimation: false, pickupPlayerId: null });
    }, PICKUP_ANIM_MS);
    return () => clearTimeout(t);
  }, [pickupAnimation]);

  /* Issue 8 — reset bombAnimation after it plays */
  useEffect(() => {
    if (!bombAnimation) return;
    const t = setTimeout(() => {
      useGameStore.setState({ bombAnimation: false });
    }, BOMB_ANIM_MS);
    return () => clearTimeout(t);
  }, [bombAnimation]);

  /* Card play animation — clear after it finishes */
  useEffect(() => {
    if (!cardPlayAnimation) return;
    const t = setTimeout(() => {
      useGameStore.setState({ cardPlayAnimation: null });
    }, CARD_PLAY_ANIM_MS);
    return () => clearTimeout(t);
  }, [cardPlayAnimation]);

  const opponents = lobbyPlayers.filter((p: LobbyPlayer) => p.id !== currentPlayerId);
  const isSpectator = phase === 'playing' && hand.length === 0 && tableCards.length === 0 && blindCards.length === 0;
  const topPileCard = pileEffectiveTop(playPile);
  const isYourTurn = !!currentPlayerId && currentTurnPlayerId === currentPlayerId;

  /* Issue 3 — determine pickup animation direction based on who picked up */
  const pickupDirection: FlyDirection = (() => {
    if (!pickupPlayerId || pickupPlayerId === currentPlayerId) return 'down';
    return 'up';
  })();

  // Determine which zone is active for card selection
  const isHandZone = hand.length > 0;
  const isBlindZone = !isHandZone && tableCards.length === 0 && blindCards.length > 0;

  // Blind cards at slots where no visible card exists are "exposed" and immediately playable.
  // This supports the rule: playing a visible card reveals the blind card beneath it.
  const exposedBlindCardIds: Set<string> = !isHandZone
    ? new Set(blindCards.filter((_, i) => !tableCards[i]).map((c) => c.id))
    : new Set<string>();

  const activeZoneIds = new Set<string>(
    isHandZone
      ? hand.map((c: GameCard) => c.id)
      : [
          ...tableCards.map((c: GameCard) => c.id),
          ...Array.from(exposedBlindCardIds),
        ]
  );

  /* Fix E — compute playability for each active zone card; blind cards are always playable */
  const playableIds = new Set<string>(
    Array.from(activeZoneIds).filter((id) => {
      if (exposedBlindCardIds.has(id)) return true; // blind: always playable (flip and hope)
      const card = hand.find((c) => c.id === id) ?? tableCards.find((c) => c.id === id);
      if (!card) return false;
      return isCardPlayable(card, playPile, activeConstraints, bombEnabled);
    })
  );

  /* Fix F — auto-select same-rank cards on click (hand zone only) */
  const handleSelectCard = (cardId: string): void => {
    if (!activeZoneIds.has(cardId)) return;

    // Exposed blind cards: single selection only (identity unknown until played)
    if (exposedBlindCardIds.has(cardId)) {
      setSelectedCards((prev) => prev.includes(cardId) ? [] : [cardId]);
      const slotIdx = blindCards.findIndex((c) => c.id === cardId);
      if (slotIdx >= 0) useGameStore.setState({ pendingBlindSlotIndex: slotIdx });
      return;
    }

    // Only gate on playability for hand cards — table/blind plays always proceed (fail-pickup handles unbeatable plays)
    if (isHandZone && !playableIds.has(cardId) && isYourTurn) return;

    const clickedCard = [...hand, ...tableCards].find((c) => c.id === cardId);
    if (!clickedCard) return;

    // For table (visible) zone: single selection only
    if (!isHandZone) {
      setSelectedCards((prev) =>
        prev.includes(cardId) ? [] : [cardId]
      );
      return;
    }

    // Hand zone: if this card is already selected, deselect it (one at a time)
    if (selectedCards.includes(cardId)) {
      setSelectedCards((prev) => prev.filter((id) => id !== cardId));
      return;
    }

    const sameRankIds = hand
      .filter((c) => c.rank === clickedCard.rank && activeZoneIds.has(c.id) && playableIds.has(c.id))
      .map((c) => c.id);

    // Only keep same-rank cards selected — never mix ranks
    setSelectedCards(sameRankIds);
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

  const handleLeaveGame = (): void => {
    setShowLeaveConfirm(false);
    useGameStore.getState().resetGameSession();
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

  /* Feature 7 — grouped hand for display */
  const groupedHand = groupHandByRank(hand);

  /* Issue 7 — dynamic hand sizing: shrink card groups when there are many ranks */
  const isCompactHand = groupedHand.length > HAND_COMPACT_THRESHOLD;
  const handCardW = isCompactHand ? HAND_CARD_W_SM : HAND_CARD_W_DEFAULT;
  const handCardH = isCompactHand ? HAND_CARD_H_SM : HAND_CARD_H_DEFAULT;
  const handGap   = isCompactHand ? HAND_GAP_SM : HAND_GAP_DEFAULT;
  const handCSSVars = {
    '--hand-card-w': `${handCardW}px`,
    '--hand-card-h': `${handCardH}px`,
    '--hand-gap':    `${handGap}px`,
  } as React.CSSProperties;

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

  const topOpponents = opponents;
  const isCompactOpponents = topOpponents.length >= 4;
  const oppCardSize = isCompactOpponents ? 'xxs' as const : 'xs' as const;
  const handFanOffset = isCompactOpponents ? 6 : 10;

  return (
    <div className="game-screen">

      {/* ── Menu Button ──────────────────────────── */}
      <button
        type="button"
        className="gs-menu-btn"
        onClick={() => setShowLeaveConfirm(true)}
        aria-label="Open game menu"
      >
        <span aria-hidden="true">&#9776;</span> Menu
      </button>

      {/* ── Leave Confirmation ───────────────────── */}
      {showLeaveConfirm && (
        <div className="gs-leave-overlay" role="dialog" aria-label="Leave game">
          <div className="gs-leave-card">
            <p className="gs-leave-title">Leave game?</p>
            <p className="gs-leave-body">Other players will continue without you.</p>
            <div className="gs-leave-actions">
              <button className="gs-leave-btn gs-leave-btn--secondary" onClick={() => setShowLeaveConfirm(false)}>Cancel</button>
              <button className="gs-leave-btn gs-leave-btn--primary" onClick={handleLeaveGame}>Leave</button>
            </div>
          </div>
        </div>
      )}

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
        <div className={`gs-opponents-row${isCompactOpponents ? ' gs-opponents-row--compact' : ''}`} role="list" aria-label="Opponents">
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
                      size={oppCardSize}
                      className="gs-opponent-card"
                      style={{ transform: `translateX(${i * -handFanOffset}px) rotate(${(i - 1) * 3}deg)` }}
                    />
                  ))}
                </div>

                {/* Table cards: blind slots with visible on top */}
                {(blindCount > 0 || opponentBlindReveal?.playerId === player.id) && (
                  <div className="gs-opp-table" aria-hidden="true">
                    {Array.from({ length: blindCount }).map((_, i) => (
                      <div key={i} className={`gs-opp-table-slot${isCompactOpponents ? ' gs-opp-table-slot--xxs' : ''}`}>
                        <Card faceDown size={oppCardSize} />
                        {visibleCards[i] && (
                          <Card
                            rank={visibleCards[i].rank}
                            suit={visibleCards[i].suit}
                            size={oppCardSize}
                            className="gs-opp-table-visible"
                          />
                        )}
                      </div>
                    ))}
                    {opponentBlindReveal?.playerId === player.id && (
                      <div className="gs-opp-table-slot">
                        <InlineBlindReveal
                          reveal={{ card: opponentBlindReveal.card, success: opponentBlindReveal.success, slotIndex: 0 }}
                          onDone={() => useGameStore.setState({ opponentBlindReveal: null })}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className={`gs-opponent-label ${isActive ? 'gs-opponent-label--active' : ''}`}>
                  <Avatar slug={player.avatar} size={isCompactOpponents ? 24 : 32} className="gs-opponent-avatar" alt="" />
                  <span className="gs-opponent-name">{player.username}</span>
                  <span className="gs-opponent-count" aria-label={`${handCount ?? '?'} cards`}>{handCount ?? '?'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Center Board ─────────────────────────── */}
      <div className="gs-board" style={{ position: 'relative' }}>
        <div className="gs-center">
          {/* Fix A — renamed to "Play Pile" */}
          <div className={`gs-pile-wrap${bombAnimation ? ' gs-pile--bomb' : ''}`}>
            <PileDisplay
              title="Play Pile"
              count={playPile.length}
              topCard={topPileCard}
              onClick={handleShowPileCounts}
            />
          </div>
          {/* Fix B — use deckCount from store */}
          <PileDisplay
            title="Draw"
            count={deckCount}
            isDeck
          />
        </div>
        {/* Feature 12 — pickup pile fly animation (Issue 3: directional) */}
        {pickupAnimation && <PickupAnimation direction={pickupDirection} />}
        {/* Issue 8 — bomb flash animation */}
        {bombAnimation && <BombAnimation />}
        {/* Card play fly-to-pile animation */}
        {cardPlayAnimation && <CardPlayAnimation fromBottom={cardPlayAnimation.fromBottom} />}
      </div>

      {/* ── Player's Table Cards ─────────────────── */}
      {(blindCards.length > 0 || blindReveal !== null) && (() => {
        // Inject a ghost slot at blindReveal.slotIndex so the reveal appears in-place
        const revealIdx = blindReveal?.slotIndex ?? -1;
        const displayCount = revealIdx >= 0
          ? Math.max(blindCards.length + 1, revealIdx + 1)
          : blindCards.length;

        return (
          <div className="gs-table-zone">
            <div className="gs-zone-label">Table</div>
            <div className="gs-table-stacks">
              {Array.from({ length: displayCount }).map((_, di) => {
                const isRevealSlot = di === revealIdx;
                // Map display index → blindCards index: only subtract 1 after the ghost slot
                const bi = (revealIdx >= 0 && di > revealIdx) ? di - 1 : di;
                const blindCard: GameCard | null = isRevealSlot ? null : (blindCards[bi] ?? null);
                const visibleCard = tableCards[di] ?? null;

                if (!blindCard && !isRevealSlot) return null;

                if (isRevealSlot) {
                  return (
                    <div key={`reveal-${di}`} className="gs-table-slot" aria-label={`Table slot ${di + 1} revealing`}>
                      <InlineBlindReveal
                        reveal={blindReveal!}
                        onDone={() => useGameStore.setState({ blindReveal: null })}
                      />
                    </div>
                  );
                }

                const visibleSelected = !isHandZone && !!visibleCard && selectedCards.includes(visibleCard.id);
                const visibleDisabled = isHandZone || !isYourTurn || !visibleCard;
                const isThisBlindExposed = exposedBlindCardIds.has(blindCard!.id);
                const blindSelected = isThisBlindExposed && selectedCards.includes(blindCard!.id);
                const blindPlayDisabled = !isThisBlindExposed || !isYourTurn;

                return (
                  <div key={di} className="gs-table-slot" aria-label={`Table slot ${di + 1}`}>
                    <Card
                      faceDown
                      size="sm"
                      selected={blindSelected}
                      disabled={blindPlayDisabled}
                      onClick={(!blindPlayDisabled && !visibleCard) ? () => handleSelectCard(blindCard!.id) : undefined}
                      className="gs-table-slot__blind animate-slide-up"
                      style={{ animationDelay: `${di * 30}ms` }}
                      aria-label={isBlindZone && !visibleCard ? 'Blind card — click to play' : 'Blind card'}
                    />
                    {visibleCard && (
                      <Card
                        rank={visibleCard.rank}
                        suit={visibleCard.suit}
                        size="sm"
                        selected={!!visibleSelected}
                        disabled={visibleDisabled}
                        onClick={!visibleDisabled ? () => handleSelectCard(visibleCard.id) : undefined}
                        className="gs-table-slot__visible animate-slide-up"
                        style={{ animationDelay: `${di * 30 + 15}ms` }}
                        aria-label={`${visibleCard.rank} of ${visibleCard.suit}, table card`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Your Hand / Spectator ────────────────── */}
      {isSpectator ? (
        <div className="gs-spectator-banner" role="status" aria-live="polite">
          <span className="gs-spectator-title">You finished!</span>
          <span className="gs-spectator-subtitle">Watching the game play out...</span>
        </div>
      ) : (
        <div className="gs-hand-zone">
          <div className="gs-hand-header">
            <div className="gs-self-id">
              <Avatar slug={currentPlayerAvatar} size={28} alt="" />
              <span className="gs-self-name">
                {lobbyPlayers.find((p: LobbyPlayer) => p.id === currentPlayerId)?.username ?? 'You'}
              </span>
            </div>
            <span className="gs-hand-count">{hand.length} cards</span>
          </div>
          {/* Issue 7 — inject CSS vars so groups and gap shrink when hand is full */}
          <div className="gs-hand-cards" style={handCSSVars} role="group" aria-label="Your cards">
            {hand.length === 0 ? (
              <p className="gs-hand-empty">No cards in hand</p>
            ) : (
              /* Feature 7 — render grouped stacks instead of individual cards */
              groupedHand.map((group, gi) => {
                const selectedCount = group.cards.filter((c) => selectedCards.includes(c.id)).length;
                const isGroupSelected = selectedCount > 0;
                const hasMultiple = group.cards.length > 1;

                // Show at most 3 cards in the fan (visual only)
                const visibleFanCards = group.cards.slice(0, 3);
                // The "front" card is the last one — clicking it deselects one at a time
                const frontCard = group.cards[group.cards.length - 1];
                // Issue 7: compact card size when many groups
                const cardSize = isCompactHand ? 'sm' : 'md';

                const isGroupDisabled = !isYourTurn || !playableIds.has(frontCard.id);

                return (
                  <div
                    key={group.rank}
                    className={`gs-hand-group animate-slide-up ${isGroupSelected ? 'gs-hand-group--selected' : ''} ${isGroupDisabled ? 'gs-hand-group--disabled' : ''}`}
                    style={{ animationDelay: `${gi * 30}ms` }}
                    role="group"
                    aria-label={`${group.rank} — ${group.cards.length} card${group.cards.length !== 1 ? 's' : ''}${isGroupSelected ? `, ${selectedCount} selected` : ''}`}
                  >
                    {/* Fan cards behind — non-interactive visual only */}
                    {visibleFanCards.slice(0, -1).map((card) => {
                      const isSelected = selectedCards.includes(card.id);
                      const isPlayable = playableIds.has(card.id);
                      const isDisabled = !isYourTurn || !isPlayable;
                      return (
                        <Card
                          key={card.id}
                          rank={card.rank}
                          suit={card.suit}
                          size={cardSize}
                          selected={isSelected}
                          disabled={isDisabled}
                          onClick={!isDisabled ? () => handleSelectCard(card.id) : undefined}
                          className="gs-hand-group__card"
                          aria-hidden="true"
                        />
                      );
                    })}

                    {/* Front card — interactive, clicking deselects one at a time */}
                    {(() => {
                      const isSelected = selectedCards.includes(frontCard.id);
                      const isPlayable = playableIds.has(frontCard.id);
                      const isDisabled = !isYourTurn || !isPlayable;
                      return (
                        <Card
                          key={frontCard.id}
                          rank={frontCard.rank}
                          suit={frontCard.suit}
                          size={cardSize}
                          selected={isSelected}
                          disabled={isDisabled}
                          onClick={!isDisabled ? () => handleSelectCard(frontCard.id) : undefined}
                          className="gs-hand-group__card"
                          aria-label={`${frontCard.rank} of ${frontCard.suit}${isSelected ? ', selected' : ''}${isDisabled ? ', not playable' : ''}`}
                        />
                      );
                    })()}

                    {/* Count badge — only when 2+ cards of this rank */}
                    {hasMultiple && (
                      <span className="gs-hand-group__badge" aria-hidden="true">
                        ×{group.cards.length}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Controls ─────────────────────────────── */}
      {!isSpectator && (
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
      )}

      {/* ── Debug Controls (dev only) ─────────────── */}
      {import.meta.env.DEV && gameId && (
        <div className="gs-controls" style={{ marginTop: 4, opacity: 0.6 }}>
          <button
            className="gs-btn gs-btn--secondary"
            style={{ fontSize: '0.7rem' }}
            onClick={() => debugAutoPlay(gameId)}
          >
            auto-play to empty deck
          </button>
        </div>
      )}

    </div>
  );
}

export default GameScreen;
