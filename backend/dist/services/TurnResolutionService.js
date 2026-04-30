/**
 * Turn Resolution Service
 *
 * Handles the outcome of a valid card play:
 * - Updates pile state
 * - Applies constraints (reset, 7-or-under, skip, bomb)
 * - Determines next turn or extra turn
 * - Returns new game state deltas
 */
import { evaluateConstraint, checkConsecutiveBomb } from './MoveValidatorService';
/**
 * Resolves a turn: applies card play, determines next player, applies constraints.
 */
export function resolveTurn(input) {
    // Add cards to pile
    const newPile = [...input.currentPile, ...input.cardsPlayed];
    // Evaluate constraint applied by these cards
    const constraintApplied = evaluateConstraint(input.cardsPlayed, input.currentPile, newPile);
    // Check for bomb
    let extraTurn = false;
    let bombTriggered = false;
    let bombType;
    const isPlayedBomb = input.cardsPlayed.some(c => c.specialType === 'bomb' && input.bombEnabled);
    const consecutiveBombCheck = checkConsecutiveBomb(newPile);
    if (isPlayedBomb && input.bombEnabled) {
        bombTriggered = true;
        bombType = '10-bomb';
        extraTurn = true;
    }
    else if (consecutiveBombCheck.isBomb) {
        bombTriggered = true;
        bombType = 'consecutive-bomb';
        extraTurn = true;
    }
    // Bomb takes precedence: if bomb, ignore other constraints
    let newConstraints = {
        sevenOrUnder: false,
        skipCount: 0,
        cardUnderneath: undefined,
    };
    if (bombTriggered) {
        // Bomb clears all constraints and returns to extra turn
        newConstraints = { sevenOrUnder: false, skipCount: 0, cardUnderneath: undefined };
    }
    else {
        // Apply constraint from play
        if (constraintApplied.constraint === 'reset') {
            // Reset: next player can play anything
            newConstraints = { sevenOrUnder: false, skipCount: 0, cardUnderneath: undefined };
        }
        else if (constraintApplied.constraint === 'sevenOrUnder') {
            newConstraints = { sevenOrUnder: true, skipCount: 0, cardUnderneath: undefined };
        }
        else if (constraintApplied.constraint === 'skip') {
            // Skip: accumulates if multiple 8s stacked
            newConstraints = {
                sevenOrUnder: false,
                skipCount: constraintApplied.skipCount || 1,
                cardUnderneath: undefined,
            };
        }
        else if (constraintApplied.constraint === 'invisible') {
            // Invisible (3): next player must beat card underneath
            // Maintain current constraints but mark 3 as applied
            newConstraints = {
                sevenOrUnder: input.activeConstraints.sevenOrUnder,
                skipCount: 0,
                cardUnderneath: constraintApplied.cardUnderneath,
            };
        }
        else {
            // No special constraint: inherit from current (but reset skip count)
            newConstraints = {
                sevenOrUnder: input.activeConstraints.sevenOrUnder,
                skipCount: 0,
                cardUnderneath: undefined,
            };
        }
    }
    // Determine next player
    let nextPlayerIndex;
    if (extraTurn) {
        // Extra turn: current player plays again
        nextPlayerIndex = input.currentPlayerIndex;
    }
    else if (newConstraints.skipCount > 0) {
        // Skip constraint: advance by skipCount + 1
        nextPlayerIndex = advancePlayerIndex(input.currentPlayerIndex, newConstraints.skipCount + 1, input.playerCount, input.direction);
        // Check for wrap-around skip (skip includes original player)
        if (doesSkipWrapToOriginal(input.currentPlayerIndex, newConstraints.skipCount + 1, input.playerCount, input.direction)) {
            // Skip wraps back to include original player
            nextPlayerIndex = advancePlayerIndex(input.currentPlayerIndex, newConstraints.skipCount + 2, input.playerCount, input.direction);
        }
        // Clear skip count after resolving
        newConstraints.skipCount = 0;
    }
    else {
        // Normal: advance to next player
        nextPlayerIndex = advancePlayerIndex(input.currentPlayerIndex, 1, input.playerCount, input.direction);
    }
    const nextPlayerId = input.playOrder[nextPlayerIndex];
    return {
        newPile,
        nextPlayerIndex,
        nextPlayerId,
        extraTurn,
        extraTurnGrantedBy: input.playerId,
        constraintApplied,
        bombTriggered,
        bombType,
        newConstraints,
    };
}
/**
 * Advances player index by count, wrapping around.
 */
function advancePlayerIndex(currentIndex, count, playerCount, direction) {
    const delta = direction === 'clockwise' ? count : -count;
    const newIndex = (currentIndex + delta) % playerCount;
    return newIndex < 0 ? newIndex + playerCount : newIndex;
}
/**
 * Checks if skips wrap around to include original player.
 */
function doesSkipWrapToOriginal(currentIndex, skipCount, playerCount, direction) {
    // Wrap occurs if skipCount >= playerCount - 1
    // (because we skip N players, which wraps if N >= total - 1)
    return skipCount >= playerCount - 1;
}
/**
 * Determines if a player can play any card (for bomb extra-turn).
 */
export function canPlayAnyCard(pile) {
    return pile.length === 0;
}
/**
 * After bomb resolution, player must replenish hand before extra turn.
 * This function calculates how many cards player needs to draw.
 */
export function calculateReplenishmentNeeded(playerHand, expectedHandSize) {
    return Math.max(0, expectedHandSize - playerHand.length);
}
//# sourceMappingURL=TurnResolutionService.js.map