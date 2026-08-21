# Gride — Technical Design Document
### (Real-time multiplayer, browser-based investment board game)

**Version:** 0.3 (Draft — reflects shared ownership, betting, Jail/cards, and building)
**Owner:** Gold
**Status:** Playable scaffold implemented — see `/lib/game` for the authoritative engine

---

## 1. Product Summary

Gride is a real-time multiplayer, browser-based board game that borrows Monopoly's core loop (move, land, acquire, collect, bankrupt) and reframes it as an investment simulation. Players build a diversified portfolio across **Property, Tech Companies, Contracts, Betting Companies, Crypto, Startups, and Bonds**, competing to grow net worth within a host-defined time/round limit and win condition.

Phase 1 launches with **demo (play) currency only**. The architecture is built "wallet-ready" so real-money play can be enabled later once licensing, KYC, and payment compliance are in place per jurisdiction.

This revision adds the mechanics needed to genuinely mirror Monopoly's texture rather than just its shape: **Chance and Community cards, a real Jail (bail / cards / doubles-to-escape), and houses/hotels built on properties you own** — on top of the v0.2 additions (dynamic board size, shared investment ownership, the Betting Company, and contestable/expiring contracts).

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (React) + TypeScript | |
| 3D Rendering | Three.js (via React Three Fiber) | Per-asset-type geometry, dynamic board layout |
| Realtime/Multiplayer | Socket.IO room server | Turn sync, market events, card draws, jail state |
| Backend API | Next.js API routes (room creation) + standalone Socket.IO server | |
| Database | PostgreSQL + Prisma ORM | Users, Wallets, Rooms, AssetDefinitions, GameActions, BetPlacements |
| Cache/session state | Redis | Presence |
| Game engine | Pure TypeScript in `/lib/game`, isomorphic (runs identically on client and server) | |

---

## 3. High-Level Architecture

The room server (`server/index.ts`) holds one authoritative `GameState` per room in memory, mutated only through pure functions in `lib/game/engine.ts`. Every mutation is broadcast to the room over Socket.IO and (for durable records) persisted to Postgres as a `GameAction`. The board layout itself (`lib/game/board.ts`) is a pure function of `boardSize`, so the client independently regenerates the identical tile set from a single number rather than receiving it over the wire.

```
Client (Next.js + R3F)  <--Socket.IO-->  Room Server (authoritative GameState)
        |                                        |
        | REST (create room)                     | Redis (presence)
        v                                        v
   /api/rooms  ------------------------->   PostgreSQL (Prisma)
```

---

## 4. Data Model

Implemented in `prisma/schema.prisma`. Durable: `User`, `Wallet`/`Transaction` (real-money-ready, demo-only in Phase 1), `Room`, `RoomPlayer`, `AssetDefinition`, `OwnedAsset`, `BetPlacement`, `Loan`, `MarketEvent`, `GameAction`. The in-memory `GameState` (see `lib/game/types.ts`) is the live source of truth during a game; Postgres receives an action log for audit and a snapshot on room creation/end.

Key v0.2/0.3 additions to the original schema:
- `AssetDefinition.currentValue` / `landingFeePercent` — every rent, fee, or payout derives from live value, never `basePrice`.
- `OwnedAsset.amountInvested` / `ownershipPercent` — supports multiple players holding the same shared asset (Tech/Crypto/Startup).
- `BetPlacement` — one row per bet placed at a Betting Company tile.
- `Room.settings.boardSize` — tiles-per-side, minimum 10, host-configurable.

---

## 5. Game Systems

### 5.1 Room Creation & Settings
Host configures: win condition (bankrupt-all / net-worth target / timed), duration + turn timer, **starting capital** (equal for every player, no player-funded buy-in), **board size** (tiles per side, min 10 — total tiles = `4 × (boardSize − 1)`), and max players.

### 5.2 Board Layout
Four corners: **GO**, **Jail** (just visiting unless sent there), **Exchange Floor** (neutral), **Go To Jail** (sends you straight to Jail). The remaining perimeter cycles through Property, Bond, Contract, Betting Company, Tech Company, Crypto, Startup, **Chance**, and **Community** tiles — generated procedurally so any board size produces a well-mixed layout (`lib/game/board.ts`).

### 5.3 Asset Classes & Ownership
| Asset | Risk | Ownership | Behavior |
|---|---|---|---|
| Property | Low | Single owner | Buildable — 1–4 houses then a hotel; rent scales with build level and current land value |
| Contract | Medium | Single owner, contestable | Recurring income; a landing player can buy the holder out at current value (holder is refunded exactly what they paid); expires after 15 turns unless renewed |
| Betting Company | High (owner), variable (bettor) | Single owner (the house) | Landing player picks Color (2×), Range (3×), or Number (35×) and a stake, or pays a landing fee instead |
| Tech Company | Medium | **Shared** | Any player can invest; ownership % = their $ ÷ total $ invested; dividends paid per round |
| Crypto | High | Shared | Same as Tech, harder market swings |
| Startup | High | Shared | Cheap buy-in, can multiply or collapse to zero |
| Bond | Low | Single owner | Steady, low fixed return + light rent-equivalent |

**Universal value rule:** every rent, landing fee, or payout is computed from an asset's *current* value (`tileCurrentValue` in the engine), never its original price.

### 5.4 Market Events
Fire automatically every `marketEventEveryNTurns` turns, shifting one asset type's `valueMultiplier` (and therefore every rent/fee/payout tied to it) for the whole table.

