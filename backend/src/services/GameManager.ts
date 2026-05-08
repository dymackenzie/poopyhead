/**
 * Game Manager Service
 * 
 * Manages individual game instances.
 * Tracks game state, applies rules, broadcasts updates to room.
 */

import { v4 as uuid } from 'uuid';
import { Card } from './DeckService';
import { createDeck, drawCards } from './DeckService';
import { dealGame } from './DealService';
import { validateMove } from './MoveValidatorService';
import { resolveTurn, advancePlayerIndex } from './TurnResolutionService';

export interface GameInstance {
  id: string;
  lobbyCode: string;
  players: GamePlayer[];
  deck: Card[];
  playPile: Card[];
  currentPlayerIndex: number;
  playOrder: string[];
  direction: 'clockwise' | 'counterclockwise';
  status: 'setup' | 'swapping' | 'playing' | 'ended';
  /** Player IDs that have submitted their swap selection */
  swappedPlayers: string[];
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  
  // Constraints
  activeConstraints: {
    sevenOrUnder: boolean;
    skipCount: number;
    cardUnderneath?: Card;
  };
  
  // Settings
  bombEnabled: boolean;
  turnTimerSeconds: number;
  
  // History
  turnHistory: GameTurn[];
  
  // Endgame
  eliminationOrder: string[]; // Player IDs in elimination order
  loser?: string; // Player ID of loser (Poopyhead)
}

export interface GamePlayer {
  id: string;
  username: string;
  hand: Card[];
  tableVisible: Card[];
  tableBlind: Card[];
  poopyheadCount: number;
  isBot?: boolean;
}

export interface GameTurn {
  turnIndex: number;
  playerId: string;
  action: 'play_cards' | 'pickup' | 'bomb' | 'skip';
  cardsPlayed?: Card[];
  outcome: string;
  timestamp: Date;
}

/**
 * Creates new game instance from lobby players.
 */
export interface CreateGameInput {
  lobbyCode: string;
  players: Array<{ id: string; username: string; poopyheadCount: number; isBot?: boolean }>;
  settings: { bombEnabled: boolean; turnTimerSeconds: number };
  direction: 'clockwise' | 'counterclockwise';
}

export function createGame(input: CreateGameInput): GameInstance {
  const playerCount = input.players.length;
  const deck = createDeck(playerCount);
  const dealResult = dealGame(deck, playerCount);

  // Determine first player (from DealService logic - using 0 for MVP)
  const firstPlayerIndex = 0;

  const gameInstance: GameInstance = {
    id: uuid(),
    lobbyCode: input.lobbyCode,
    players: input.players.map((p, i) => ({
      id: p.id,
      username: p.username,
      isBot: p.isBot,
      // During swapping phase hand = all dealt hand cards (tableVisible not yet assigned).
      // dealGame returns playerHands already stripped of the auto-split visible cards, so
      // we combine them back so the player can choose their own 3.
      hand: [...(dealResult.playerHands[i] || []), ...(dealResult.playerTableVisible[i] || [])],
      tableVisible: [], // empty until player submits swap selection
      tableBlind: dealResult.playerTableBlind[i] || [],
      poopyheadCount: p.poopyheadCount,
    })),
    deck: dealResult.remainingDeck,
    playPile: [],
    currentPlayerIndex: firstPlayerIndex,
    playOrder: input.players.map(p => p.id),
    direction: input.direction,
    status: 'swapping', // players must choose table-visible cards before play begins
    swappedPlayers: [],
    createdAt: new Date(),
    activeConstraints: {
      sevenOrUnder: false,
      skipCount: 0,
    },
    bombEnabled: input.settings.bombEnabled,
    turnTimerSeconds: input.settings.turnTimerSeconds,
    turnHistory: [],
    eliminationOrder: [],
  };

  return gameInstance;
}

/**
 * Processes a card play action on the game.
 * Returns updated game state or rejection reason.
 */
export interface PlayCardActionInput {
  game: GameInstance;
  playerId: string;
  cardIds: string[];
}

