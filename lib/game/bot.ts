import { boardIndex, ESTATE_VALUE_MULTIPLIER } from "./board";
import {
  applyRoll,
  attemptJailRoll,
  auctionBid,
  auctionPass,
  buildHouse,
  computeNetWorth,
  currentPlayerId,
  endTurn,
  getColorGroupStatus,
  getPlayerAssets,
  payBail,
  resolveBetOrFee,
  resolveBuy,
  resolveInvestOrFee,
  resolveOutbid,
  resolveRenewOrRelease,
  takeLoan,
  tileCurrentValue,
  useJailCard,
  whoMustAct,
} from "./engine";
import type { BoardTile, BotDifficulty, GameState } from "./types";

/**
 * The bot is a *policy* layered on top of the pure engine — it never mutates
 * state itself, it only chooses which existing engine action to call. That keeps
 * bots and humans on exactly the same rules (a bot can do nothing a human
 * couldn't) and lets the whole thing be unit-tested by driving a deterministic
 * `Math.random` sequence, since the only randomness lives inside the engine.
 *
 * All three tiers share one decision procedure; they differ only in the numeric
 * appetites below. The tuning intent, roughly:
 *   - easy   — loose and gambly: overpays, over-bets, under-builds.
 *   - medium — balanced.
 *   - hard   — disciplined: cheap buys, deep cash buffer, never gambles on the
 *              betting wheel, builds monopolies out fully, buys out rivals.
 */
export interface BotConfig {
  /** Keep at least this fraction of starting capital as free cash after any spend. */
  cashBufferPct: number;
  /** Buy an ordinary (ungrouped) tile only if its price ≤ current value × this. */
  buyCeiling: number;
  /** Buy a property/estate the bot already holds part of the color group for, up to value × this (monopolies justify overpaying). */
  monopolyCeiling: number;
  /** Bid in an auction up to current value × this. */
  auctionCeiling: number;
  /** Invest in a shared tile only if its volatility ≤ this. */
  investRiskCap: number;
  /** Whether this bot will ever place a betting-company bet (otherwise it always pays the flat landing fee). */
  willBet: boolean;
  /** Fraction of current cash to stake when it does bet. */
  betStakeFraction: number;
  /** 0–1: how freely it spends spare cash on buildings (1 = builds right down to the buffer). */
  buildAggression: number;
  /** Whether it will pay to buy out another player's contract on landing. */
  outbidContracts: boolean;
}

export const BOT_CONFIGS: Record<BotDifficulty, BotConfig> = {
  easy: {
    cashBufferPct: 0.05,
    buyCeiling: 1.35,
    monopolyCeiling: 1.5,
    auctionCeiling: 1.3,
    investRiskCap: 0.8,
    willBet: true,
    betStakeFraction: 0.15,
    buildAggression: 0.4,
    outbidContracts: false,
  },
  medium: {
    cashBufferPct: 0.15,
    buyCeiling: 1.1,
    monopolyCeiling: 1.3,
    auctionCeiling: 1.05,
    investRiskCap: 0.5,
    willBet: true,
    betStakeFraction: 0.06,
    buildAggression: 0.7,
    outbidContracts: false,
  },
  hard: {
    cashBufferPct: 0.22,
    buyCeiling: 1.0,
    monopolyCeiling: 1.35,
    auctionCeiling: 1.15,
    investRiskCap: 0.35,
    willBet: false,
    betStakeFraction: 0,
    buildAggression: 1.0,
    outbidContracts: true,
  },
};

export type BotAction =
  | { type: "roll" }
  | { type: "endTurn" }
  | { type: "payBail" }
  | { type: "useJailCard" }
  | { type: "attemptJailRoll" }
  | { type: "buyDecision"; accept: boolean }
  | { type: "outbidDecision"; accept: boolean }
  | { type: "investDecision"; invest: boolean }
  | { type: "betDecision"; choice: "bet" | "fee"; betType?: "color" | "range" | "number"; stakeAmount?: number }
  | { type: "renewDecision"; renew: boolean }
  | { type: "build"; tileId: string }
  | { type: "takeLoan"; principal: number }
  | { type: "auctionBid"; amount: number }
  | { type: "auctionPass" }
  | { type: "noop" };

// Mirrors of the two engine constants the bot needs to *predict* a cost before
// committing (the engine stays the single source of truth for applying them).
const JAIL_BAIL = 50;
const BUILD_COST_PCT_OF_BASE = 0.5;
const MAX_BUILD_LEVEL = 5;
const LOAN_CAP_PCT_OF_NET_WORTH = 0.75;

function configFor(state: GameState, botId: string, difficulty?: BotDifficulty): BotConfig {
  const tier = difficulty ?? state.players[botId]?.botDifficulty ?? "medium";
  return BOT_CONFIGS[tier] ?? BOT_CONFIGS.medium;
}

function cashBuffer(state: GameState, cfg: BotConfig): number {
  return Math.round(cfg.cashBufferPct * state.settings.startingCapital);
}

