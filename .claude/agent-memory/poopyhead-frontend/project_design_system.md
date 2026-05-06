---
name: Poopyhead Design System
description: Visual system tokens, color palette, component conventions, and animation constants established for the Poopyhead frontend revamp
type: project
---

Dark-mode-first design system. All CSS custom properties live in `frontend/src/styles/design-tokens.css`.

**Why:** Full revamp established a cohesive B&W base with accent colors used sparingly (max 2 per screen).

**How to apply:** Always use tokens from design-tokens.css rather than hardcoded values. Never add a new accent color without reason.

## Color Palette

- Background base: `--bg-base` = `#0A0A0A`
- Surface layers: `--bg-surface` (#1A1A1A), `--bg-surface-2` (#222), `--bg-elevated` (#2A2A2A)
- Text: `--text-primary` (white), `--text-secondary` (#D4D4D4), `--text-muted` (#6B6B6B)
- Accent red (danger/CTA): `--accent-red` = `#FF3B3B`
- Accent yellow (active player / your turn): `--accent-yellow` = `#FFCC00`
- Accent green (ready / success): `--accent-green` = `#34C759`
- Accent purple (wild / special): `--accent-purple` = `#5856D6`

## Animation Constants

- Fast UI: 120–150ms ease-out
- Card play: 300ms cubic-bezier(0.4, 0, 0.2, 1) 
- Card draw / spring: 320ms cubic-bezier(0.34, 1.56, 0.64, 1)
- Pulse duration: 1.4s ease-in-out infinite

## Card Dimensions

- xs: 38×54px | sm: 48×68px | md: 58×82px | lg: 72×102px
- Card radius: `--card-radius` = 10px
- Face: `--color-off-white` (#F2F2F2) with black ink
- Back: `--card-back` = `#111111` with crosshatch SVG pattern + poop emoji center

## Suit Rendering

Cards accept full English suit names ("hearts", "diamonds", "spades", "clubs"), single letters (h/d/s/c), or unicode symbols. Red suits (hearts, diamonds) use `#CC2020`.

## Game Board

Felt green: `--felt-bg` = `#0D1A0E`
Layout: turn banner → opponents row → center board (piles) → player table cards → player hand → controls
All z-index layers set via position:relative z-index:1 above ::before felt texture overlay.