export interface PlayCardActionOutput {
  success: boolean;
  reason?: string;
  updatedGame?: GameInstance;
  eventType?: string; // 'card_played', 'bomb_triggered', 'blind_fail'
  sourceZone?: 'hand' | 'table' | 'blind';
  cardsPlayed?: Card[]; // full card objects (needed for blind/table reveal animations)
}

export function processPlayCardAction(input: PlayCardActionInput): PlayCardActionOutput {
  const { game, playerId, cardIds } = input;
  
  // Verify it's this player's turn
  if (game.playOrder[game.currentPlayerIndex] !== playerId) {
    return { success: false, reason: 'NOT_YOUR_TURN' };
  }
  
  const player = game.players.find(p => p.id === playerId);
  if (!player) {
    return { success: false, reason: 'PLAYER_NOT_FOUND' };
  }
  
  // Determine source zone (hand > table > blind)
  let sourceZone: 'hand' | 'table' | 'blind' = 'hand';
  if (player.hand.length === 0) sourceZone = 'table';
  if (player.hand.length === 0 && player.tableVisible.length === 0) sourceZone = 'blind';
  
  // Get cards from appropriate zone
  const allCards = [...player.hand, ...player.tableVisible, ...player.tableBlind];
  const cardsToPlay = cardIds
    .map(id => allCards.find(c => c.id === id))
    .filter(c => c !== undefined) as Card[];
  
  if (cardsToPlay.length === 0) {
    return { success: false, reason: 'CARDS_NOT_FOUND' };
  }
  
  // Validate move
  const validationResult = validateMove({
    playerId,
    cardIds,
    playerHand: player.hand,
    playerTableVisible: player.tableVisible,
    playerTableBlind: player.tableBlind,
    currentPile: game.playPile,
    isPlayerTurn: true,
    activeConstraints: game.activeConstraints,
    bombEnabled: game.bombEnabled,
  });
  
  if (!validationResult.valid) {
    return { success: false, reason: validationResult.reason };
  }
  
  // Update player zones (remove played cards)
  const updatedPlayer = {
    ...player,
    hand: player.hand.filter(c => !cardIds.includes(c.id)),
    tableVisible: player.tableVisible.filter(c => !cardIds.includes(c.id)),
    tableBlind: player.tableBlind.filter(c => !cardIds.includes(c.id)),
  };
  
  // Replenish hand from deck if cards came from hand
  if (validationResult.sourceZone === 'hand') {
    const cardsNeeded = Math.max(0, 5 - updatedPlayer.hand.length); // Assume 5-card hand for MVP
    const [newCards, remainingDeck] = drawCardsFromDeck(game.deck, cardsNeeded);
    updatedPlayer.hand.push(...newCards);
    game.deck = remainingDeck;
  }
  
  // Add cards to pile
  const newPile = [...game.playPile, ...cardsToPlay];

  // Table visible / blind card play: always allowed to proceed, but if the card doesn't
  // beat the pile the player picks up everything (card + pile go to hand, pile clears).
  if ((validationResult.sourceZone === 'blind' || validationResult.sourceZone === 'table') && game.playPile.length > 0) {
    const blindCard = cardsToPlay[0];
    let blindFails = false;

    let effectiveTopIndex = game.playPile.length - 1;
    while (effectiveTopIndex >= 0 && game.playPile[effectiveTopIndex].specialType === 'invisible') {
      effectiveTopIndex--;
    }

    if (effectiveTopIndex >= 0) {
      const topCard = game.playPile[effectiveTopIndex];
      const isWildcard = blindCard.isWildcard && (blindCard.specialType !== 'bomb' || game.bombEnabled);
      if (!isWildcard) {
        blindFails = game.activeConstraints.sevenOrUnder
          ? blindCard.value > 7
          : blindCard.value < topCard.value;
      }
    }

    if (blindFails) {
      const failedPlayer = { ...updatedPlayer, hand: [...updatedPlayer.hand, ...newPile] };
      const nextIndex = advancePlayerIndex(
        game.currentPlayerIndex, 1, game.playOrder.length, game.direction
      );
      return {
        success: true,
        updatedGame: {
          ...game,
          players: game.players.map(p => (p.id === playerId ? failedPlayer : p)),
          playPile: [],
          currentPlayerIndex: nextIndex,
          activeConstraints: { sevenOrUnder: false, skipCount: 0 },
          turnHistory: [
            ...game.turnHistory,
            {
              turnIndex: game.turnHistory.length + 1,
              playerId,
              action: 'pickup',
              outcome: `${validationResult.sourceZone === 'blind' ? 'Blind flip' : 'Table play'} failed — picked up ${newPile.length} cards`,
              timestamp: new Date(),
            },
          ],
        },
        eventType: 'blind_fail',
        sourceZone: validationResult.sourceZone,
        cardsPlayed: cardsToPlay,
      };
    }
  }

  // Resolve turn (check constraints, next player, bombs, etc.)
  const turnResolution = resolveTurn({
    playerId,
    cardsPlayed: cardsToPlay,
    sourceZone: validationResult.sourceZone || 'hand',
    currentPile: game.playPile,
    currentPlayerIndex: game.currentPlayerIndex,
    playerCount: game.playOrder.length,
    playOrder: game.playOrder,
    direction: game.direction,
    activeConstraints: game.activeConstraints,
    bombEnabled: game.bombEnabled,
  });
  
  // Update game state
  const updatedGame: GameInstance = {
    ...game,
    players: game.players.map(p => (p.id === playerId ? updatedPlayer : p)),
    playPile: turnResolution.bombTriggered ? [] : newPile,
    currentPlayerIndex: turnResolution.nextPlayerIndex,
    activeConstraints: turnResolution.newConstraints as any,
    turnHistory: [
      ...game.turnHistory,
      {
        turnIndex: game.turnHistory.length + 1,
        playerId,
        action: 'play_cards',
        cardsPlayed: cardsToPlay,
        outcome: `Played ${cardsToPlay.length} cards`,
        timestamp: new Date(),
      },
    ],
  };
  
  const eventType = turnResolution.bombTriggered ? 'bomb_triggered' : 'card_played';
  
  return {
    success: true,
    updatedGame,
    eventType,
    sourceZone: validationResult.sourceZone || 'hand',
    cardsPlayed: cardsToPlay,
  };
}