/** What `buildHouse` will charge for the next level on this tile — kept in sync with engine.ts. */
function buildCostFor(tile: BoardTile, currentLevel: number): number {
  const isEstate = tile.type === "estate";
  return Math.round(tile.basePrice * BUILD_COST_PCT_OF_BASE * (currentLevel + 1) * (isEstate ? ESTATE_VALUE_MULTIPLIER : 1));
}

/** Cheapest house the bot can build right now on a fully-owned color group, respecting its buffer and aggression. Null if it shouldn't build. */
function pickBuild(state: GameState, botId: string, cfg: BotConfig, buffer: number): string | null {
  const idx = boardIndex(state.boardSize);
  const cash = state.players[botId].inGameBalance;
  let best: { tileId: string; cost: number } | null = null;

  for (const asset of getPlayerAssets(state, botId)) {
    if (asset.type !== "property" && asset.type !== "estate") continue;
    if (asset.mortgaged) continue;
    const level = asset.buildLevel ?? 0;
    if (level >= MAX_BUILD_LEVEL) continue;

    const status = getColorGroupStatus(state, asset.tileId, botId);
    if (!status || !status.ownsAll) continue; // must own the whole group to build

    const tile = idx.byId[asset.tileId];
    if (!tile) continue;
    const cost = buildCostFor(tile, level);
    // Higher aggression tolerates a thinner cash cushion after building.
    const requiredLeftover = buffer + (1 - cfg.buildAggression) * cost;
    if (cash - cost < requiredLeftover) continue;

    if (!best || cost < best.cost) best = { tileId: asset.tileId, cost };
  }
  return best?.tileId ?? null;
}

/**
 * Pure: choose the single best legal action for `botId` in the current state.
 * Deterministic — the roll/bet randomness it triggers lives inside the engine —
 * so a fixed `Math.random` sequence makes an entire bot game reproducible.
 */
export function decideBotAction(state: GameState, botId: string, difficulty?: BotDifficulty): BotAction {
  const player = state.players[botId];
  if (!player || player.status !== "active") return { type: "noop" };

  const cfg = configFor(state, botId, difficulty);
  const buffer = cashBuffer(state, cfg);
  const cash = player.inGameBalance;

  // 1) Auction — a bot must respond whenever the bidding lands on it, even in an
  //    auction another player triggered.
  const auction = state.auction;
  if (auction && auction.currentTurnPlayerId === botId) {
    if (auction.highestBidderId === botId) return { type: "auctionPass" }; // already leading; never bid against ourselves
    const value = tileCurrentValue(state, auction.tileId);
    const minBid = auction.highestBid + auction.minIncrement;
    if (minBid <= value * cfg.auctionCeiling && cash >= minBid) return { type: "auctionBid", amount: minBid };
    return { type: "auctionPass" };
  }

  // 2) A landing decision aimed at this bot.
  const pd = state.pendingDecision;
  if (pd && pd.playerId === botId) {
    const idx = boardIndex(state.boardSize);
    const tile = idx.byId[pd.tileId];
    const value = tileCurrentValue(state, pd.tileId);

    switch (pd.kind) {
      case "buy_or_skip": {
        const status = getColorGroupStatus(state, pd.tileId, botId);
        const extendsGroup = !!status && status.ownedByPlayer > 0; // already hold part of this set
        const ceiling = extendsGroup ? cfg.monopolyCeiling : cfg.buyCeiling;
        const affordable = cash - pd.price >= buffer;
        return { type: "buyDecision", accept: affordable && pd.price <= value * ceiling };
      }
      case "outbid_or_skip": {
        if (!cfg.outbidContracts) return { type: "outbidDecision", accept: false };
        const affordable = cash - pd.price >= buffer;
        return { type: "outbidDecision", accept: affordable && pd.price <= value * cfg.buyCeiling };
      }
      case "invest_or_fee": {
        const tooRisky = tile ? tile.volatility > cfg.investRiskCap : true;
        const affordable = cash - pd.price >= buffer;
        return { type: "investDecision", invest: !tooRisky && affordable };
      }
      case "bet_or_fee": {
        if (!cfg.willBet) return { type: "betDecision", choice: "fee" };
        const stake = Math.round(cfg.betStakeFraction * cash);
        if (stake > 0 && cash - stake >= buffer) {
          return { type: "betDecision", choice: "bet", betType: "color", stakeAmount: stake };
        }
        return { type: "betDecision", choice: "fee" };
      }
      case "renew_or_release": {
        const worthKeeping = tile ? tile.baseIncomeRate > 0 : false;
        const affordable = cash - pd.price >= buffer;
        return { type: "renewDecision", renew: worthKeeping && affordable };
      }
    }
  }

  // 3) The bot's own turn, nothing else pending.
  if (currentPlayerId(state) === botId) {
    if (player.inJail) {
      if (player.getOutOfJailFreeCards > 0) return { type: "useJailCard" };
      // Disciplined bots pay to get moving again; loose ones gamble on a doubles roll.
      if (cfg.buildAggression >= 0.7 && cash - JAIL_BAIL >= buffer) return { type: "payBail" };
      return { type: "attemptJailRoll" };
    }

    // Roll first. Doubles come back here with hasRolledThisTurn still false → we roll again.
    if (!player.hasRolledThisTurn) return { type: "roll" };

    // Post-roll management. Every branch here must change state, or we fall through to endTurn.
    // Rescue loan: if a rent/fee pushed us negative, borrow back above the buffer — at most once per turn.
    if (cash < 0 && !player.loans.some((l) => l.createdAtTurn === state.turnNumber)) {
      const cap = Math.floor(Math.max(0, computeNetWorth(state, botId) * LOAN_CAP_PCT_OF_NET_WORTH));
      const principal = Math.min(Math.ceil(-cash + buffer), cap);
      if (principal > 0) return { type: "takeLoan", principal };
    }

    const build = pickBuild(state, botId, cfg, buffer);
    if (build) return { type: "build", tileId: build };

    return { type: "endTurn" };
  }

  // Not our turn and nothing pending for us.
  return { type: "noop" };
}

