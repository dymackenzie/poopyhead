---
name: Poopyhead Design System
description: Visual system tokens, color palette, component conventions, and animation constants established for the Poopyhead frontend revamp
type: project
---

Light-mode design system as of May 2026. All CSS custom properties live in `frontend/src/styles/design-tokens.css`.

**Why:** Full revamp established a cohesive B&W base with accent colors used sparingly (max 2 per screen). User explicitly requested full light mode on the GameScreen to match the lobby, plus more irreverent/hand-crafted personality on the lobby design.

**How to apply:** Always use tokens from design-tokens.css rather than hardcoded values. Never add a new accent color without reason. ALL screens now use light mode — the dark felt board was replaced with `--bg-base` (warm parchment). `--felt-bg` is still defined in tokens but no longer used on the game screen.

## Color Palette — Light Mode

- Background base: `--bg-base` = `#FBF8F3` (warm parchment)
- Surface layers: `--bg-surface` (#FFFFFF), `--bg-surface-2` (#F5F1EB), `--bg-elevated` (#EDE8DF)
- Text: `--text-primary` (#0A0A0A), `--text-secondary` (#2A2A2A), `--text-muted` (#6B6B6B)
- Borders: `--border-strong` = rgba(0,0,0,0.15), `--border-soft` = rgba(0,0,0,0.07), `--border-accent` = rgba(0,0,0,0.30)
- Accent red (danger/CTA): `--accent-red` = `#E8332A`
- Accent yellow (active player / your turn): `--accent-yellow` = `#F5A623`
- Accent green (ready / success): `--accent-green` = `#28A745`
- Accent purple (wild / special): `--accent-purple` = `#5856D6`
- Accent warm (secondary CTA): `--accent-warm` = `#FF6B35`

## Playful Menu Design Language

Menus (Lobby, Endgame) use a hand-crafted, irreverent style — not slick/corporate:
- Lobby panel: `border: 3px solid var(--color-black)`, `border-radius: 4px` (nearly square corners), `box-shadow: 5px 5px 0 var(--color-black)` — flat offset stamp feel
- Notebook margin-line: thin red vertical line (rgba(232,51,42,0.3)) at left:36px on home/form views — like ruled paper
- Background: repeating-linear-gradient for faint ruled-paper horizontal lines
- Title kicker copy: lowercase, irreverent ("a card game for bad people")
- Placeholder text is also irreverent ("something embarrassing")
- Title uses slow `titleWiggle` (skewX + rotate) animation
- Suit divider uses dashed gradient lines (tear-off paper feel) instead of solid
- Back button arrow uses `arrowBounce` animation
- Lobby code block uses `border: 2px dashed` and `border-radius: 4px` (square corners)
- Endgame panel: `border: 2px solid`, `box-shadow: 6px 6px 0` — slightly softer than lobby

## Animation Constants

- Fast UI: 120–150ms ease-out
- Card play: 300ms cubic-bezier(0.4, 0, 0.2, 1)
- Card draw / spring: 320ms cubic-bezier(0.34, 1.56, 0.64, 1)
- Pulse duration: 1.4s ease-in-out infinite

## Card Dimensions

- xs: 38×54px | sm: 48×68px | md: 58×82px | lg: 72×102px
- Card radius: `--card-radius` = 10px
- Face: white (#FFFFFF) with black ink
- Back: `--card-back` = `#111111` with crosshatch SVG pattern + poop emoji center

## Suit Rendering

Cards accept full English suit names ("hearts", "diamonds", "spades", "clubs"), single letters (h/d/s/c), or unicode symbols. Red suits (hearts, diamonds) use `#CC2020`.

## Game Board

Now light mode — uses `--bg-base` (#FBF8F3 warm parchment) with faint radial gradient accents (yellow top-right, red bottom-left).
Layout: turn banner → opponents row → center board (piles) → player table cards → player hand → controls
Turn banner: `--bg-surface` with `border-bottom: 2px solid var(--border-soft)`. Label is `--text-muted`; your-turn state shows `--color-black` label + yellow pulse dot.
Hand zone + controls: `--bg-surface` panels with `border-top: 2px solid var(--border-soft)`.
Opponent labels: `--bg-surface` pill with `--border-strong` border, dark text.
Active play button: `--color-black` bg, white text when cards selected; `--bg-surface-2` with muted text when inactive.
All z-index layers set via position:relative z-index:1 above ::before texture overlay.
