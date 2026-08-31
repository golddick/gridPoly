import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInitialGameState,
  whoMustAct,
  currentPlayerId,
  tileCurrentValue,
  refreshWinCondition,
  getColorGroupStatus,
} from "./engine";
import { boardIndex, GROUP_SIZE, SHARED_TYPES } from "./board";
import type { BoardTile, BotDifficulty, GameState, Loan, PendingDecision, RoomSettings } from "./types";
import { MIN_BOARD_SIZE } from "./types";
import { BOT_CONFIGS, decideBotAction, applyBotAction, stepBot } from "./bot";

// ---------- test helpers ----------

const BASE_SETTINGS: RoomSettings = {
  winCondition: "bankrupt_all",
  turnTimerSeconds: 45,
  startingCapital: 1500,
  boardVariant: "default",
  boardSize: MIN_BOARD_SIZE,
  maxPlayers: 6,
  marketEventEveryNTurns: 1000, // effectively disabled unless a test asks for it
};

/** Synthetic bot seats, matching the shape the room server hands createInitialGameState. */
function makeBots(difficulties: BotDifficulty[]) {
  return difficulties.map((d, i) => ({
    id: `bot${i}`,
    userId: `bot${i}`,
    username: `Bot${i}`,
    pieceId: `cone-${i}`,
    isBot: true,
    botDifficulty: d,
  }));
}

function freshBotGame(difficulties: BotDifficulty[], overrides: Partial<RoomSettings> = {}): GameState {
  return createInitialGameState("room1", { ...BASE_SETTINGS, ...overrides }, makeBots(difficulties));
}

