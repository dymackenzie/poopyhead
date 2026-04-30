/**
 * Game Manager Service
 *
 * Manages individual game instances.
 * Tracks game state, applies rules, broadcasts updates to room.
 */
import { Card } from './DeckService';
export interface GameInstance {
    id: string;
    lobbyCode: string;
    players: GamePlayer[];
    deck: Card[];
    playPile: Card[];
    currentPlayerIndex: number;
    playOrder: string[];
    direction: 'clockwise' | 'counterclockwise';
    status: 'setup' | 'playing' | 'ended';
    createdAt: Date;
    startedAt?: Date;
    endedAt?: Date;
    activeConstraints: {
        sevenOrUnder: boolean;
        skipCount: number;
        cardUnderneath?: Card;
    };
    bombEnabled: boolean;
    turnTimerSeconds: number;
    turnHistory: GameTurn[];
    eliminationOrder: string[];
    loser?: string;
}
export interface GamePlayer {
    id: string;
    username: string;
    hand: Card[];
    tableVisible: Card[];
    tableBlind: Card[];
    poopyheadCount: number;
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
    players: Array<{
        id: string;
        username: string;
        poopyheadCount: number;
    }>;
    settings: {
        bombEnabled: boolean;
        turnTimerSeconds: number;
    };
    direction: 'clockwise' | 'counterclockwise';
}
export declare function createGame(input: CreateGameInput): GameInstance;
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
    eventType?: string;
}
export declare function processPlayCardAction(input: PlayCardActionInput): PlayCardActionOutput;
/**
 * Checks if game has ended.
 */
export declare function checkGameEnd(game: GameInstance): {
    ended: boolean;
    loserId?: string;
};
/**
 * Ends game with loser (Poopyhead).
 */
export declare function endGame(game: GameInstance, loserId: string): GameInstance;
//# sourceMappingURL=GameManager.d.ts.map