### 5.5 Chance & Community Cards
Landing on a Chance or Community tile draws a card from `lib/game/cards.ts` and applies its effect immediately: collect/pay cash, collect/pay every other player, move to a specific tile or relative steps (with GO salary handled correctly), go directly to Jail, receive a Get Out of Jail Free card, or pay building-repair costs proportional to houses/hotels owned. Chance skews toward bigger swings; Community toward smaller, steadier outcomes — mirroring the classic decks' personalities.

### 5.6 Jail
Landing on **Go To Jail**, drawing a "go to jail" card, or rolling three doubles in a row sends a player to Jail. While jailed, a player's turn offers three choices instead of a normal roll: **pay $50 bail**, **use a Get Out of Jail Free card**, or **attempt to roll doubles** (up to 3 tries — on the 3rd failed attempt, bail is paid automatically and they move). This is handled by dedicated engine functions (`payBail`, `useJailCard`, `attemptJailRoll`) rather than the generic decision system, since it replaces the roll itself.

### 5.7 Building
A player who owns a Property (single-owner type) can build on it any time it's their turn and nothing else is pending — no color-group requirement, since Gride's board isn't grouped by color sets. Cost scales with build level (`basePrice × 0.5 × (level + 1)`); rent multiplies at each level (1×/2×/3×/4×/5× for 1–4 houses, 8× for a hotel at level 5). Building state lives on the shared `TileMarketState`, so it's visible to every player, not just the owner.

### 5.8 Bankruptcy
On hitting zero cash with no remaining assets to fall back on, a player goes `bankrupt` and drops out of the turn rotation (but can keep spectating).

### 5.9 Loans (Bank/Exchange lending)
Borrowed from the Bank, not other players. Gradual repayment in fixed installments, auto-deducted from passive income first. Missed payments escalate: penalty interest → forced low-value-asset liquidation → default/seizure. A Betting Company owner who can't cover a payout is automatically issued an emergency loan for the shortfall rather than going instantly bankrupt.

### 5.10 Doubles
Rolling doubles grants an extra roll in the same turn (the engine blocks a second *non-doubles* roll until End Turn). Three doubles in a row sends the player to Jail instead of moving.

---

## 6. UI/UX Design

### 6.1 Visual Direction
Charcoal base (`#121417`), emerald primary (`#0B6E4F`/`#12A66A`), gold accent (`#D4AF37`/`#F0B94A`), deep purple for the volatile tech/crypto/startup category (`#4A2E6B`), a single defined red for negative states (`#C13A3A`) — "private bank meets high-stakes table," deliberately avoiding fintech blue.

### 6.2 Core Screens
Landing page → Lobby (room settings incl. board size) → Waiting Room (player list, host-triggered start) → In-Game Dashboard (3D board, wallet/portfolio side panel, activity log, roll/end-turn/jail controls) → decision modals (buy, contract buyout, invest-or-fee, bet-or-fee, contract renewal, market event, card draw) → End-Game Summary (net worth ranking).

### 6.3 Wallet / Portfolio Panel
Cash, net worth, a live portfolio list (single-owner assets at 100%, shared assets show this player's ownership % and live P&L), active loans with a borrow control, and a scrolling activity log. Property rows show an inline **Build** button once it's your turn.

### 6.4 Tile Info Panel
Hovering (desktop) or tapping (touch) any tile on the 3D board surfaces a floating panel (`components/TileInfoPanel.tsx`) with exactly the fields relevant to that tile type — price, rent/build level, owner, income rate, bet multipliers, or investment stake and volatility — so no separate menu is ever required to evaluate a landing.

---

## 7. 3D Board

Three.js via React Three Fiber. Board size is fully dynamic — tile positions are computed from `boardSize` by walking a square perimeter, not hardcoded. Each asset type renders a distinct primitive so it's readable without the info panel: Property a cube, Bond a cylinder "vault," Betting Company a torus "wheel," Tech a tall glass-tinted tower, Crypto an octahedron "crystal," Startup a cone "rocket," Contract a flat disc (paper asset, no structure). Player tokens are colored cones that group and offset when sharing a tile. Camera defaults to an isometric-angled auto-rotating orbit.

---

## 8. Real-Time & Chat

Room-scoped Socket.IO channel carries turn state, dice rolls, card draws, market events, ownership changes, and jail state. Text chat and voice remain explicitly deferred (flagged as future scope). Disconnects mark a player `disconnected` without forfeiting their seat immediately.

---

## 9. Real-Money Readiness (Future Phase — Not Active at Launch)

Unchanged from v0.1: `Wallet.currency`, the `Transaction` log, and `RoomPlayer.inGameBalance` are already structured so a real-money toggle doesn't require a schema migration. Enabling it requires jurisdiction-specific licensing, KYC/AML, and payment processor integration — not implemented, not legal advice.

---

## 10. Open Questions / Next Decisions

- Exact card deck size/content — current decks are a representative starter set, not exhaustive.
- Whether property color-grouping (monopoly bonus rent) is worth adding given Gride's mixed-type board.
- Selling/mortgaging assets outright (currently: hold, get outbid, get liquidated on default, or lose in a market crash — no voluntary sale/mortgage flow yet).
- Trading between players (direct asset-for-asset or asset-for-cash trades) — not yet implemented.
- Reconnection grace-period timing before a disconnected seat is auto-forfeited.
- Tuning pass on bet win probabilities, loan interest curve, and building costs once playtested.

---

*This document is a living draft and should be updated as architecture and design decisions are finalized.*
