/**
 * Canonical Server State Schema
 * 
 * This document defines the authoritative game state structure that both
 * backend and frontend must conform to. All game logic, socket events, and
 * UI state derivation depend on this schema.
 * 
 * Version: 1.0 (Step 2: Locked)
 * Last Updated: 2026-04-27
 * Status: Authoritative - Supports all required gameplay states from RULE_CANON.md
 */

// ============================================================================
// CORE GAME STATE SCHEMA
// ============================================================================

interface GameState {
  // ---------- IDENTIFIERS & METADATA ----------
  gameId: string;                    // Unique identifier (UUID)
  code: string;                      // 6-character alphanumeric lobby code
  status: 'setup' | 'playing' | 'ended' | 'waiting';
  createdBy: string;                 // User ID of lobby creator
  createdAt: Date;
  startedAt?: Date;             // When first player action occurs
  endedAt?: Date;               // When game ends (1 player left)

  // ---------- SETTINGS & OPTIONS ----------
  specialRules: {
    bombEnabled: boolean;            // Whether 10-bomb is enabled
    turnTimerSeconds: number;        // 0 = no timer, >0 = timer in seconds
  };

  // ---------- PLAYERS & ZONES ----------
  players: Player[];
  currentPlayerIndex: number;        // Index into players array
  direction: 'clockwise' | 'counterclockwise';
  playOrder: string[];               // Ordered list of player IDs for turn sequence

  // ---------- GAME DECK & PILES ----------
  deck: Card[];                      // Remaining cards to draw
  playPile: Card[];                  // Cards played in current round (top card is pile[length-1])
  
  // ---------- CONSTRAINTS & STATE ----------
  activeConstraints: {
    sevenOrUnder: boolean;           // True if next player must play 7 or under
    skipCount: number;               // Number of players to skip (for stacked 8s)
    sevenCardUnderneath?: Card;      // Card underneath a 3 (for next player beat comparison)
  };

  // ---------- TURN & TIMING ----------
  turnStartedAt: Date;
  turnIndex: number;                 // Total number of turns taken (for history)
  bombOption: boolean;               // Whether current player can trigger consecutive bomb
  reconnectMetadata: {
    graceEndTime: Date;         // When grace period expires for mid-turn disconnects
    reconnectDeadline: Date;    // When player auto-loses if not reconnected
  };

  // ---------- PILE HISTORY ----------
  pileHistory: PileHistoryEntry[];   // For audit, replay, and bomb detection
}

interface Player {
  // ---------- IDENTITY & ACCOUNT ----------
  id: string;                        // Player ID (UUID)
  userId?: string;                   // User ID (null for guests)
  username: string;
  isGuest: boolean;

  // ---------- ZONES ----------
  hand: Card[];                      // Cards in hand (drawn from deck)
  tableCardsVisible: Card[];         // Face-up cards on table (best 3 from initial hand)
  tableCardsBlind: Card[];           // Face-down blind cards (3 cards)

  // ---------- METADATA ----------
  joinedAt: Date;
  connectedAt?: Date;           // Last connection timestamp
  isConnected: boolean;              // True if socket is active
  position: number;                  // Order in players array (0-indexed)
  
  // ---------- STATS & HISTORY ----------
  poopyheadCount: number;            // Historical count of times this player was Poopyhead
  fourCountInHand: number;           // Count of 4s in starting hand (for first-player tiebreak)
  cardsComeOutOrder?: string[];      // For ranking tiebreakers (which player went out first/second/etc)
}

interface Card {
  // ---------- IDENTITY ----------
  id: string;                        // Unique card instance ID (uuid + index)
  rank: '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2' | '3';
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  deckIndex: number;                 // Which deck this card came from (for multi-deck games)

