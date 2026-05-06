---
name: Component API Decisions
description: Prop signatures, naming conventions, and structural decisions for Poopyhead UI components
type: project
---

**Why:** Established during the full frontend revamp. These contracts are stable and should not change without reason.

**How to apply:** Match these exact prop names when building new components or extending existing ones.

## Card Component (`components/Card.tsx`)

Props: `rank`, `suit`, `faceDown`, `selected`, `disabled`, `onClick`, `size` (xs|sm|md|lg), `className`, `style`, `aria-label`
- Suit input is flexible: full names, single letters, or unicode symbols all work via `getSuitSymbol()`
- Rank input is flexible: numeric strings (11→J, 12→Q, 13→K, 14/1→A) handled via `getRankDisplay()`
- Card back uses SVG crosshatch + poop emoji via `CardBack` sub-component
- `selected` state: translateY(-10px) + scale(1.06) + white ring outline
- `disabled` state: opacity 0.4, cursor not-allowed, click blocked

## Button Component (`components/Button.tsx`)

Variants: `primary`, `secondary`, `tertiary`, `danger`
- `fullWidth` prop (default: true) controls width: 100% vs auto
- All buttons have spring press animation (scale 0.97 on :active)
- Min height 48px always

## PlayerCard Component (`components/PlayerCard.tsx`)

Props: `name`, `meta`, `status` (ready|waiting|active|neutral), `highlight`, `isActive`, `className`, `style`
- `isActive` = it's this player's turn — shows yellow dot with glow animation
- `highlight` = local player (you) — subtle border emphasis

## PileDisplay Component (`components/PileDisplay.tsx`)

Props: `title`, `count`, `topCard`, `isDeck`
- `isDeck=true` renders stacked face-down cards visual (max 3 layers visible)
- `isDeck=false` (default) renders face-up top card of discard pile
- Uses `animate-card-pulse` on discard pile card change

## Input Component (`components/Input.tsx`)

Props: `id`, `label`, `value`, `onChange`, `placeholder`, `type`, `maxLength`, `autoCapitalize`, `codeStyle`, `autoFocus`
- `codeStyle=true` → monospace, uppercase, centered, wider letter-spacing (for lobby codes)