/**
 * Helper: Draw cards from deck.
 */
function drawCardsFromDeck(deck: Card[], count: number): [Card[], Card[]] {
  if (deck.length === 0) return [[], []];
  
  const drawn: Card[] = [];
  const remaining = [...deck];
  
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const card = remaining.shift();
    if (card) drawn.push(card);
  }
  
  return [drawn, remaining];
}

// ────────────────────────────────────────────────────────────────
// SWAP PHASE
// ────────────────────────────────────────────────────────────────

export interface ApplySwapInput {
  game: GameInstance;
  playerId: string;
  /** Exactly 3 card IDs from the player's current hand */
  cardIds: string[];
}

export interface ApplySwapOutput {
  success: boolean;
  reason?: string;
  updatedGame?: GameInstance;
  /** True when every player has now submitted — game transitions to 'playing' */
  allPlayersSwapped?: boolean;
}

/**
 * Records a player's table-visible card selection during the swapping phase.
 * When all players have submitted, the game advances to 'playing'.
 */
export function applySwap(input: ApplySwapInput): ApplySwapOutput {
  const { game, playerId, cardIds } = input;

  if (game.status !== 'swapping') {
    return { success: false, reason: 'NOT_SWAPPING_PHASE' };
  }

  const player = game.players.find(p => p.id === playerId);
  if (!player) {
    return { success: false, reason: 'PLAYER_NOT_FOUND' };
  }

  if (game.swappedPlayers.includes(playerId)) {
    return { success: false, reason: 'ALREADY_SWAPPED' };
  }

  if (cardIds.length !== 3) {
    return { success: false, reason: 'MUST_CHOOSE_EXACTLY_3' };
  }

  // All chosen cards must be in the player's current hand
  const handIds = new Set(player.hand.map(c => c.id));
  if (!cardIds.every(id => handIds.has(id))) {
    return { success: false, reason: 'CARDS_NOT_IN_HAND' };
  }

  const chosenCards = cardIds.map(id => player.hand.find(c => c.id === id)!);
  const remainingHand = player.hand.filter(c => !cardIds.includes(c.id));

  const updatedPlayer = {
    ...player,
    hand: remainingHand,
    tableVisible: chosenCards,
  };

  const updatedSwappedPlayers = [...game.swappedPlayers, playerId];
  const allPlayersSwapped = updatedSwappedPlayers.length === game.players.length;

  let updatedGame: GameInstance = {
    ...game,
    players: game.players.map(p => (p.id === playerId ? updatedPlayer : p)),
    swappedPlayers: updatedSwappedPlayers,
    status: allPlayersSwapped ? 'playing' : 'swapping',
    // Only set startedAt when play actually begins
    ...(allPlayersSwapped ? { startedAt: new Date() } : {}),
  };

  // RULE_CANON Setup step 4: when all players have swapped, replenish each hand
  // by drawing 3 cards from the deck to replace the 3 placed on the table.
  if (allPlayersSwapped) {
    let currentDeck = updatedGame.deck;
    const refilledPlayers = updatedGame.players.map(p => {
      const cardsNeeded = Math.min(3, currentDeck.length);
      const drawn = currentDeck.slice(0, cardsNeeded);
      currentDeck = currentDeck.slice(cardsNeeded);
      return { ...p, hand: [...p.hand, ...drawn] };
    });
    updatedGame = { ...updatedGame, players: refilledPlayers, deck: currentDeck };
  }

  return { success: true, updatedGame, allPlayersSwapped };
}

