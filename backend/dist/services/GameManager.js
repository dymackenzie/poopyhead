/**
 * Game Manager Service
 *
 * Manages individual game instances.
 * Tracks game state, applies rules, broadcasts updates to room.
 */
import { v4 as uuid } from 'uuid';
import { createDeck } from './DeckService';
import { dealGame } from './DealService';
import { validateMove } from './MoveValidatorService';
import { resolveTurn } from './TurnResolutionService';
export function createGame(input) {
    const playerCount = input.players.length;
    const deck = createDeck(playerCount);
    const dealResult = dealGame(deck, playerCount);
    // Determine first player (from DealService logic - using 0 for MVP)
    const firstPlayerIndex = 0;
    const gameInstance = {
        id: uuid(),
        lobbyCode: input.lobbyCode,
        players: input.players.map((p, i) => ({
            id: p.id,
            username: p.username,
            hand: dealResult.playerHands[i] || [],
            tableVisible: dealResult.playerTableVisible[i] || [],
            tableBlind: dealResult.playerTableBlind[i] || [],
            poopyheadCount: p.poopyheadCount,
        })),
        deck: dealResult.remainingDeck,
        playPile: [],
        currentPlayerIndex: firstPlayerIndex,
        playOrder: input.players.map(p => p.id),
        direction: input.direction,
        status: 'playing',
        createdAt: new Date(),
        startedAt: new Date(),
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
export function processPlayCardAction(input) {
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
    let sourceZone = 'hand';
    if (player.hand.length === 0)
        sourceZone = 'table';
    if (player.hand.length === 0 && player.tableVisible.length === 0)
        sourceZone = 'blind';
    // Get cards from appropriate zone
    const allCards = [...player.hand, ...player.tableVisible, ...player.tableBlind];
    const cardsToPlay = cardIds
        .map(id => allCards.find(c => c.id === id))
        .filter(c => c !== undefined);
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
    const updatedGame = {
        ...game,
        players: game.players.map(p => (p.id === playerId ? updatedPlayer : p)),
        playPile: turnResolution.bombTriggered ? [] : newPile,
        currentPlayerIndex: turnResolution.nextPlayerIndex,
        activeConstraints: turnResolution.newConstraints,
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
    };
}
/**
 * Helper: Draw cards from deck.
 */
function drawCardsFromDeck(deck, count) {
    if (deck.length === 0)
        return [[], []];
    const drawn = [];
    const remaining = [...deck];
    for (let i = 0; i < count && remaining.length > 0; i++) {
        const card = remaining.shift();
        if (card)
            drawn.push(card);
    }
    return [drawn, remaining];
}
/**
 * Checks if game has ended.
 */
export function checkGameEnd(game) {
    const playersWithCards = game.players.filter(p => p.hand.length > 0 || p.tableVisible.length > 0 || p.tableBlind.length > 0);
    if (playersWithCards.length === 1) {
        return { ended: true, loserId: playersWithCards[0].id };
    }
    return { ended: false };
}
/**
 * Ends game with loser (Poopyhead).
 */
export function endGame(game, loserId) {
    return {
        ...game,
        status: 'ended',
        endedAt: new Date(),
        loser: loserId,
    };
}
//# sourceMappingURL=GameManager.js.map