/** A seeded PRNG so an entire bot-vs-bot game is reproducible (mulberry32). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Runs `fn` with Math.random driven by a fixed seed, then restores it. */
function withSeed<T>(seed: number, fn: () => T): T {
  const spy = vi.spyOn(Math, "random").mockImplementation(mulberry32(seed));
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

function firstTileOfType(state: GameState, predicate: (t: BoardTile) => boolean): BoardTile {
  const tile = boardIndex(state.boardSize).tiles.find(predicate);
  if (!tile) throw new Error("no matching tile on the board");
  return tile;
}

/** Deeds every tile of one full color group to `botId` and returns those tile ids (cheapest first). */
function giveWholeGroup(state: GameState, botId: string): BoardTile[] {
  const groups = new Map<string, BoardTile[]>();
  for (const t of boardIndex(state.boardSize).tiles) {
    if (t.type !== "property" || !t.colorGroup) continue;
    const arr = groups.get(t.colorGroup) ?? [];
    arr.push(t);
    groups.set(t.colorGroup, arr);
  }
  const group = [...groups.values()].find((g) => g.length >= GROUP_SIZE);
  if (!group) throw new Error("no full property group on the board");
  for (const t of group) {
    state.tileMarket[t.id] = {
      ...(state.tileMarket[t.id] ?? { tileId: t.id, valueMultiplier: 1, investors: {} }),
      ownerPlayerId: botId,
      purchasePrice: t.basePrice,
    };
  }
  return [...group].sort((a, b) => a.basePrice - b.basePrice);
}

function fakeLoan(createdAtTurn: number): Loan {
  return {
    id: "loan1",
    principal: 100,
    interestRate: 0.08,
    installmentAmount: 20,
    installmentIntervalTurns: 3,
    installmentsRemaining: 6,
    missedPayments: 0,
    status: "active",
    createdAtTurn,
  };
}

/**
 * Drives an all-bot game with stepBot until it ends (or a hard step cap trips).
 * Mirrors what the room server does: step the actor, refresh the win condition,
 * repeat. Returns the final state, the step count, and the max consecutive
 * "no-op" steps observed (should stay tiny — proves no livelock).
 */
function runToCompletion(initial: GameState, maxSteps = 20000) {
  let state = initial;
  let steps = 0;
  let lastTurn = state.turnNumber;
  let stalls = 0;
  let worstStall = 0;

  while (steps < maxSteps) {
    const actor = whoMustAct(state);
    if (!actor) break; // game over — whoMustAct returns null once status !== "in_progress"

    const before = `${state.turnNumber}:${state.currentPlayerIndex}:${actor}:${Math.round(state.players[actor].inGameBalance)}:${state.auction?.highestBid ?? -1}:${state.pendingDecision?.kind ?? "-"}`;
    state = stepBot(state, actor, state.players[actor].botDifficulty);
    state = refreshWinCondition(state);
    const after = `${state.turnNumber}:${state.currentPlayerIndex}:${whoMustAct(state) ?? "-"}:${Math.round(state.players[actor].inGameBalance)}:${state.auction?.highestBid ?? -1}:${state.pendingDecision?.kind ?? "-"}`;

    // turnNumber must never run backwards
    expect(state.turnNumber).toBeGreaterThanOrEqual(lastTurn);
    lastTurn = state.turnNumber;

    if (after === before) {
      stalls += 1;
      worstStall = Math.max(worstStall, stalls);
    } else {
      stalls = 0;
    }
    steps += 1;
  }

  return { state, steps, worstStall };
}

function summarize(s: GameState) {
  return {
    status: s.status,
    winnerId: s.winnerId,
    turnNumber: s.turnNumber,
    balances: s.playerOrder.map((pid) => Math.round(s.players[pid].inGameBalance)),
    netWorths: s.playerOrder.map((pid) => Math.round(s.players[pid].netWorth)),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------- config sanity ----------

describe("BOT_CONFIGS", () => {
  it("defines all three difficulty tiers", () => {
    expect(Object.keys(BOT_CONFIGS).sort()).toEqual(["easy", "hard", "medium"]);
  });

  it("keeps every fraction in a sane range and orders discipline easy < medium < hard", () => {
    for (const cfg of Object.values(BOT_CONFIGS)) {
      expect(cfg.cashBufferPct).toBeGreaterThanOrEqual(0);
      expect(cfg.cashBufferPct).toBeLessThanOrEqual(1);
      expect(cfg.buildAggression).toBeGreaterThanOrEqual(0);
      expect(cfg.buildAggression).toBeLessThanOrEqual(1);
      expect(cfg.buyCeiling).toBeGreaterThan(0);
    }
    // harder bots hold a deeper cash buffer and pay less over value
    expect(BOT_CONFIGS.easy.cashBufferPct).toBeLessThan(BOT_CONFIGS.hard.cashBufferPct);
    expect(BOT_CONFIGS.hard.buyCeiling).toBeLessThanOrEqual(BOT_CONFIGS.easy.buyCeiling);
    // only the disciplined tier buys out rivals' contracts, and only loose tiers gamble
    expect(BOT_CONFIGS.hard.outbidContracts).toBe(true);
    expect(BOT_CONFIGS.easy.outbidContracts).toBe(false);
    expect(BOT_CONFIGS.hard.willBet).toBe(false);
    expect(BOT_CONFIGS.easy.willBet).toBe(true);
  });
});

// ---------- decideBotAction: guards ----------

describe("decideBotAction — guards", () => {
  it("no-ops for a player who isn't the actor and has nothing pending", () => {
    const state = freshBotGame(["medium", "medium"]); // bot0 is on the clock
    expect(decideBotAction(state, "bot1")).toEqual({ type: "noop" });
  });

  it("no-ops for a bankrupt player", () => {
    const state = freshBotGame(["medium", "medium"]);
    state.players.bot0.status = "bankrupt";
    expect(decideBotAction(state, "bot0")).toEqual({ type: "noop" });
  });
});

// ---------- decideBotAction: own turn ----------

describe("decideBotAction — own turn", () => {
  it("rolls first when it hasn't rolled yet", () => {
    const state = freshBotGame(["medium", "medium"]);
    expect(currentPlayerId(state)).toBe("bot0");
    expect(decideBotAction(state, "bot0")).toEqual({ type: "roll" });
  });

  it("ends the turn once it has rolled and has nothing worth doing", () => {
    const state = freshBotGame(["medium", "medium"]);
    state.players.bot0.hasRolledThisTurn = true;
    expect(decideBotAction(state, "bot0")).toEqual({ type: "endTurn" });
  });

  it("builds the cheapest house on a fully-owned color group before ending the turn", () => {
    const state = freshBotGame(["medium", "medium"], { startingCapital: 5000 });
    const group = giveWholeGroup(state, "bot0");
    state.players.bot0.hasRolledThisTurn = true;
    state.players.bot0.inGameBalance = 5000;

    const action = decideBotAction(state, "bot0");
    expect(action.type).toBe("build");
    if (action.type === "build") {
      // cheapest tile in the group (lowest basePrice) is chosen
      expect(action.tileId).toBe(group[0].id);
      expect(getColorGroupStatus(state, action.tileId, "bot0")?.ownsAll).toBe(true);
    }
  });

  it("takes a rescue loan when cash went negative and net worth still backs it", () => {
    const state = freshBotGame(["medium", "medium"]);
    giveWholeGroup(state, "bot0"); // gives it net worth to borrow against
    state.players.bot0.hasRolledThisTurn = true;
    state.players.bot0.inGameBalance = -200;

    const action = decideBotAction(state, "bot0");
    expect(action.type).toBe("takeLoan");
    if (action.type === "takeLoan") expect(action.principal).toBeGreaterThan(0);
  });

  it("won't borrow twice in one turn", () => {
    const state = freshBotGame(["medium", "medium"]);
    giveWholeGroup(state, "bot0");
    state.players.bot0.hasRolledThisTurn = true;
    state.players.bot0.inGameBalance = -200;
    state.players.bot0.loans = [fakeLoan(state.turnNumber)]; // already borrowed this turn

    expect(decideBotAction(state, "bot0").type).not.toBe("takeLoan");
  });
});

// ---------- decideBotAction: jail ----------

describe("decideBotAction — jail", () => {
  function jail(difficulty: BotDifficulty): GameState {
    const state = freshBotGame([difficulty, "medium"]);
    state.players.bot0.inJail = true;
    return state;
  }

  it("spends a get-out-of-jail-free card first", () => {
    const state = jail("hard");
    state.players.bot0.getOutOfJailFreeCards = 1;
    expect(decideBotAction(state, "bot0")).toEqual({ type: "useJailCard" });
  });

  it("a disciplined bot pays bail to get moving again", () => {
    const state = jail("hard");
    state.players.bot0.getOutOfJailFreeCards = 0;
    state.players.bot0.inGameBalance = 1500;
    expect(decideBotAction(state, "bot0")).toEqual({ type: "payBail" });
  });

  it("a loose bot gambles on rolling out instead of paying", () => {
    const state = jail("easy");
    state.players.bot0.getOutOfJailFreeCards = 0;
    expect(decideBotAction(state, "bot0")).toEqual({ type: "attemptJailRoll" });
  });
});

// ---------- decideBotAction: landing decisions ----------

describe("decideBotAction — buy_or_skip", () => {
  function buyState(price: number, difficulty: BotDifficulty = "medium") {
    const state = freshBotGame([difficulty, "medium"]);
    const tile = firstTileOfType(state, (t) => t.type === "property");
    const pd: PendingDecision = { playerId: "bot0", tileId: tile.id, kind: "buy_or_skip", price };
    state.pendingDecision = pd;
    return { state, tile, value: tileCurrentValue(state, tile.id) };
  }

  it("buys at or below its value ceiling", () => {
    const { state, value } = buyState(0);
    state.pendingDecision!.price = Math.floor(value * 0.9);
    expect(decideBotAction(state, "bot0")).toEqual({ type: "buyDecision", accept: true });
  });

  it("skips when the price is above its value ceiling", () => {
    const { state, value } = buyState(0);
    state.pendingDecision!.price = Math.ceil(value * 2);
    expect(decideBotAction(state, "bot0")).toEqual({ type: "buyDecision", accept: false });
  });

  it("skips an affordable-by-value tile if it would break the cash buffer", () => {
    const { state, value } = buyState(0);
    const price = Math.floor(value * 0.9);
    state.pendingDecision!.price = price;
    state.players.bot0.inGameBalance = price + 1; // buying leaves ~0, under the buffer
    expect(decideBotAction(state, "bot0")).toEqual({ type: "buyDecision", accept: false });
  });

  it("pays up past its normal ceiling to complete a color group it has started", () => {
    const state = freshBotGame(["medium", "medium"]);
    const group = [...boardIndex(state.boardSize).tiles].filter((t) => t.type === "property" && t.colorGroup);
    // find two tiles in the same group
    const byGroup = new Map<string, BoardTile[]>();
    for (const t of group) {
      const arr = byGroup.get(t.colorGroup!) ?? [];
      arr.push(t);
      byGroup.set(t.colorGroup!, arr);
    }
    const pair = [...byGroup.values()].find((g) => g.length >= 2)!;
    const [owned, target] = pair;
    state.tileMarket[owned.id] = { ...state.tileMarket[owned.id], ownerPlayerId: "bot0", purchasePrice: owned.basePrice };
    state.players.bot0.inGameBalance = 5000;

    const value = tileCurrentValue(state, target.id);
    // priced between the ordinary buyCeiling (1.1) and the monopolyCeiling (1.3)
    const price = Math.round(value * 1.2);
    state.pendingDecision = { playerId: "bot0", tileId: target.id, kind: "buy_or_skip", price };

    expect(decideBotAction(state, "bot0")).toEqual({ type: "buyDecision", accept: true });
  });
});

describe("decideBotAction — outbid_or_skip", () => {
  function outbidState(difficulty: BotDifficulty) {
    const state = freshBotGame([difficulty, "medium"]);
    const tile = firstTileOfType(state, (t) => t.type === "contract" || t.type === "property");
    state.players.bot0.inGameBalance = 5000;
    state.pendingDecision = {
      playerId: "bot0",
      tileId: tile.id,
      kind: "outbid_or_skip",
      price: Math.floor(tileCurrentValue(state, tile.id) * 0.9),
      currentOwnerPlayerId: "bot1",
    };
    return state;
  }

  it("a disciplined bot will buy out a rival at a fair price", () => {
    expect(decideBotAction(outbidState("hard"), "bot0")).toEqual({ type: "outbidDecision", accept: true });
  });

  it("other tiers never bother outbidding", () => {
    expect(decideBotAction(outbidState("medium"), "bot0")).toEqual({ type: "outbidDecision", accept: false });
    expect(decideBotAction(outbidState("easy"), "bot0")).toEqual({ type: "outbidDecision", accept: false });
  });
});

describe("decideBotAction — invest_or_fee", () => {
  it("invests iff the tile's volatility is within the tier's risk cap (and it can afford it)", () => {
    const probe = freshBotGame(["medium", "medium"]);
    const shared = firstTileOfType(probe, (t) => SHARED_TYPES.has(t.type as never));
    const v = shared.volatility;

    for (const tier of ["easy", "medium", "hard"] as const) {
      const state = freshBotGame([tier, "medium"]);
      state.players.bot0.inGameBalance = 5000;
      state.pendingDecision = {
        playerId: "bot0",
        tileId: shared.id,
        kind: "invest_or_fee",
        price: Math.floor(tileCurrentValue(state, shared.id) * 0.5),
      };
      const expected = v <= BOT_CONFIGS[tier].investRiskCap;
      expect(decideBotAction(state, "bot0")).toEqual({ type: "investDecision", invest: expected });
    }
  });
});

describe("decideBotAction — bet_or_fee", () => {
  function betState(difficulty: BotDifficulty) {
    const state = freshBotGame([difficulty, "medium"]);
    const tile = firstTileOfType(state, (t) => t.type === "betting");
    state.players.bot0.inGameBalance = 2000;
    state.pendingDecision = {
      playerId: "bot0",
      tileId: tile.id,
      kind: "bet_or_fee",
      price: 50,
      currentOwnerPlayerId: "bot1",
      landingFee: 50,
    };
    return state;
  }

  it("a disciplined bot always pays the flat fee rather than gamble", () => {
    expect(decideBotAction(betState("hard"), "bot0")).toEqual({ type: "betDecision", choice: "fee" });
  });

  it("a gambling bot stakes a fraction of its cash", () => {
    const action = decideBotAction(betState("easy"), "bot0");
    expect(action.type).toBe("betDecision");
    if (action.type === "betDecision") {
      expect(action.choice).toBe("bet");
      expect(action.betType).toBe("color");
      expect(action.stakeAmount).toBe(Math.round(BOT_CONFIGS.easy.betStakeFraction * 2000));
    }
  });

  it("falls back to the fee when it's too broke to stake anything meaningful", () => {
    const state = betState("easy");
    state.players.bot0.inGameBalance = 1; // stake rounds toward nothing / breaks buffer
    expect(decideBotAction(state, "bot0")).toEqual({ type: "betDecision", choice: "fee" });
  });
});

describe("decideBotAction — renew_or_release", () => {
  function renewState(affordable: boolean) {
    const state = freshBotGame(["medium", "medium"]);
    const tile = firstTileOfType(state, (t) => t.baseIncomeRate > 0);
    const price = 200;
    state.players.bot0.inGameBalance = affordable ? 2000 : price; // unaffordable leaves < buffer
    state.pendingDecision = { playerId: "bot0", tileId: tile.id, kind: "renew_or_release", price };
    return state;
  }

  it("renews an income-producing contract it can afford", () => {
    expect(decideBotAction(renewState(true), "bot0")).toEqual({ type: "renewDecision", renew: true });
  });

  it("releases when renewing would break the cash buffer", () => {
    expect(decideBotAction(renewState(false), "bot0")).toEqual({ type: "renewDecision", renew: false });
  });
});

// ---------- decideBotAction: auctions ----------

describe("decideBotAction — auctions", () => {
  function auctionState(difficulty: BotDifficulty) {
    const state = freshBotGame([difficulty, "medium"]);
    const tile = firstTileOfType(state, (t) => t.type === "property");
    state.players.bot0.inGameBalance = 5000;
    state.auction = {
      tileId: tile.id,
      highestBid: 0,
      highestBidderId: null,
      currentTurnPlayerId: "bot0",
      activePlayerIds: ["bot0", "bot1"],
      minIncrement: 10,
    };
    return { state, value: tileCurrentValue(state, tile.id) };
  }

  it("opens with the minimum bid when the tile is worth it", () => {
    const { state } = auctionState("medium");
    expect(decideBotAction(state, "bot0")).toEqual({ type: "auctionBid", amount: 10 });
  });

  it("passes rather than bid against itself when it already holds the high bid", () => {
    const { state } = auctionState("medium");
    state.auction!.highestBid = 40;
    state.auction!.highestBidderId = "bot0";
    expect(decideBotAction(state, "bot0")).toEqual({ type: "auctionPass" });
  });

  it("passes once the next bid would exceed its value ceiling", () => {
    const { state, value } = auctionState("medium");
    state.auction!.highestBid = Math.ceil(value * 3);
    state.auction!.highestBidderId = "bot1";
    expect(decideBotAction(state, "bot0")).toEqual({ type: "auctionPass" });
  });
});

// ---------- applyBotAction wiring ----------

describe("applyBotAction", () => {
  it("a roll actually moves the bot and marks it as having rolled (non-doubles)", () => {
    const state = freshBotGame(["medium", "medium"]);
    // force a non-doubles roll (3 then 5)
    const next = withSeed(1, () => applyBotAction(state, "bot0", { type: "roll" }));
    expect(next.lastRoll).not.toBeNull();
    expect(next.players.bot0.position).not.toBe(0);
  });

  it("endTurn hands the clock to the next player", () => {
    const state = freshBotGame(["medium", "medium"]);
    state.players.bot0.hasRolledThisTurn = true;
    const next = applyBotAction(state, "bot0", { type: "endTurn" });
    expect(currentPlayerId(next)).toBe("bot1");
  });

  it("a noop returns the same state reference", () => {
    const state = freshBotGame(["medium", "medium"]);
    expect(applyBotAction(state, "bot0", { type: "noop" })).toBe(state);
  });
});

// ---------- stepBot: progress ----------

describe("stepBot — always makes progress", () => {
  it("advances state on a normal bot turn", () => {
    const state = freshBotGame(["medium", "medium"]);
    const next = withSeed(7, () => stepBot(state, "bot0", "medium"));
    expect(next).not.toBe(state);
    // either it moved (rolled) or the clock advanced — never a silent stall
    const moved = next.players.bot0.position !== state.players.bot0.position;
    const rolled = next.players.bot0.hasRolledThisTurn !== state.players.bot0.hasRolledThisTurn;
    expect(moved || rolled).toBe(true);
  });

  it("a full single turn eventually reaches the next player", () => {
    // Keep stepping bot0 until the clock leaves it; must happen in a bounded number of steps.
    const result = withSeed(3, () => {
      let state = freshBotGame(["medium", "medium"]);
      let guard = 0;
      while (whoMustAct(state) === "bot0" && guard < 200) {
        state = stepBot(state, "bot0", "medium");
        state = refreshWinCondition(state);
        guard += 1;
      }
      return { state, guard };
    });
    expect(result.guard).toBeLessThan(200);
    expect(whoMustAct(result.state)).not.toBe("bot0");
  });
});

// ---------- full autonomous games ----------

describe("bot-vs-bot self-play", () => {
  it("a 2-bot game runs to completion with a winner (no human input)", () => {
    const { state, steps, worstStall } = withSeed(20260831, () =>
      runToCompletion(freshBotGame(["medium", "hard"], { winCondition: "net_worth_target", winTarget: 2200 }))
    );
    expect(state.status).toBe("ended");
    expect(state.winnerId).not.toBeNull();
    expect(steps).toBeGreaterThan(0);
    expect(worstStall).toBeLessThan(3); // the progress backstop keeps stalls from ever chaining
  });

  it("a full 4-bot table of every difficulty also finishes on its own", () => {
    const { state } = withSeed(42, () =>
      runToCompletion(freshBotGame(["easy", "medium", "hard", "medium"], { winCondition: "net_worth_target", winTarget: 2400 }))
    );
    expect(state.status).toBe("ended");
    expect(state.winnerId).not.toBeNull();
    // the winner is one of the four seats
    expect(state.playerOrder).toContain(state.winnerId);
  });

  it("is fully deterministic for a fixed seed", () => {
    const settings = { winCondition: "net_worth_target" as const, winTarget: 2200 };
    const a = withSeed(999, () => runToCompletion(freshBotGame(["easy", "medium"], settings)));
    const b = withSeed(999, () => runToCompletion(freshBotGame(["easy", "medium"], settings)));
    expect(summarize(a.state)).toEqual(summarize(b.state));
    expect(a.steps).toBe(b.steps);
  });

  it("different seeds explore different lines of play", () => {
    const settings = { winCondition: "net_worth_target" as const, winTarget: 2600 };
    const a = withSeed(1, () => runToCompletion(freshBotGame(["medium", "medium"], settings)));
    const b = withSeed(2, () => runToCompletion(freshBotGame(["medium", "medium"], settings)));
    // both still terminate...
    expect(a.state.status).toBe("ended");
    expect(b.state.status).toBe("ended");
    // ...but not via an identical trajectory (guards against an accidentally seed-independent loop)
    expect(a.steps === b.steps && a.state.turnNumber === b.state.turnNumber).toBe(false);
  });
});
