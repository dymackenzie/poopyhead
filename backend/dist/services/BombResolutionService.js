/**
 * Bomb Resolution Service
 *
 * Handles bomb mechanics according to RULE_CANON:
 * - 10-bomb (optional): Clears pile, grants extra turn
 * - Consecutive bomb (mandatory): 4+ same-value cards clear pile, grants extra turn
 * - PRECEDENCE RULE: Bomb resolution overrides all special card effects
 *
 * Post-bomb sequence:
 * 1. Bomb is triggered (pile cleared)
 * 2. Triggering player replenishes hand to proper size
 * 3. Triggering player plays again against empty pile
 */
/**
 * Determines if a bomb has been triggered and what type.
 * RULE_CANON: "Bomb also a wildcard... [can be played] at any time"
 *
 * Precedence check:
 * 1. Check for 10-bomb (if bombEnabled)
 * 2. Check for consecutive bomb (4+ same value)
 * 3. Apply bomb PRECEDENCE: if both could apply, bomb resolution overrides special effects
 */
export function detectBomb(input) {
    let bombTriggered = false;
    let bombType;
    // Check for 10-bomb (optional)
    if (input.bombEnabled) {
        const hasTenBomb = input.cardsPlayed.some(c => c.specialType === 'bomb');
        if (hasTenBomb) {
            bombTriggered = true;
            bombType = 'tenBomb';
        }
    }
    // Check for consecutive bomb (mandatory, overrides if both apply)
    const consecutiveBombCheck = checkConsecutiveBomb(input.pileAfterPlay);
    if (consecutiveBombCheck.isBomb) {
        bombTriggered = true;
        bombType = 'consecutiveBomb';
    }
    return {
        bombTriggered,
        bombType,
        clearedPile: bombTriggered,
        extraTurnGranted: bombTriggered,
        extraTurnPlayerId: '', // Will be filled by caller
    };
}
/**
 * Checks if top of pile has 4+ consecutive same-value cards.
 * RULE_CANON: "A bomb is also achievable if you have 4 or more consecutive
 * cards in a row of the same value on the playing pile."
 */
function checkConsecutiveBomb(pile) {
    if (pile.length < 4) {
        return { isBomb: false, runCount: 0, topRank: '' };
    }
    let runCount = 1;
    const topCard = pile[pile.length - 1];
    // Count consecutive same-value cards from top backwards
    for (let i = pile.length - 2; i >= 0; i--) {
        if (pile[i].rank === topCard.rank) {
            runCount++;
        }
        else {
            break;
        }
    }
    const isBomb = runCount >= 4;
    return { isBomb, runCount, topRank: topCard.rank };
}
export function evaluateBombPrecedence(context) {
    if (!context.bombTriggered) {
        return {
            appliedBomb: false,
            appliedConstraint: true,
            constraintType: context.constraintFromCards,
            pileCleared: false,
            extraTurnGranted: false,
            explanation: 'No bomb; normal constraint applies',
        };
    }
    // Bomb takes precedence
    return {
        appliedBomb: true,
        appliedConstraint: false,
        constraintType: undefined,
        pileCleared: true,
        extraTurnGranted: true,
        explanation: `Bomb (${context.bombType}) overrides ${context.constraintFromCards || 'normal'} rules`,
    };
}
export function replenishHandAfterBomb(input) {
    const cardsNeeded = Math.max(0, input.expectedHandSize - input.playerHand.length);
    let cardsDrawn = [];
    let remainingDeck = [...input.deck];
    // Draw from deck up to the number of cards needed
    for (let i = 0; i < cardsNeeded && remainingDeck.length > 0; i++) {
        cardsDrawn.push(remainingDeck.shift());
    }
    const replenishedHand = [...input.playerHand, ...cardsDrawn];
    // After replenishment, player plays again against empty pile (can play anything)
    // So we always return needsToPlayAgain = true
    // The empty pile is handled by turn resolution (new pile = [])
    return {
        replenishedHand,
        cardsDrawn,
        remainingDeck,
        needsToPlayAgain: true,
    };
}
/**
 * Checks if a card can be played against an empty pile (after bomb).
 * RULE_CANON: "This player now plays against an empty pile, meaning they can
 * play whatever they want."
 */
export function canPlayAgainstEmptyPile(card, pile) {
    return pile.length === 0;
}
export function continuedDrawUntilPlayable(input) {
    const cardsDrawn = [];
    let hand = [...input.playerHand];
    let deck = [...input.deck];
    // Against empty pile, any card is playable
    // So we just return what we have; this function is for safety
    // (In practice, after replenishment, player can always play something against empty pile)
    return {
        finalHand: hand,
        cardsDrawn,
        remainingDeck: deck,
        canPlay: hand.length > 0 || deck.length === 0, // Can play if have cards
    };
}
/**
 * Validates that a bomb has correctly cleared the pile and granted extra turn.
 * Used in testing to ensure bomb mechanics are correct.
 */
export function validateBombOutcome(bombTriggered, pileAfterBomb, extraTurnGranted) {
    if (!bombTriggered) {
        return { valid: true };
    }
    // Bomb must clear pile
    if (pileAfterBomb.length !== 0) {
        return { valid: false, reason: 'Bomb did not clear pile' };
    }
    // Bomb must grant extra turn
    if (!extraTurnGranted) {
        return { valid: false, reason: 'Bomb did not grant extra turn' };
    }
    return { valid: true };
}
//# sourceMappingURL=BombResolutionService.js.map