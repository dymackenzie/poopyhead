---
name: Poopyhead Design System
description: Visual system tokens, color palette, component conventions, and animation constants established for the Poopyhead frontend revamp
type: project
---

Light-mode design system as of May 2026. All CSS custom properties live in `frontend/src/styles/design-tokens.css`.

**Why:** Full revamp established a cohesive B&W base with accent colors used sparingly (max 2 per screen). User confirmed the play area design but requested full light mode flip + more playful menu personality.

**How to apply:** Always use tokens from design-tokens.css rather than hardcoded values. Never add a new accent color without reason. The GameScreen (felt board) stays dark — it uses `--felt-bg` = `#0D1A0E` which is immune to the light mode tokens.

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

Menus (Lobby, Endgame) use a comic/editorial panel style:
- `border: 2px solid var(--color-black)` on panels
- `box-shadow: 6px 6px 0 var(--color-black)` — flat offset shadow (no blur, graphic style)
- Buttons use same treatment: `box-shadow: 0 3px 0 rgba(...)` — pressed-down feel
- Animated card fan on home screen with float keyframes
- Title uses slow `titleWiggle` animation (-1.5deg → 1.5deg)
- Suit divider (♠ ♥ ♣ ♦) between copy and CTAs on home screen
- Lobby code block uses `border: 2px dashed` to suggest "shareable"

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

Felt green: `--felt-bg` = `#0D1A0E` — explicitly NOT affected by light mode token changes.
Layout: turn banner → opponents row → center board (piles) → player table cards → player hand → controls
All z-index layers set via position:relative z-index:1 above ::before felt texture overlay.
