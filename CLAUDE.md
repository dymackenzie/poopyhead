# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Poopyhead is a multiplayer card game (think Shithead/Palace). Players play cards to a central pile following rank rules, with specials like bombs (4-of-a-kind, 10s), skips (8s), and a 7-or-under constraint. Last player holding cards loses and becomes the Poopyhead.

## Commands

This is an npm workspaces monorepo. Run all commands from the repo root unless noted.

**Development:**
```
npm run dev              # Start backend with hot reload (tsx watch, port 3001)
cd frontend && npm run dev  # Start frontend dev server (port 5173, proxies socket.io to :3001)
```

**Testing (backend only):**
```
npm test                 # Interactive Vitest
npm test -- --run        # Single pass (CI mode)
npm run test:ui          # Vitest browser UI
# Run a single test file:
cd backend && npx vitest run src/tests/step4-move-validation.test.ts
```

**Build & type check:**
```
npm run build            # Compile backend TypeScript → dist/
npm run type-check       # Backend tsc --noEmit
cd frontend && npm run type-check  # Frontend tsc --noEmit
npm run lint             # ESLint backend src/
```

**Production:**
```
npm run build            # Build backend
cd frontend && npm run build  # Build frontend → frontend/dist/
node backend/dist/server.js  # Serve both (frontend/dist served statically)
```

## Architecture

### Communication Model

All game state is **server-authoritative**. The frontend never updates game state directly — it sends socket events and waits for the server to broadcast the new state. The backend validates every move before applying it.

Socket.io (v4) is the sole transport. The frontend connects via `socketClient.ts` which wraps `io()` with typed emit helpers. The backend's single entry point for all game events is `backend/src/sockets/gameHandlers.ts`, which coordinates the service layer.

### Backend Services (`backend/src/services/`)

Game logic is split across focused services (no god object):

| Service | Responsibility |
|---|---|
| `LobbyManager` | Lobby creation, player joining, ready checks |
| `GameManager` | Game instantiation, turn management |
| `DeckService` | Deck creation & shuffle (1 deck per 5 players) |
| `DealService` | Initial deal: 9 hand + 3 visible table + 3 blind table |
| `MoveValidatorService` | Card play legality (rank rules, zone priority) |
| `BombResolutionService` | 4-consecutive & 10-bomb clearing mechanics |
| `TurnResolutionService` | Advancing turns, skip stacking (8s), 7-constraint |
| `PickupService` | Hand/table-visible/blind failure pickups |
| `SessionManager` | Reconnection tokens, 60s grace period |
| `SecurityService` | Rate limiting, payload validation |

### Frontend State (`frontend/src/store.ts`)

Zustand store. `App.tsx` registers socket event listeners that call store actions. Components read from the store and call socket emit helpers — they never call socket directly.

Screen routing is a simple conditional in `App.tsx` based on `gameStatus` in the store: `lobby` → `LobbyScreen`, `playing` → `GameScreen`, `ended` → `EndgameScreen`.

### Game State Schema

Canonical types live in `backend/src/models/GAME_STATE_SCHEMA.ts`. Frontend mirror types are in `frontend/src/types/game.ts`. When changing the game state shape, update both.

Key game state fields:
- `players[].hand` / `tableCardsVisible` / `tableCardsBlind` — zone priority order
- `playPile` — current face-up pile
- `activeConstraints.sevenOrUnder` — 7-constraint active flag
- `activeConstraints.skipCount` — stacked 8-skips

### Socket Event Flow

Client → Server: `createLobby`, `joinLobby`, `setReady`, `startGame`, `playCard`, `reconnect`, `heartbeat`

Server → Client: `playerJoined`, `playerReady`, `gameStarted`, `cardPlayed`, `gameEnded`, `playerDisconnected`, `playerReconnected`

All events use Socket.io callbacks (acknowledge pattern) for request/response. Broadcasts use `io.to(lobbyCode)`.

## Test Coverage

9 test files, 186 tests covering the full game lifecycle:

```
step3  - setup & deal
step4  - move validation
step5  - bomb resolution
step6  - pickup & endgame
step7  - multiplayer core
step8  - reconnect & persistence
step10 - rematch loop
step11 - security (rate limiting, validation)
step12 - release validation
```

Tests use Vitest with real service instances (no mocks of internal services). When adding game logic, add tests in the relevant step file.

## Key File Locations

- Backend entry: [backend/src/server.ts](backend/src/server.ts)
- Socket handlers: [backend/src/sockets/gameHandlers.ts](backend/src/sockets/gameHandlers.ts)
- Game state schema: [backend/src/models/GAME_STATE_SCHEMA.ts](backend/src/models/GAME_STATE_SCHEMA.ts)
- Frontend entry: [frontend/src/App.tsx](frontend/src/App.tsx)
- Socket client: [frontend/src/socketClient.ts](frontend/src/socketClient.ts)
- Zustand store: [frontend/src/store.ts](frontend/src/store.ts)
- Screens: [frontend/src/screens/](frontend/src/screens/)
- Planning docs: [planning/](planning/)