  // ---------- PROPERTIES ----------
  value: number;                     // 4=4, 5=5, ..., 10=10, J=11, Q=12, K=13, A=14
  isWildcard: boolean;               // True if 2, 3, 10, or bomb-eligible
  isSpecial: boolean;                // True if 2, 3, 7, 8, 10
  specialType?: 'reset' | 'invisible' | 'sevenOrUnder' | 'skip' | 'bomb';
}

interface PileHistoryEntry {
  // ---------- TURN RECORD ----------
  turnIndex: number;
  playerId: string;
  playedCards: Card[];
  pileStateAfter: Card[];            // Full pile state after this play

  // ---------- CONSEQUENCES ----------
  bombTriggered?: {
    type: 'tenBomb' | 'consecutiveBomb';
    cardsThatTriggered: Card[];
  };
  constraintApplied?: {
    type: 'sevenOrUnder' | 'skip' | 'reset';
    details: any;
  };
  pickupOccurred?: {
    reason: 'handFail' | 'tableFail' | 'blindFail';
    cardCountPickedUp: number;
  };

  // ---------- TIMING ----------
  timestamp: Date;
  durationMs: number;                // How long the turn took
}

// ============================================================================
// STATE DERIVATIONS (Computed from GameState for UI/Validation)
// ============================================================================

interface ComputedGameState {
  // Currently playable cards for the player whose turn it is
  playableCards: Card[];

  // Current player object reference
  currentPlayer: Player;

  // Number of consecutive same-value cards on top of pile
  topRunCount: number;
  topRunValue: string;               // rank of top run

  // Whether a consecutive bomb would trigger with one more card
  isBombImminent: boolean;

  // Which player will go next (accounting for skips and wraps)
  nextPlayerId: string;

  // Players sorted by remaining card count (for UI visibility)
  playersByCardCount: PlayerCardCount[];

  // Is the 7-constraint active?
  sevenConstraintActive: boolean;

  // Can the current player bomb? (for UI hints)
  bombOptionAvailable: boolean;
}

interface PlayerCardCount {
  playerId: string;
  username: string;
  handCount: number;
  tableVisibleCount: number;
  tableBlindCount: number;
  totalCount: number;
}

// ============================================================================
// SOCKET EVENT CONTRACTS
// ============================================================================

// CLIENT -> SERVER

interface ClientPlayCardEvent {
  action: 'playCard';
  cardIds: string[];                 // Array of card IDs being played
  targetBomb?: boolean;              // Player is intentionally triggering bomb (for UI UX)
}

interface ClientReadyEvent {
  action: 'playerReady';
  playerId: string;
}

interface ClientJoinLobbyEvent {
  action: 'joinLobby';
  code: string;
  username: string;
  userId?: string;                   // Null for guest
}

interface ClientCreateLobbyEvent {
  action: 'createLobby';
  username: string;
  userId?: string;
  bombEnabled: boolean;
  turnTimerSeconds: number;
}

interface ClientStartGameEvent {
  action: 'startGame';
  playDirection: 'clockwise' | 'counterclockwise';
}

interface ClientRejoinGameEvent {
  action: 'rejoinGame';
  gameId: string;
  playerId: string;
  sessionToken: string;              // Reconnection token
}

// SERVER -> CLIENT (Broadcasts)

interface ServerStateUpdateEvent {
  action: 'gameStateUpdated';
  gameState: GameState;
  computedState: ComputedGameState;
}

interface ServerTurnChangedEvent {
  action: 'turnChanged';
  currentPlayerId: string;
  currentPlayerUsername: string;
  isYourTurn: boolean;               // For recipient's convenience
  timeRemaining?: number;            // Milliseconds (if timer enabled)
}

interface ServerCardPlayedEvent {
  action: 'cardPlayed';
  playerId: string;
  username: string;
  cardsPlayed: Card[];
  pileState: Card[];
  bombTriggered?: {
    type: 'tenBomb' | 'consecutiveBomb';
  };
  extraTurnGranted?: boolean;
  constraintNow?: {
    type: 'sevenOrUnder' | 'skip' | 'reset';
  };
}

