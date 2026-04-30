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
interface GameState {
    gameId: string;
    code: string;
    status: 'setup' | 'playing' | 'ended' | 'waiting';
    createdBy: string;
    createdAt: Date;
    startedAt?: Date;
    endedAt?: Date;
    specialRules: {
        bombEnabled: boolean;
        turnTimerSeconds: number;
    };
    players: Player[];
    currentPlayerIndex: number;
    direction: 'clockwise' | 'counterclockwise';
    playOrder: string[];
    deck: Card[];
    playPile: Card[];
    activeConstraints: {
        sevenOrUnder: boolean;
        skipCount: number;
        sevenCardUnderneath?: Card;
    };
    turnStartedAt: Date;
    turnIndex: number;
    bombOption: boolean;
    reconnectMetadata: {
        graceEndTime: Date;
        reconnectDeadline: Date;
    };
    pileHistory: PileHistoryEntry[];
}
interface Player {
    id: string;
    userId?: string;
    username: string;
    isGuest: boolean;
    hand: Card[];
    tableCardsVisible: Card[];
    tableCardsBlind: Card[];
    joinedAt: Date;
    connectedAt?: Date;
    isConnected: boolean;
    position: number;
    poopyheadCount: number;
    fourCountInHand: number;
    cardsComeOutOrder?: string[];
}
interface Card {
    id: string;
    rank: '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | '2' | '3';
    suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
    deckIndex: number;
    value: number;
    isWildcard: boolean;
    isSpecial: boolean;
    specialType?: 'reset' | 'invisible' | 'sevenOrUnder' | 'skip' | 'bomb';
}
interface PileHistoryEntry {
    turnIndex: number;
    playerId: string;
    playedCards: Card[];
    pileStateAfter: Card[];
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
    timestamp: Date;
    durationMs: number;
}
interface ComputedGameState {
    playableCards: Card[];
    currentPlayer: Player;
    topRunCount: number;
    topRunValue: string;
    isBombImminent: boolean;
    nextPlayerId: string;
    playersByCardCount: PlayerCardCount[];
    sevenConstraintActive: boolean;
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
interface ClientPlayCardEvent {
    action: 'playCard';
    cardIds: string[];
    targetBomb?: boolean;
}
interface ClientReadyEvent {
    action: 'playerReady';
    playerId: string;
}
interface ClientJoinLobbyEvent {
    action: 'joinLobby';
    code: string;
    username: string;
    userId?: string;
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
    sessionToken: string;
}
interface ServerStateUpdateEvent {
    action: 'gameStateUpdated';
    gameState: GameState;
    computedState: ComputedGameState;
}
interface ServerTurnChangedEvent {
    action: 'turnChanged';
    currentPlayerId: string;
    currentPlayerUsername: string;
    isYourTurn: boolean;
    timeRemaining?: number;
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
    cardsComeOutCount: number;
}
interface ServerPlayerJoinedEvent {
    action: 'playerJoined';
    playerId: string;
    username: string;
    playerCount: number;
    gameState: GameState;
}
interface ServerPlayerLeftEvent {
    action: 'playerLeft';
    playerId: string;
    username: string;
    playerCount: number;
    handledBy?: string;
}
interface ServerGameEndedEvent {
    action: 'gameEnded';
    loserId: string;
    loserUsername: string;
    finalRanking: {
        playerId: string;
        username: string;
        cardOutOrder: number;
    }[];
    newLeaderboardState?: any;
}
interface ServerPlayableCardsUpdateEvent {
    action: 'playableCardsUpdated';
    playableCards: Card[];
}
interface ServerBombTriggeredEvent {
    action: 'bombTriggered';
    bombType: 'tenBomb' | 'consecutiveBomb';
    triggeredByPlayerId: string;
    pilesCleared: number;
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
    card: Card;
    wasPlayed: boolean;
    wasPickedUp: boolean;
}
interface ServerErrorEvent {
    action: 'error';
    code: string;
    message: string;
    rejectedAction?: any;
}
//# sourceMappingURL=GAME_STATE_SCHEMA.d.ts.map