// ────────────────────────────────────────────────────────────────
// PICKUP PILE ACTION
// ────────────────────────────────────────────────────────────────

export interface PickupActionInput {
  game: GameInstance;
  playerId: string;
}

export interface PickupActionOutput {
  success: boolean;
  reason?: string;
  updatedGame?: GameInstance;
}

/**
 * Processes a manual pickup-pile action.
 * The current player takes all cards from the play pile into their hand,
 * the pile is cleared, and the turn advances to the next player.
 */
export function processPickupAction(input: PickupActionInput): PickupActionOutput {
  const { game, playerId } = input;

  if (game.playOrder[game.currentPlayerIndex] !== playerId) {
    return { success: false, reason: 'NOT_YOUR_TURN' };
  }

  const player = game.players.find(p => p.id === playerId);
  if (!player) {
    return { success: false, reason: 'PLAYER_NOT_FOUND' };
  }

  if (game.playPile.length === 0) {
    return { success: false, reason: 'PILE_EMPTY' };
  }

  const updatedPlayer = { ...player, hand: [...player.hand, ...game.playPile] };

  const nextPlayerIndex = advancePlayerIndex(
    game.currentPlayerIndex,
    1,
    game.playOrder.length,
    game.direction
  );

  return {
    success: true,
    updatedGame: {
      ...game,
      players: game.players.map(p => (p.id === playerId ? updatedPlayer : p)),
      playPile: [],
      currentPlayerIndex: nextPlayerIndex,
      activeConstraints: { sevenOrUnder: false, skipCount: 0 },
      turnHistory: [
        ...game.turnHistory,
        {
          turnIndex: game.turnHistory.length + 1,
          playerId,
          action: 'pickup',
          outcome: `Picked up ${game.playPile.length} cards`,
          timestamp: new Date(),
        },
      ],
    },
  };
}

/**
 * Checks if game has ended.
 */
export function checkGameEnd(game: GameInstance): { ended: boolean; loserId?: string } {
  const playersWithCards = game.players.filter(
    p => p.hand.length > 0 || p.tableVisible.length > 0 || p.tableBlind.length > 0
  );
  
  if (playersWithCards.length === 1) {
    return { ended: true, loserId: playersWithCards[0].id };
  }
  
  return { ended: false };
}

/**
 * Ends game with loser (Poopyhead).
 */
export function endGame(game: GameInstance, loserId: string): GameInstance {
  return {
    ...game,
    status: 'ended',
    endedAt: new Date(),
    loser: loserId,
  };
}

/**
 * Prepare for rematch - reset game state for same players.
 */
export function prepareRematch(input: CreateGameInput): GameInstance {
  // Delegate to createGame so the swapping phase is entered consistently.
  return createGame(input);
}