interface ServerPickupEvent {
  action: 'playerPickedUp';
  playerId: string;
  username: string;
  reason: 'handFail' | 'tableFail' | 'blindFail';
  cardCountPickedUp: number;
  cardsComeOutCount: number;         // How many cards player has left
}

interface ServerPlayerJoinedEvent {
  action: 'playerJoined';
  playerId: string;
  username: string;
  playerCount: number;
  gameState: GameState;              // Send current state to new player
}

interface ServerPlayerLeftEvent {
  action: 'playerLeft';
  playerId: string;
  username: string;
  playerCount: number;
  handledBy?: string;                // Player ID of AI replacement (post-MVP)
}

interface ServerGameEndedEvent {
  action: 'gameEnded';
  loserId: string;
  loserUsername: string;
  finalRanking: { playerId: string; username: string; cardOutOrder: number }[];
  newLeaderboardState?: any;         // For display purposes
}

interface ServerPlayableCardsUpdateEvent {
  action: 'playableCardsUpdated';
  playableCards: Card[];             // Client can highlight these in UI
}

interface ServerBombTriggeredEvent {
  action: 'bombTriggered';
  bombType: 'tenBomb' | 'consecutiveBomb';
  triggeredByPlayerId: string;
  pilesCleared: number;              // For animation
  extraTurnGranted: boolean;
}

interface ServerConstraintAppliedEvent {
  action: 'constraintApplied';
  constraintType: 'sevenOrUnder' | 'skip' | 'reset';
  affectedPlayerIds: string[];
  details: any;
}

interface ServerBlindCardRevealedEvent {
  action: 'blindCardRevealed';
  playerId: string;
  card: Card;                        // Card is now visible to all
  wasPlayed: boolean;                // True if played and added to pile
  wasPickedUp: boolean;              // True if pickup occurred
}

interface ServerErrorEvent {
  action: 'error';
  code: string;                      // e.g., 'INVALID_MOVE', 'NOT_YOUR_TURN'
  message: string;
  rejectedAction?: any;              // Echo back the rejected action for debugging
}

// ============================================================================
// VALIDATION STATE REQUIREMENTS
// ============================================================================

/*
 * The canonical state must support the following game scenarios without
 * loss of information or ambiguity:
 * 
 * [ ] Setup phase: 2-10 players joining lobby
 * [ ] Deal: Cards dealt to hand, table visible, table blind
 * [ ] Normal play: Player plays card(s), pile updated, hand replenished
 * [ ] Wildcard play: 2/3 played at any time
 * [ ] 7 constraint: Next player forced to play 7-or-under
 * [ ] 8 stacking: Multiple 8s stack, skip count accumulates
 * [ ] Consecutive bomb: 4+ same-value cards trigger bomb
 * [ ] 10 bomb: If enabled, 10 clears pile
 * [ ] Pickup (hand): Hand card fails pile, must pickup
 * [ ] Pickup (table): Table face-up fails pile, must pickup + return card
 * [ ] Pickup (blind): Blind card fails pile, must pickup + return blind
 * [ ] Extra turn: After bomb, player plays again (state resets to allow any card)
 * [ ] Blind reveal: All players see blind card even if fails
 * [ ] Player disconnect: Grace period, reconnection, state resync
 * [ ] Player reconnect: Last game reference, current state resync
 * [ ] Game end: 1 player remains with cards (Poopyhead)
 * [ ] Rematch: Same lobby, new game, first player determined by history
 */

// ============================================================================
// SCHEMA SIGN-OFF
// ============================================================================

/*
 * Canonical Server State Status: LOCKED
 * Supports all required gameplay states: Yes
 * Contracts defined for all socket events: Yes
 * Derivations support UI rendering: Yes
 * Ready for Step 3 (Setup and Deal Logic): Yes
 */