/** Maps a chosen BotAction onto the matching pure engine call. */
export function applyBotAction(state: GameState, botId: string, action: BotAction): GameState {
  switch (action.type) {
    case "roll":
      return applyRoll(state, botId);
    case "endTurn":
      return endTurn(state, botId);
    case "payBail":
      return payBail(state, botId);
    case "useJailCard":
      return useJailCard(state, botId);
    case "attemptJailRoll":
      return attemptJailRoll(state, botId);
    case "buyDecision":
      return resolveBuy(state, botId, action.accept);
    case "outbidDecision":
      return resolveOutbid(state, botId, action.accept);
    case "investDecision":
      return resolveInvestOrFee(state, botId, action.invest);
    case "betDecision":
      return resolveBetOrFee(state, botId, action.choice, action.betType, action.stakeAmount);
    case "renewDecision":
      return resolveRenewOrRelease(state, botId, action.renew);
    case "build":
      return buildHouse(state, botId, action.tileId);
    case "takeLoan":
      return takeLoan(state, botId, action.principal);
    case "auctionBid":
      return auctionBid(state, botId, action.amount);
    case "auctionPass":
      return auctionPass(state, botId);
    case "noop":
      return state;
  }
}

/** Force the safest terminating resolution of whatever decision is pending — the livelock backstop. */
function forceDeclinePending(state: GameState, botId: string): GameState {
  const pd = state.pendingDecision;
  if (!pd || pd.playerId !== botId) return state;
  switch (pd.kind) {
    case "buy_or_skip":
      return resolveBuy(state, botId, false);
    case "outbid_or_skip":
      return resolveOutbid(state, botId, false);
    case "invest_or_fee":
      return resolveInvestOrFee(state, botId, false);
    case "bet_or_fee":
      return resolveBetOrFee(state, botId, "fee");
    case "renew_or_release":
      return resolveRenewOrRelease(state, botId, false);
  }
}

/** A cheap fingerprint of everything a legal action would move — used only to detect a stall. */
function progressSignature(state: GameState, botId: string): string {
  const p = state.players[botId];
  const built = getPlayerAssets(state, botId).reduce((sum, a) => sum + (a.buildLevel ?? 0), 0);
  return [
    state.turnNumber,
    state.currentPlayerIndex,
    state.auction ? `${state.auction.highestBid}:${state.auction.activePlayerIds.length}:${state.auction.currentTurnPlayerId}` : "-",
    state.pendingDecision ? state.pendingDecision.kind : "-",
    p?.position ?? -1,
    Math.round(p?.inGameBalance ?? 0),
    p?.hasRolledThisTurn ? 1 : 0,
    p?.inJail ? 1 : 0,
    p?.jailTurns ?? 0,
    p?.loans.length ?? 0,
    built,
  ].join("|");
}

/**
 * Advance the game by exactly one bot decision, guaranteeing forward progress.
 * This is the single entry point the room server drives on a timer, and what the
 * tests loop over. If the chosen action somehow leaves the same bot still on the
 * clock with nothing changed (a policy bug, or an action the engine rejected), a
 * terminating fallback is forced so an all-bot table can never livelock.
 */
export function stepBot(state: GameState, botId: string, difficulty?: BotDifficulty): GameState {
  const before = progressSignature(state, botId);
  const action = decideBotAction(state, botId, difficulty);
  let next = applyBotAction(state, botId, action);

  if (whoMustAct(next) === botId && progressSignature(next, botId) === before) {
    if (next.auction && next.auction.currentTurnPlayerId === botId) {
      next = auctionPass(next, botId);
    } else if (next.pendingDecision && next.pendingDecision.playerId === botId) {
      next = forceDeclinePending(next, botId);
    } else if (currentPlayerId(next) === botId) {
      next = endTurn(next, botId);
    }
  }
  return next;
}
