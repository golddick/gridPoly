import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createInitialGameState,
  applyRoll,
  resolveBuy,
  resolveOutbid,
  resolveInvestOrFee,
  resolveBetOrFee,
  resolveRenewOrRelease,
  takeLoan,
  endTurn,
  endByTimeout,
  payBail,
  useJailCard,
  attemptJailRoll,
  buildHouse,
  auctionBid,
  auctionPass,
  mortgageTile,
  unmortgageTile,
  listForSale,
  buyListed,
  proposeTrade,
  respondTrade,
  getPlayerAssets,
  computeNetWorth,
  currentPlayerId,
  tileCurrentValue,
  ownsWholeColorGroup,
  getColorGroupStatus,
  refreshWinCondition,
  endByHost,
} from "./engine";
import { boardIndex, jailPosition, PURCHASABLE_TYPES, GROUP_SIZE } from "./board";
import type { GameState, RoomSettings } from "./types";
import { MIN_BOARD_SIZE } from "./types";

// ---------- test helpers ----------

const BASE_SETTINGS: RoomSettings = {
  winCondition: "timed",
  durationMinutes: 30,
  turnTimerSeconds: 45,
  startingCapital: 3000,
  boardVariant: "default",
  boardSize: MIN_BOARD_SIZE,
  maxPlayers: 6,
  marketEventEveryNTurns: 1000, // effectively disabled unless a test wants it
};

function makePlayers(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    userId: `user${i}`,
    username: `Player${i}`,
    pieceId: "cone-gold",
  }));
}

function freshState(overrides: Partial<RoomSettings> = {}, players = 2): GameState {
  return createInitialGameState("room1", { ...BASE_SETTINGS, ...overrides }, makePlayers(players));
}

/** Returns the Math.random() fraction that makes rollDice() produce the given face (1-6). */
function fracFor(face: number): number {
  return (face - 0.5) / 6;
}

/** Queues up exact Math.random() return values for the duration of `fn`. */
function withRandomQueue<T>(values: number[], fn: () => T): T {
  const queue = [...values];
  const spy = vi.spyOn(Math, "random").mockImplementation(() => {
    return queue.length > 0 ? (queue.shift() as number) : 0.5;
  });
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

function firstOwnableTileId(state: GameState, type?: string): string {
  const idx = boardIndex(state.boardSize);
  const tile = idx.tiles.find((t) => PURCHASABLE_TYPES.has(t.type) && (!type || t.type === type));
  if (!tile) throw new Error(`no tile of type ${type} found`);
  return tile.id;
}

/**
 * Resolves whatever pendingDecision (if any) belongs to `pid`, without ever
 * starting a further blocking auction — used between chained rolls in tests
 * that don't care about the specific landing outcome, only that play can
 * continue. Declining a `buy_or_skip` sends it to auction (another blocker),
 * so this always accepts that one; every other decision kind resolves
 * immediately regardless of accept/decline, so those are safe to always skip.
 */
function clearPending(state: GameState, pid: string): GameState {
  const decision = state.pendingDecision;
  if (!decision || decision.playerId !== pid) return state;
  switch (decision.kind) {
    case "buy_or_skip":
      return resolveBuy(state, pid, true);
    case "outbid_or_skip":
      return resolveOutbid(state, pid, false);
    case "invest_or_fee":
      return resolveInvestOrFee(state, pid, false);
    case "bet_or_fee":
      return resolveBetOrFee(state, pid, "fee");
    case "renew_or_release":
      return resolveRenewOrRelease(state, pid, false);
    default:
      return state;
  }
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------- tests ----------

describe("board generation", () => {
  it("enforces the minimum board size and produces the right tile count", () => {
    const idx = boardIndex(5); // below minimum
    expect(idx.boardSize).toBe(MIN_BOARD_SIZE);
    expect(idx.tiles.length).toBe(4 * (MIN_BOARD_SIZE - 1));
  });

  it("is deterministic for a given size (client/server produce identical boards)", () => {
    const a = boardIndex(12);
    const b = boardIndex(12);
    expect(a.tiles.map((t) => t.id)).toEqual(b.tiles.map((t) => t.id));
  });

  it("places GO at position 0 and Jail at boardSize - 1", () => {
    const idx = boardIndex(10);
    expect(idx.tiles[0].type).toBe("go");
    expect(idx.tiles[jailPosition(10)].type).toBe("jail");
  });
});

describe("createInitialGameState", () => {
  it("seeds every player with starting capital and position 0", () => {
    const state = freshState({ startingCapital: 1500 }, 3);
    expect(state.playerOrder).toHaveLength(3);
    for (const pid of state.playerOrder) {
      const p = state.players[pid];
      expect(p.inGameBalance).toBe(1500);
      expect(p.position).toBe(0);
      expect(p.status).toBe("active");
    }
  });

  it("seeds tileMarket only for purchasable tiles", () => {
    const state = freshState();
    const idx = boardIndex(state.boardSize);
    for (const tile of idx.tiles) {
      if (PURCHASABLE_TYPES.has(tile.type)) {
        expect(state.tileMarket[tile.id]).toBeDefined();
      } else {
        expect(state.tileMarket[tile.id]).toBeUndefined();
      }
    }
  });
});

describe("applyRoll — movement, GO salary, doubles", () => {
  it("moves the current player by the sum of both dice and records lastRoll", () => {
    let state = freshState();
    const pid = currentPlayerId(state);
    state = withRandomQueue([fracFor(3), fracFor(4)], () => applyRoll(state, pid));
    expect(state.players[pid].position).toBe(7);
    expect(state.lastRoll).toMatchObject({ playerId: pid, d1: 3, d2: 4, isDoubles: false });
  });

  it("pays no GO salary on a player's first lap (house rule)", () => {
    let state = freshState();
    const pid = currentPlayerId(state);
    const idx = boardIndex(state.boardSize);
    state.players[pid].position = idx.total - 2;
    const before = state.players[pid].inGameBalance;
    state = withRandomQueue([fracFor(4), fracFor(3)], () => applyRoll(state, pid));
    expect(state.players[pid].inGameBalance).toBe(before); // first crossing of GO earns nothing
    expect(state.players[pid].goPasses).toBe(1);
  });

  it("pays GO salary from the second lap onward", () => {
    let state = freshState();
    const pid = currentPlayerId(state);
    const idx = boardIndex(state.boardSize);
    state.players[pid].position = idx.total - 2;
    state.players[pid].goPasses = 1; // already completed the opening lap
    const before = state.players[pid].inGameBalance;
    state = withRandomQueue([fracFor(4), fracFor(3)], () => applyRoll(state, pid));
    expect(state.players[pid].inGameBalance).toBe(before + 200);
    expect(state.players[pid].goPasses).toBe(2);
  });

  it("ignores a roll from a player who isn't the current turn", () => {
    let state = freshState();
    const notCurrent = state.playerOrder[1];
    const before = state.players[notCurrent].position;
    state = withRandomQueue([fracFor(5), fracFor(5)], () => applyRoll(state, notCurrent));
    expect(state.players[notCurrent].position).toBe(before);
  });

  it("blocks a second non-doubles roll in the same turn", () => {
    let state = freshState();
    const pid = currentPlayerId(state);
    state = withRandomQueue([fracFor(2), fracFor(5)], () => applyRoll(state, pid));
    const posAfterFirst = state.players[pid].position;
    state = withRandomQueue([fracFor(6), fracFor(6)], () => applyRoll(state, pid));
    expect(state.players[pid].position).toBe(posAfterFirst); // second roll had no effect
  });

  it("grants another roll on doubles, without ending the turn", () => {
    let state = freshState();
    const pid = currentPlayerId(state);
    state = withRandomQueue([fracFor(3), fracFor(3)], () => applyRoll(state, pid));
    expect(state.players[pid].hasRolledThisTurn).toBe(false);
    expect(currentPlayerId(state)).toBe(pid);
  });

  it("sends a player to Jail after three doubles in a row", () => {
    let state = freshState();
    const pid = currentPlayerId(state);
    state = withRandomQueue([fracFor(2), fracFor(2)], () => applyRoll(state, pid));
    state = clearPending(state, pid); // landing may trigger a decision that would otherwise block the next roll
    state = withRandomQueue([fracFor(4), fracFor(4)], () => applyRoll(state, pid));
    state = clearPending(state, pid);
    state = withRandomQueue([fracFor(6), fracFor(6)], () => applyRoll(state, pid));
    state = clearPending(state, pid);
    expect(state.players[pid].inJail).toBe(true);
    expect(state.players[pid].position).toBe(jailPosition(state.boardSize));
  });
});

describe("buying, renting, and auctions", () => {
  it("lets the landing player buy an unowned property", () => {
    let state = freshState();
    const pid = currentPlayerId(state);
    const tileId = firstOwnableTileId(state, "property");
    state.players[pid].position = boardIndex(state.boardSize).byId[tileId].position - 2;
    state = withRandomQueue([fracFor(1), fracFor(1)], () => applyRoll(state, pid));
    expect(state.pendingDecision?.kind).toBe("buy_or_skip");

    const price = state.pendingDecision!.price;
    const before = state.players[pid].inGameBalance;
    state = resolveBuy(state, pid, true);

    expect(state.tileMarket[tileId].ownerPlayerId).toBe(pid);
    expect(state.players[pid].inGameBalance).toBe(before - price);
    expect(state.pendingDecision).toBeNull();
  });

  it("charges rent to a player landing on someone else's property", () => {
    let state = freshState();
    const [ownerId, renterId] = state.playerOrder;
    const tileId = firstOwnableTileId(state, "property");
    const ts = state.tileMarket[tileId];
    ts.ownerPlayerId = ownerId;
    ts.purchasePrice = 100;

    const tile = boardIndex(state.boardSize).byId[tileId];
    state.players[renterId].position = tile.position - 3;
    state.currentPlayerIndex = state.playerOrder.indexOf(renterId);

    const ownerBefore = state.players[ownerId].inGameBalance;
    const renterBefore = state.players[renterId].inGameBalance;
    state = withRandomQueue([fracFor(2), fracFor(1)], () => applyRoll(state, renterId));

    const rent = Math.round(tileCurrentValue(state, tileId) * tile.rentPercent);
    expect(state.players[ownerId].inGameBalance).toBe(ownerBefore + rent);
    expect(state.players[renterId].inGameBalance).toBe(renterBefore - rent);
  });

  it("starts a live auction when the landing player declines to buy, and awards the tile to the winner", () => {
    let state = freshState({ startingCapital: 500 }, 3);
    const pid = currentPlayerId(state);
    const tileId = firstOwnableTileId(state, "property");
    state.players[pid].position = boardIndex(state.boardSize).byId[tileId].position - 2;
    state = withRandomQueue([fracFor(1), fracFor(1)], () => applyRoll(state, pid));

    state = resolveBuy(state, pid, false); // decline -> auction starts
    expect(state.auction).not.toBeNull();
    expect(state.auction!.tileId).toBe(tileId);

    // Bidding goes around; everyone but one player passes.
    const bidder = state.auction!.currentTurnPlayerId;
    state = auctionBid(state, bidder, 120);
    expect(state.auction!.highestBid).toBe(120);

    // Remaining players pass until only the bidder is left.
    while (state.auction && state.auction.activePlayerIds.length > 1) {
      const turnPlayer = state.auction.currentTurnPlayerId;
      state = auctionPass(state, turnPlayer);
    }

    expect(state.auction).toBeNull();
    expect(state.tileMarket[tileId].ownerPlayerId).toBe(bidder);
    expect(state.tileMarket[tileId].purchasePrice).toBe(120);
  });

  it("keeps auction turn order fair — a pass advances to the next remaining player, never back to whoever is already winning", () => {
    let state = freshState({ startingCapital: 500 }, 3);
    const [p0, p1, p2] = state.playerOrder;
    const tileId = firstOwnableTileId(state, "property");
    state.auction = { tileId, highestBid: 0, highestBidderId: null, currentTurnPlayerId: p0, activePlayerIds: [p0, p1, p2], minIncrement: 10 };

    state = auctionBid(state, p0, 100);
    expect(state.auction!.currentTurnPlayerId).toBe(p1); // advances in order after a bid

    state = auctionPass(state, p1);
    // p1 passed — turn must go to p2 (the only other remaining player), never back to p0.
    expect(state.auction!.currentTurnPlayerId).toBe(p2);
    expect(state.auction!.activePlayerIds).toEqual([p0, p2]);
  });

  it("blocks rolling while an auction is in progress", () => {
    let state = freshState({ startingCapital: 500 }, 2);
    const pid = currentPlayerId(state);
    const tileId = firstOwnableTileId(state, "property");
    state.players[pid].position = boardIndex(state.boardSize).byId[tileId].position - 2;
    state = withRandomQueue([fracFor(1), fracFor(1)], () => applyRoll(state, pid));
    state = resolveBuy(state, pid, false);
    expect(state.auction).not.toBeNull();

    const posBefore = state.players[pid].position;
    state = withRandomQueue([fracFor(4), fracFor(4)], () => applyRoll(state, pid));
    expect(state.players[pid].position).toBe(posBefore); // roll had no effect, auction still blocking
  });
});

describe("contracts", () => {
  it("lets a landing player buy out a contract, refunding the previous owner what they paid", () => {
    let state = freshState();
    const [ownerId, challengerId] = state.playerOrder;
    const tileId = firstOwnableTileId(state, "contract");
    const ts = state.tileMarket[tileId];
    ts.ownerPlayerId = ownerId;
    ts.purchasePrice = 200;
    ts.contractExpiresAtTurn = 999;

    const tile = boardIndex(state.boardSize).byId[tileId];
    state.players[challengerId].position = tile.position - 2;
    state.currentPlayerIndex = state.playerOrder.indexOf(challengerId);

    state = withRandomQueue([fracFor(1), fracFor(1)], () => applyRoll(state, challengerId));
    expect(state.pendingDecision?.kind).toBe("outbid_or_skip");

    const price = state.pendingDecision!.price;
    const ownerBefore = state.players[ownerId].inGameBalance;
    state = resolveOutbid(state, challengerId, true);

    expect(state.tileMarket[tileId].ownerPlayerId).toBe(challengerId);
    expect(state.players[ownerId].inGameBalance).toBe(ownerBefore + 200); // refunded exactly what they paid
    void price;
  });

  it("offers renewal when a contract expires at the start of the owner's turn", () => {
    let state = freshState({}, 2);
    const [ownerId, otherId] = state.playerOrder;
    const tileId = firstOwnableTileId(state, "contract");
    state.tileMarket[tileId].ownerPlayerId = ownerId;
    state.tileMarket[tileId].purchasePrice = 200;

    // Turn sequence: turn 1 = ownerId's turn. Ending it moves to turn 2 (otherId).
    // Ending turn 2 rotates back to ownerId on turn 3 — set the expiry to land exactly then.
    state.tileMarket[tileId].contractExpiresAtTurn = 3;
    state = endTurn(state, ownerId); // -> turn 2, otherId's turn
    expect(state.turnNumber).toBe(2);
    state = endTurn(state, otherId); // -> turn 3, back to ownerId; checkContractExpiry should fire

    expect(state.turnNumber).toBe(3);
    expect(currentPlayerId(state)).toBe(ownerId);
    expect(state.pendingDecision).toMatchObject({ playerId: ownerId, tileId, kind: "renew_or_release" });

    const before = state.players[ownerId].inGameBalance;
    const upkeep = state.pendingDecision!.price;
    state = resolveRenewOrRelease(state, ownerId, true);
    expect(state.players[ownerId].inGameBalance).toBe(before - upkeep);
    expect(state.tileMarket[tileId].contractExpiresAtTurn).toBeGreaterThan(state.turnNumber);
  });

  it("releases an expired contract back to the market when the owner declines to renew", () => {
    let state = freshState({}, 2);
    const [ownerId, otherId] = state.playerOrder;
    const tileId = firstOwnableTileId(state, "contract");
    state.tileMarket[tileId].ownerPlayerId = ownerId;
    state.tileMarket[tileId].purchasePrice = 200;
    state.tileMarket[tileId].contractExpiresAtTurn = 3;

    state = endTurn(state, ownerId);
    state = endTurn(state, otherId);
    expect(state.pendingDecision?.kind).toBe("renew_or_release");

    state = resolveRenewOrRelease(state, ownerId, false);
    expect(state.tileMarket[tileId].ownerPlayerId).toBeNull();
    expect(state.tileMarket[tileId].contractExpiresAtTurn).toBeUndefined();
  });
});

describe("shared investments (tech/crypto/startup)", () => {
  it("lets a first-time landing player invest and become a co-owner", () => {
    let state = freshState();
    const pid = currentPlayerId(state);
    const tileId = firstOwnableTileId(state, "tech_company");
    state.players[pid].position = boardIndex(state.boardSize).byId[tileId].position - 2;
    state = withRandomQueue([fracFor(1), fracFor(1)], () => applyRoll(state, pid));
    expect(state.pendingDecision?.kind).toBe("invest_or_fee");

    state = resolveInvestOrFee(state, pid, true);
    expect(state.tileMarket[tileId].investors[pid]).toBeGreaterThan(0);
  });

  it("splits the landing fee among existing investors proportionally when a new player declines", () => {
    let state = freshState({ startingCapital: 5000 }, 3);
    const tileId = firstOwnableTileId(state, "tech_company");
    const ts = state.tileMarket[tileId];
    ts.investors["p0"] = 300;
    ts.investors["p1"] = 100;

    const tile = boardIndex(state.boardSize).byId[tileId];
    state.players["p2"].position = tile.position - 2;
    state.currentPlayerIndex = state.playerOrder.indexOf("p2");

    const p0Before = state.players["p0"].inGameBalance;
    const p1Before = state.players["p1"].inGameBalance;
    state = withRandomQueue([fracFor(1), fracFor(1)], () => applyRoll(state, "p2"));
    expect(state.pendingDecision?.kind).toBe("invest_or_fee");

    state = resolveInvestOrFee(state, "p2", false);
    // p0 owns 75% of the pool, p1 owns 25% — fee should split roughly 3:1.
    const p0Gain = state.players["p0"].inGameBalance - p0Before;
    const p1Gain = state.players["p1"].inGameBalance - p1Before;
    expect(p0Gain).toBeGreaterThan(p1Gain);
    expect(p0Gain + p1Gain).toBeGreaterThan(0);
  });

  it("computes ownership percent as amountInvested / totalInvested", () => {
    let state = freshState();
    const tileId = firstOwnableTileId(state, "crypto");
    state.tileMarket[tileId].investors["p0"] = 300;
    state.tileMarket[tileId].investors["p1"] = 100;

    const assets = getPlayerAssets(state, "p0");
    const asset = assets.find((a) => a.tileId === tileId)!;
    expect(asset.ownershipPercent).toBeCloseTo(75, 5);
  });
});

describe("betting company", () => {
  it("pays the bettor and debits the owner on a win, and always collects rake", () => {
    let state = freshState({ startingCapital: 1000 }, 2);
    const [ownerId, bettorId] = state.playerOrder;
    const tileId = firstOwnableTileId(state, "betting");
    state.tileMarket[tileId].ownerPlayerId = ownerId;
    state.pendingDecision = { playerId: bettorId, tileId, kind: "bet_or_fee", price: 0, currentOwnerPlayerId: ownerId, landingFee: 10 };

    const ownerBefore = state.players[ownerId].inGameBalance;
    const bettorBefore = state.players[bettorId].inGameBalance;

    // BET_WIN_PROBABILITY.color ~ 0.46 -> random() below that wins.
    state = withRandomQueue([0.01], () => resolveBetOrFee(state, bettorId, "bet", "color", 100));

    const rake = 5; // 5% of 100
    const payout = 200; // 2x multiplier
    expect(state.players[bettorId].inGameBalance).toBe(bettorBefore - rake + payout);
    expect(state.players[ownerId].inGameBalance).toBe(ownerBefore + rake - payout);
  });

  it("issues the owner an emergency loan when a payout exceeds their balance", () => {
    let state = freshState({ startingCapital: 1000 }, 2);
    const [ownerId, bettorId] = state.playerOrder;
    state.players[ownerId].inGameBalance = 50; // can't cover a big win
    const tileId = firstOwnableTileId(state, "betting");
    state.tileMarket[tileId].ownerPlayerId = ownerId;
    state.pendingDecision = { playerId: bettorId, tileId, kind: "bet_or_fee", price: 0, currentOwnerPlayerId: ownerId, landingFee: 10 };

    state = withRandomQueue([0.001], () => resolveBetOrFee(state, bettorId, "bet", "number", 100)); // 35x multiplier, guaranteed win

    expect(state.players[ownerId].inGameBalance).toBe(0);
    expect(state.players[ownerId].loans.length).toBe(1);
    expect(state.players[ownerId].loans[0].status).toBe("active");
  });
});

describe("loans", () => {
  it("caps borrowing at a percentage of net worth", () => {
    let state = freshState({ startingCapital: 100 }, 2);
    const pid = currentPlayerId(state);
    state = takeLoan(state, pid, 1_000_000);
    expect(state.players[pid].loans[0].principal).toBeLessThan(1_000_000);
    expect(state.players[pid].inGameBalance).toBeGreaterThan(100);
  });

  it("adds an installment obligation that is repaid over time", () => {
    let state = freshState({ startingCapital: 1000 }, 2);
    const pid = currentPlayerId(state);
    state = takeLoan(state, pid, 300);
    expect(state.players[pid].loans).toHaveLength(1);
    expect(state.players[pid].loans[0].installmentsRemaining).toBeGreaterThan(0);
  });
});

describe("mortgage and open-market sale", () => {
  it("mortgaging pays out half current value and suspends rent collection", () => {
    let state = freshState();
    const [ownerId, renterId] = state.playerOrder;
    const tileId = firstOwnableTileId(state, "property");
    state.tileMarket[tileId].ownerPlayerId = ownerId;
    state.tileMarket[tileId].purchasePrice = 200;

    const before = state.players[ownerId].inGameBalance;
    state = mortgageTile(state, ownerId, tileId);
    expect(state.tileMarket[tileId].mortgaged).toBe(true);
    expect(state.players[ownerId].inGameBalance).toBeGreaterThan(before);

    const tile = boardIndex(state.boardSize).byId[tileId];
    state.players[renterId].position = tile.position - 2;
    state.currentPlayerIndex = state.playerOrder.indexOf(renterId);
    const renterBefore = state.players[renterId].inGameBalance;
    state = withRandomQueue([fracFor(1), fracFor(1)], () => applyRoll(state, renterId));
    expect(state.players[renterId].inGameBalance).toBe(renterBefore); // no rent charged while mortgaged
  });

  it("unmortgaging costs 110% of the amount received and restores the asset", () => {
    let state = freshState();
    const ownerId = currentPlayerId(state);
    const tileId = firstOwnableTileId(state, "property");
    state.tileMarket[tileId].ownerPlayerId = ownerId;
    state.tileMarket[tileId].purchasePrice = 200;
    state = mortgageTile(state, ownerId, tileId);
    const mortgageAmount = state.tileMarket[tileId].mortgageAmount!;

    const before = state.players[ownerId].inGameBalance;
    state = unmortgageTile(state, ownerId, tileId);
    expect(state.tileMarket[tileId].mortgaged).toBe(false);
    expect(state.players[ownerId].inGameBalance).toBe(before - Math.round(mortgageAmount * 1.1));
  });

  it("lets any other player buy a listed asset at the asking price", () => {
    let state = freshState({ startingCapital: 1000 }, 2);
    const [ownerId, buyerId] = state.playerOrder;
    const tileId = firstOwnableTileId(state, "property");
    state.tileMarket[tileId].ownerPlayerId = ownerId;
    state.tileMarket[tileId].purchasePrice = 150;

    state = listForSale(state, ownerId, tileId, 300);
    expect(state.tileMarket[tileId].forSalePrice).toBe(300);

    const buyerBefore = state.players[buyerId].inGameBalance;
    const ownerBefore = state.players[ownerId].inGameBalance;
    state = buyListed(state, buyerId, tileId);

    expect(state.tileMarket[tileId].ownerPlayerId).toBe(buyerId);
    expect(state.tileMarket[tileId].forSalePrice).toBeNull();
    expect(state.players[buyerId].inGameBalance).toBe(buyerBefore - 300);
    expect(state.players[ownerId].inGameBalance).toBe(ownerBefore + 300);
  });
});

describe("building — property vs. Estate 3x multiplier", () => {
  it("charges 3x as much to build on an Estate as an equivalent Property", () => {
    let stateA = freshState({ startingCapital: 100_000 });
    let stateB = freshState({ startingCapital: 100_000 });
    const pid = currentPlayerId(stateA);

    const propTileId = firstOwnableTileId(stateA, "property");
    const estateTileId = firstOwnableTileId(stateB, "estate");

    // Grant ownership of the whole color group, not just the one tile —
    // building now requires owning every tile in the set (real Monopoly rule).
    const propGroup = boardIndex(stateA.boardSize)
      .tiles.filter((t) => t.colorGroup === boardIndex(stateA.boardSize).byId[propTileId].colorGroup)
      .map((t) => t.id);
    const estateGroup = boardIndex(stateB.boardSize)
      .tiles.filter((t) => t.colorGroup === boardIndex(stateB.boardSize).byId[estateTileId].colorGroup)
      .map((t) => t.id);
    for (const id of propGroup) stateA.tileMarket[id].ownerPlayerId = pid;
    for (const id of estateGroup) stateB.tileMarket[id].ownerPlayerId = pid;

    const balBeforeA = stateA.players[pid].inGameBalance;
    const balBeforeB = stateB.players[pid].inGameBalance;

    stateA = buildHouse(stateA, pid, propTileId);
    stateB = buildHouse(stateB, pid, estateTileId);

    const propTile = boardIndex(stateA.boardSize).byId[propTileId];
    const estateTile = boardIndex(stateB.boardSize).byId[estateTileId];

    const costA = balBeforeA - stateA.players[pid].inGameBalance;
    const costB = balBeforeB - stateB.players[pid].inGameBalance;

    // Both tiles start at build level 0 -> cost = basePrice * 0.5 * 1 * (3 for estate)
    expect(costB).toBe(Math.round(estateTile.basePrice * 0.5 * 3));
    expect(costA).toBe(Math.round(propTile.basePrice * 0.5));
    expect(stateA.tileMarket[propTileId].buildLevel).toBe(1);
    expect(stateB.tileMarket[estateTileId].buildLevel).toBe(1);
  });

  it("refuses to build past the max level (hotel)", () => {
    let state = freshState({ startingCapital: 1_000_000 });
    const pid = currentPlayerId(state);
    const tileId = firstOwnableTileId(state, "property");
    state.tileMarket[tileId].ownerPlayerId = pid;
    state.tileMarket[tileId].buildLevel = 5;
    state = buildHouse(state, pid, tileId);
    expect(state.tileMarket[tileId].buildLevel).toBe(5); // unchanged
  });
});

describe("trading", () => {
  it("swaps cash and single-owner tiles when a trade is accepted", () => {
    let state = freshState({ startingCapital: 1000 }, 2);
    const [a, b] = state.playerOrder;
    const tileId = firstOwnableTileId(state, "property");
    state.tileMarket[tileId].ownerPlayerId = a;

    state = proposeTrade(state, a, b, 0, [tileId], 200, []);
    const trade = state.trades[0];
    expect(trade.status).toBe("pending");

    const aBefore = state.players[a].inGameBalance;
    const bBefore = state.players[b].inGameBalance;
    state = respondTrade(state, b, trade.id, true);

    expect(state.tileMarket[tileId].ownerPlayerId).toBe(b);
    expect(state.players[a].inGameBalance).toBe(aBefore + 200);
    expect(state.players[b].inGameBalance).toBe(bBefore - 200);
    expect(state.trades[0].status).toBe("accepted");
  });

  it("declines a trade whose terms are no longer valid at accept-time", () => {
    let state = freshState({ startingCapital: 100 }, 2);
    const [a, b] = state.playerOrder;
    const tileId = firstOwnableTileId(state, "property");
    state.tileMarket[tileId].ownerPlayerId = a;

    state = proposeTrade(state, a, b, 0, [tileId], 999_999, []); // b can't possibly afford this
    const trade = state.trades[0];
    state = respondTrade(state, b, trade.id, true);

    expect(state.trades[0].status).toBe("declined");
    expect(state.tileMarket[tileId].ownerPlayerId).toBe(a); // unchanged
  });
});

describe("jail", () => {
  it("sends a player to jail when they land on Go To Jail", () => {
    let state = freshState();
    const pid = currentPlayerId(state);
    const idx = boardIndex(state.boardSize);
    const goToJailTile = idx.tiles.find((t) => t.type === "go_to_jail")!;
    state.players[pid].position = goToJailTile.position - 2;
    state = withRandomQueue([fracFor(1), fracFor(1)], () => applyRoll(state, pid));

    expect(state.players[pid].inJail).toBe(true);
    expect(state.players[pid].position).toBe(jailPosition(state.boardSize));
  });

  it("lets a jailed player pay bail and leave immediately", () => {
    let state = freshState();
    const pid = currentPlayerId(state);
    state.players[pid].inJail = true;
    const before = state.players[pid].inGameBalance;
    state = payBail(state, pid);
    expect(state.players[pid].inJail).toBe(false);
    expect(state.players[pid].inGameBalance).toBe(before - 50);
  });

  it("lets a jailed player use a Get Out of Jail Free card instead of paying", () => {
    let state = freshState();
    const pid = currentPlayerId(state);
    state.players[pid].inJail = true;
    state.players[pid].getOutOfJailFreeCards = 1;
    const before = state.players[pid].inGameBalance;
    state = useJailCard(state, pid);
    expect(state.players[pid].inJail).toBe(false);
    expect(state.players[pid].getOutOfJailFreeCards).toBe(0);
    expect(state.players[pid].inGameBalance).toBe(before); // free
  });

  it("escapes jail on a doubles roll attempt, and moves that turn", () => {
    let state = freshState();
    const pid = currentPlayerId(state);
    state.players[pid].inJail = true;
    state.players[pid].position = jailPosition(state.boardSize);
    state = withRandomQueue([fracFor(4), fracFor(4)], () => attemptJailRoll(state, pid));
    expect(state.players[pid].inJail).toBe(false);
    expect(state.players[pid].position).not.toBe(jailPosition(state.boardSize));
  });

  it("forces bail after three failed jail-escape attempts", () => {
    let state = freshState();
    const pid = currentPlayerId(state);
    state.players[pid].inJail = true;
    state.players[pid].position = jailPosition(state.boardSize);

    for (let i = 0; i < 2; i++) {
      state.players[pid].hasRolledThisTurn = false;
      state = withRandomQueue([fracFor(1), fracFor(2)], () => attemptJailRoll(state, pid));
      expect(state.players[pid].inJail).toBe(true);
    }
    state.players[pid].hasRolledThisTurn = false;
    const before = state.players[pid].inGameBalance;
    state = withRandomQueue([fracFor(1), fracFor(2)], () => attemptJailRoll(state, pid));
    expect(state.players[pid].inJail).toBe(false);
    expect(state.players[pid].inGameBalance).toBe(before - 50);
  });
});

describe("turn rotation and win conditions", () => {
  it("advances to the next active player and skips bankrupt ones", () => {
    let state = freshState({}, 3);
    const [a, , c] = state.playerOrder;
    state.players[state.playerOrder[1]].status = "bankrupt";
    state.currentPlayerIndex = state.playerOrder.indexOf(a);
    state = endTurn(state, a);
    expect(currentPlayerId(state)).toBe(c);
  });

  it("declares the last active player the winner under bankrupt_all", () => {
    let state = freshState({ winCondition: "bankrupt_all" }, 2);
    const [a, b] = state.playerOrder;
    state.players[b].status = "bankrupt";
    state = endTurn(state, a);
    expect(state.status).toBe("ended");
    expect(state.winnerId).toBe(a);
  });

  it("declares the highest net worth the winner when time runs out", () => {
    let state = freshState({ winCondition: "timed" }, 2);
    const [a, b] = state.playerOrder;
    state.players[a].inGameBalance = 1000;
    state.players[b].inGameBalance = 5000;
    // netWorth is cached, not auto-derived — sync it after directly mutating inGameBalance.
    // b is deliberately NOT first in playerOrder, so this only passes if the
    // engine actually compares net worth rather than defaulting to turn order.
    state.players[a].netWorth = computeNetWorth(state, a);
    state.players[b].netWorth = computeNetWorth(state, b);
    state = endByTimeout(state);
    expect(state.status).toBe("ended");
    expect(state.winnerId).toBe(b);
  });

  it("declares a winner once someone reaches the net worth target", () => {
    let state = freshState({ winCondition: "net_worth_target", winTarget: 4000 }, 2);
    const [a] = state.playerOrder;
    state.players[a].inGameBalance = 5000;
    state.players[a].netWorth = computeNetWorth(state, a); // netWorth is cached, not auto-derived — sync it after a direct mutation
    state = endTurn(state, currentPlayerId(state));
    expect(state.status).toBe("ended");
    expect(state.winnerId).toBe(a);
  });
});

describe("computeNetWorth", () => {
  it("sums cash plus asset value minus outstanding loan installments", () => {
    let state = freshState({ startingCapital: 1000 }, 2);
    const pid = currentPlayerId(state);
    const tileId = firstOwnableTileId(state, "property");
    state.tileMarket[tileId].ownerPlayerId = pid;
    state.tileMarket[tileId].purchasePrice = 200;

    const nw = computeNetWorth(state, pid);
    expect(nw).toBeGreaterThanOrEqual(1000); // cash + asset value, no debt yet
  });
});

describe("color groups — must own the whole set to build, like real Monopoly", () => {
  function tilesInSameGroup(state: GameState, tileId: string): string[] {
    const idx = boardIndex(state.boardSize);
    const tile = idx.byId[tileId];
    if (!tile?.colorGroup) return [tileId];
    return idx.tiles.filter((t) => t.colorGroup === tile.colorGroup).map((t) => t.id);
  }

  it("groups properties into sets of GROUP_SIZE with a shared colorGroup id", () => {
    const idx = boardIndex(MIN_BOARD_SIZE);
    const propertyTiles = idx.tiles.filter((t) => t.type === "property");
    const firstGroup = propertyTiles[0].colorGroup;
    expect(firstGroup).toBeDefined();
    const sameGroupCount = propertyTiles.filter((t) => t.colorGroup === firstGroup).length;
    expect(sameGroupCount).toBe(GROUP_SIZE);
  });

  it("refuses to build when the player owns the tile but not the rest of its color group", () => {
    let state = freshState({ startingCapital: 100_000 });
    const pid = currentPlayerId(state);
    const tileId = firstOwnableTileId(state, "property");
    const group = tilesInSameGroup(state, tileId);
    expect(group.length).toBeGreaterThan(1); // sanity check this property really has groupmates

    state.tileMarket[tileId].ownerPlayerId = pid; // only owns ONE of the group
    expect(ownsWholeColorGroup(state, pid, boardIndex(state.boardSize).byId[tileId])).toBe(false);

    const before = state.players[pid].inGameBalance;
    state = buildHouse(state, pid, tileId);
    expect(state.tileMarket[tileId].buildLevel ?? 0).toBe(0); // build silently refused
    expect(state.players[pid].inGameBalance).toBe(before); // no money spent
  });

  it("allows building once the player owns every tile in the color group", () => {
    let state = freshState({ startingCapital: 100_000 });
    const pid = currentPlayerId(state);
    const tileId = firstOwnableTileId(state, "property");
    const group = tilesInSameGroup(state, tileId);

    for (const gid of group) {
      state.tileMarket[gid].ownerPlayerId = pid;
      state.tileMarket[gid].purchasePrice = 100;
    }
    expect(ownsWholeColorGroup(state, pid, boardIndex(state.boardSize).byId[tileId])).toBe(true);

    state = buildHouse(state, pid, tileId);
    expect(state.tileMarket[tileId].buildLevel).toBe(1);
  });

  it("getColorGroupStatus reports owned/total accurately for a given player", () => {
    let state = freshState({}, 2);
    const [a] = state.playerOrder;
    const tileId = firstOwnableTileId(state, "property");
    const group = tilesInSameGroup(state, tileId);
    state.tileMarket[group[0]].ownerPlayerId = a; // owns only the first of the group

    const status = getColorGroupStatus(state, tileId, a);
    expect(status).not.toBeNull();
    expect(status!.total).toBe(group.length);
    expect(status!.ownedByPlayer).toBe(1);
    expect(status!.ownsAll).toBe(false);
  });

  it("has no group requirement for ungrouped tile types (e.g. bonds)", () => {
    let state = freshState();
    const pid = currentPlayerId(state);
    const tileId = firstOwnableTileId(state, "bond");
    const tile = boardIndex(state.boardSize).byId[tileId];
    expect(tile.colorGroup).toBeUndefined();
    expect(ownsWholeColorGroup(state, pid, tile)).toBe(true);
  });
});

describe("refreshWinCondition — catches a win outside of endTurn", () => {
  it("ends the game immediately when a bet loss drops a player below the net-worth target check point", () => {
    let state = freshState({ winCondition: "net_worth_target", winTarget: 2000, startingCapital: 1000 }, 2);
    const [ownerId, bettorId] = state.playerOrder;
    state.players[bettorId].inGameBalance = 5000; // already effectively past target once netWorth syncs
    const tileId = firstOwnableTileId(state, "betting");
    state.tileMarket[tileId].ownerPlayerId = ownerId;
    state.pendingDecision = { playerId: bettorId, tileId, kind: "bet_or_fee", price: 0, currentOwnerPlayerId: ownerId, landingFee: 10 };

    state = withRandomQueue([0.001], () => resolveBetOrFee(state, bettorId, "bet", "number", 100)); // guaranteed win, refreshes netWorth internally
    expect(state.status).toBe("in_progress"); // resolveBetOrFee itself doesn't check win conditions

    state = refreshWinCondition(state);
    expect(state.status).toBe("ended");
    expect(state.winnerId).toBe(bettorId);
  });

  it("is a no-op once the game has already ended", () => {
    let state = freshState({ winCondition: "bankrupt_all" }, 2);
    state.status = "ended";
    state.winnerId = state.playerOrder[0];
    state.endedReason = "already ended";
    const result = refreshWinCondition(state);
    expect(result).toBe(state); // returns the same reference, doesn't re-clone/re-check
  });

  it("sweeps every player for bankruptcy, not just whoever just acted", () => {
    let state = freshState({ winCondition: "bankrupt_all" }, 2);
    const [a, b] = state.playerOrder;
    state.players[b].inGameBalance = -50; // negative, no assets — should be caught even though nothing "acted" on b this call
    state = refreshWinCondition(state);
    expect(state.players[b].status).toBe("bankrupt");
    expect(state.status).toBe("ended"); // only `a` remains active
    expect(state.winnerId).toBe(a);
  });
});

describe("endByHost — manual end-game control", () => {
  it("ends the game and awards the win to the highest net worth among active players", () => {
    let state = freshState({}, 2);
    const [a, b] = state.playerOrder;
    state.players[a].inGameBalance = 1000;
    state.players[b].inGameBalance = 5000;
    state.players[a].netWorth = computeNetWorth(state, a);
    state.players[b].netWorth = computeNetWorth(state, b);

    state = endByHost(state);
    expect(state.status).toBe("ended");
    expect(state.winnerId).toBe(b);
    expect(state.endedReason).toMatch(/host/i);
  });

  it("is a no-op if the game isn't in progress", () => {
    let state = freshState({}, 2);
    state.status = "waiting";
    const result = endByHost(state);
    expect(result.status).toBe("waiting");
  });
});














// import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// import {
//   createInitialGameState,
//   applyRoll,
//   resolveBuy,
//   resolveOutbid,
//   resolveInvestOrFee,
//   resolveBetOrFee,
//   resolveRenewOrRelease,
//   takeLoan,
//   endTurn,
//   endByTimeout,
//   payBail,
//   useJailCard,
//   attemptJailRoll,
//   buildHouse,
//   auctionBid,
//   auctionPass,
//   mortgageTile,
//   unmortgageTile,
//   listForSale,
//   buyListed,
//   proposeTrade,
//   respondTrade,
//   getPlayerAssets,
//   computeNetWorth,
//   currentPlayerId,
//   tileCurrentValue,
// } from "./engine";
// import { boardIndex, jailPosition, PURCHASABLE_TYPES } from "./board";
// import type { GameState, RoomSettings } from "./types";
// import { MIN_BOARD_SIZE } from "./types";

// // ---------- test helpers ----------

// const BASE_SETTINGS: RoomSettings = {
//   winCondition: "timed",
//   durationMinutes: 30,
//   turnTimerSeconds: 45,
//   startingCapital: 3000,
//   boardVariant: "default",
//   boardSize: MIN_BOARD_SIZE,
//   maxPlayers: 6,
//   marketEventEveryNTurns: 1000, // effectively disabled unless a test wants it
// };

// function makePlayers(n: number) {
//   return Array.from({ length: n }, (_, i) => ({
//     id: `p${i}`,
//     userId: `user${i}`,
//     username: `Player${i}`,
//     pieceId: "cone-gold",
//   }));
// }

// function freshState(overrides: Partial<RoomSettings> = {}, players = 2): GameState {
//   return createInitialGameState("room1", { ...BASE_SETTINGS, ...overrides }, makePlayers(players));
// }

// /** Returns the Math.random() fraction that makes rollDice() produce the given face (1-6). */
// function fracFor(face: number): number {
//   return (face - 0.5) / 6;
// }

// /** Queues up exact Math.random() return values for the duration of `fn`. */
// function withRandomQueue<T>(values: number[], fn: () => T): T {
//   const queue = [...values];
//   const spy = vi.spyOn(Math, "random").mockImplementation(() => {
//     return queue.length > 0 ? (queue.shift() as number) : 0.5;
//   });
//   try {
//     return fn();
//   } finally {
//     spy.mockRestore();
//   }
// }

// function firstOwnableTileId(state: GameState, type?: string): string {
//   const idx = boardIndex(state.boardSize);
//   const tile = idx.tiles.find((t) => PURCHASABLE_TYPES.has(t.type) && (!type || t.type === type));
//   if (!tile) throw new Error(`no tile of type ${type} found`);
//   return tile.id;
// }

// /**
//  * Resolves whatever pendingDecision (if any) belongs to `pid`, without ever
//  * starting a further blocking auction — used between chained rolls in tests
//  * that don't care about the specific landing outcome, only that play can
//  * continue. Declining a `buy_or_skip` sends it to auction (another blocker),
//  * so this always accepts that one; every other decision kind resolves
//  * immediately regardless of accept/decline, so those are safe to always skip.
//  */
// function clearPending(state: GameState, pid: string): GameState {
//   const decision = state.pendingDecision;
//   if (!decision || decision.playerId !== pid) return state;
//   switch (decision.kind) {
//     case "buy_or_skip":
//       return resolveBuy(state, pid, true);
//     case "outbid_or_skip":
//       return resolveOutbid(state, pid, false);
//     case "invest_or_fee":
//       return resolveInvestOrFee(state, pid, false);
//     case "bet_or_fee":
//       return resolveBetOrFee(state, pid, "fee");
//     case "renew_or_release":
//       return resolveRenewOrRelease(state, pid, false);
//     default:
//       return state;
//   }
// }

// beforeEach(() => {
//   vi.restoreAllMocks();
// });

// afterEach(() => {
//   vi.restoreAllMocks();
// });

// // ---------- tests ----------

// describe("board generation", () => {
//   it("enforces the minimum board size and produces the right tile count", () => {
//     const idx = boardIndex(5); // below minimum
//     expect(idx.boardSize).toBe(MIN_BOARD_SIZE);
//     expect(idx.tiles.length).toBe(4 * (MIN_BOARD_SIZE - 1));
//   });

//   it("is deterministic for a given size (client/server produce identical boards)", () => {
//     const a = boardIndex(12);
//     const b = boardIndex(12);
//     expect(a.tiles.map((t) => t.id)).toEqual(b.tiles.map((t) => t.id));
//   });

//   it("places GO at position 0 and Jail at boardSize - 1", () => {
//     const idx = boardIndex(10);
//     expect(idx.tiles[0].type).toBe("go");
//     expect(idx.tiles[jailPosition(10)].type).toBe("jail");
//   });
// });

// describe("createInitialGameState", () => {
//   it("seeds every player with starting capital and position 0", () => {
//     const state = freshState({ startingCapital: 1500 }, 3);
//     expect(state.playerOrder).toHaveLength(3);
//     for (const pid of state.playerOrder) {
//       const p = state.players[pid];
//       expect(p.inGameBalance).toBe(1500);
//       expect(p.position).toBe(0);
//       expect(p.status).toBe("active");
//     }
//   });

//   it("seeds tileMarket only for purchasable tiles", () => {
//     const state = freshState();
//     const idx = boardIndex(state.boardSize);
//     for (const tile of idx.tiles) {
//       if (PURCHASABLE_TYPES.has(tile.type)) {
//         expect(state.tileMarket[tile.id]).toBeDefined();
//       } else {
//         expect(state.tileMarket[tile.id]).toBeUndefined();
//       }
//     }
//   });
// });

// describe("applyRoll — movement, GO salary, doubles", () => {
//   it("moves the current player by the sum of both dice and records lastRoll", () => {
//     let state = freshState();
//     const pid = currentPlayerId(state);
//     state = withRandomQueue([fracFor(3), fracFor(4)], () => applyRoll(state, pid));
//     expect(state.players[pid].position).toBe(7);
//     expect(state.lastRoll).toMatchObject({ playerId: pid, d1: 3, d2: 4, isDoubles: false });
//   });

//   it("pays GO salary when a player wraps past position 0", () => {
//     let state = freshState();
//     const pid = currentPlayerId(state);
//     const idx = boardIndex(state.boardSize);
//     state.players[pid].position = idx.total - 2;
//     const before = state.players[pid].inGameBalance;
//     state = withRandomQueue([fracFor(4), fracFor(3)], () => applyRoll(state, pid));
//     expect(state.players[pid].inGameBalance).toBe(before + 200);
//   });

//   it("ignores a roll from a player who isn't the current turn", () => {
//     let state = freshState();
//     const notCurrent = state.playerOrder[1];
//     const before = state.players[notCurrent].position;
//     state = withRandomQueue([fracFor(5), fracFor(5)], () => applyRoll(state, notCurrent));
//     expect(state.players[notCurrent].position).toBe(before);
//   });

//   it("blocks a second non-doubles roll in the same turn", () => {
//     let state = freshState();
//     const pid = currentPlayerId(state);
//     state = withRandomQueue([fracFor(2), fracFor(5)], () => applyRoll(state, pid));
//     const posAfterFirst = state.players[pid].position;
//     state = withRandomQueue([fracFor(6), fracFor(6)], () => applyRoll(state, pid));
//     expect(state.players[pid].position).toBe(posAfterFirst); // second roll had no effect
//   });

//   it("grants another roll on doubles, without ending the turn", () => {
//     let state = freshState();
//     const pid = currentPlayerId(state);
//     state = withRandomQueue([fracFor(3), fracFor(3)], () => applyRoll(state, pid));
//     expect(state.players[pid].hasRolledThisTurn).toBe(false);
//     expect(currentPlayerId(state)).toBe(pid);
//   });

//   it("sends a player to Jail after three doubles in a row", () => {
//     let state = freshState();
//     const pid = currentPlayerId(state);
//     state = withRandomQueue([fracFor(2), fracFor(2)], () => applyRoll(state, pid));
//     state = clearPending(state, pid); // landing may trigger a decision that would otherwise block the next roll
//     state = withRandomQueue([fracFor(4), fracFor(4)], () => applyRoll(state, pid));
//     state = clearPending(state, pid);
//     state = withRandomQueue([fracFor(6), fracFor(6)], () => applyRoll(state, pid));
//     state = clearPending(state, pid);
//     expect(state.players[pid].inJail).toBe(true);
//     expect(state.players[pid].position).toBe(jailPosition(state.boardSize));
//   });
// });

// describe("buying, renting, and auctions", () => {
//   it("lets the landing player buy an unowned property", () => {
//     let state = freshState();
//     const pid = currentPlayerId(state);
//     const tileId = firstOwnableTileId(state, "property");
//     state.players[pid].position = boardIndex(state.boardSize).byId[tileId].position - 2;
//     state = withRandomQueue([fracFor(1), fracFor(1)], () => applyRoll(state, pid));
//     expect(state.pendingDecision?.kind).toBe("buy_or_skip");

//     const price = state.pendingDecision!.price;
//     const before = state.players[pid].inGameBalance;
//     state = resolveBuy(state, pid, true);

//     expect(state.tileMarket[tileId].ownerPlayerId).toBe(pid);
//     expect(state.players[pid].inGameBalance).toBe(before - price);
//     expect(state.pendingDecision).toBeNull();
//   });

//   it("charges rent to a player landing on someone else's property", () => {
//     let state = freshState();
//     const [ownerId, renterId] = state.playerOrder;
//     const tileId = firstOwnableTileId(state, "property");
//     const ts = state.tileMarket[tileId];
//     ts.ownerPlayerId = ownerId;
//     ts.purchasePrice = 100;

//     const tile = boardIndex(state.boardSize).byId[tileId];
//     state.players[renterId].position = tile.position - 3;
//     state.currentPlayerIndex = state.playerOrder.indexOf(renterId);

//     const ownerBefore = state.players[ownerId].inGameBalance;
//     const renterBefore = state.players[renterId].inGameBalance;
//     state = withRandomQueue([fracFor(2), fracFor(1)], () => applyRoll(state, renterId));

//     const rent = Math.round(tileCurrentValue(state, tileId) * tile.rentPercent);
//     expect(state.players[ownerId].inGameBalance).toBe(ownerBefore + rent);
//     expect(state.players[renterId].inGameBalance).toBe(renterBefore - rent);
//   });

//   it("starts a live auction when the landing player declines to buy, and awards the tile to the winner", () => {
//     let state = freshState({ startingCapital: 500 }, 3);
//     const pid = currentPlayerId(state);
//     const tileId = firstOwnableTileId(state, "property");
//     state.players[pid].position = boardIndex(state.boardSize).byId[tileId].position - 2;
//     state = withRandomQueue([fracFor(1), fracFor(1)], () => applyRoll(state, pid));

//     state = resolveBuy(state, pid, false); // decline -> auction starts
//     expect(state.auction).not.toBeNull();
//     expect(state.auction!.tileId).toBe(tileId);

//     // Bidding goes around; everyone but one player passes.
//     const bidder = state.auction!.currentTurnPlayerId;
//     state = auctionBid(state, bidder, 120);
//     expect(state.auction!.highestBid).toBe(120);

//     // Remaining players pass until only the bidder is left.
//     while (state.auction && state.auction.activePlayerIds.length > 1) {
//       const turnPlayer = state.auction.currentTurnPlayerId;
//       state = auctionPass(state, turnPlayer);
//     }

//     expect(state.auction).toBeNull();
//     expect(state.tileMarket[tileId].ownerPlayerId).toBe(bidder);
//     expect(state.tileMarket[tileId].purchasePrice).toBe(120);
//   });

//   it("keeps auction turn order fair — a pass advances to the next remaining player, never back to whoever is already winning", () => {
//     let state = freshState({ startingCapital: 500 }, 3);
//     const [p0, p1, p2] = state.playerOrder;
//     const tileId = firstOwnableTileId(state, "property");
//     state.auction = { tileId, highestBid: 0, highestBidderId: null, currentTurnPlayerId: p0, activePlayerIds: [p0, p1, p2], minIncrement: 10 };

//     state = auctionBid(state, p0, 100);
//     expect(state.auction!.currentTurnPlayerId).toBe(p1); // advances in order after a bid

//     state = auctionPass(state, p1);
//     // p1 passed — turn must go to p2 (the only other remaining player), never back to p0.
//     expect(state.auction!.currentTurnPlayerId).toBe(p2);
//     expect(state.auction!.activePlayerIds).toEqual([p0, p2]);
//   });

//   it("blocks rolling while an auction is in progress", () => {
//     let state = freshState({ startingCapital: 500 }, 2);
//     const pid = currentPlayerId(state);
//     const tileId = firstOwnableTileId(state, "property");
//     state.players[pid].position = boardIndex(state.boardSize).byId[tileId].position - 2;
//     state = withRandomQueue([fracFor(1), fracFor(1)], () => applyRoll(state, pid));
//     state = resolveBuy(state, pid, false);
//     expect(state.auction).not.toBeNull();

//     const posBefore = state.players[pid].position;
//     state = withRandomQueue([fracFor(4), fracFor(4)], () => applyRoll(state, pid));
//     expect(state.players[pid].position).toBe(posBefore); // roll had no effect, auction still blocking
//   });
// });

// describe("contracts", () => {
//   it("lets a landing player buy out a contract, refunding the previous owner what they paid", () => {
//     let state = freshState();
//     const [ownerId, challengerId] = state.playerOrder;
//     const tileId = firstOwnableTileId(state, "contract");
//     const ts = state.tileMarket[tileId];
//     ts.ownerPlayerId = ownerId;
//     ts.purchasePrice = 200;
//     ts.contractExpiresAtTurn = 999;

//     const tile = boardIndex(state.boardSize).byId[tileId];
//     state.players[challengerId].position = tile.position - 2;
//     state.currentPlayerIndex = state.playerOrder.indexOf(challengerId);

//     state = withRandomQueue([fracFor(1), fracFor(1)], () => applyRoll(state, challengerId));
//     expect(state.pendingDecision?.kind).toBe("outbid_or_skip");

//     const price = state.pendingDecision!.price;
//     const ownerBefore = state.players[ownerId].inGameBalance;
//     state = resolveOutbid(state, challengerId, true);

//     expect(state.tileMarket[tileId].ownerPlayerId).toBe(challengerId);
//     expect(state.players[ownerId].inGameBalance).toBe(ownerBefore + 200); // refunded exactly what they paid
//     void price;
//   });

//   it("offers renewal when a contract expires at the start of the owner's turn", () => {
//     let state = freshState({}, 2);
//     const [ownerId, otherId] = state.playerOrder;
//     const tileId = firstOwnableTileId(state, "contract");
//     state.tileMarket[tileId].ownerPlayerId = ownerId;
//     state.tileMarket[tileId].purchasePrice = 200;

//     // Turn sequence: turn 1 = ownerId's turn. Ending it moves to turn 2 (otherId).
//     // Ending turn 2 rotates back to ownerId on turn 3 — set the expiry to land exactly then.
//     state.tileMarket[tileId].contractExpiresAtTurn = 3;
//     state = endTurn(state, ownerId); // -> turn 2, otherId's turn
//     expect(state.turnNumber).toBe(2);
//     state = endTurn(state, otherId); // -> turn 3, back to ownerId; checkContractExpiry should fire

//     expect(state.turnNumber).toBe(3);
//     expect(currentPlayerId(state)).toBe(ownerId);
//     expect(state.pendingDecision).toMatchObject({ playerId: ownerId, tileId, kind: "renew_or_release" });

//     const before = state.players[ownerId].inGameBalance;
//     const upkeep = state.pendingDecision!.price;
//     state = resolveRenewOrRelease(state, ownerId, true);
//     expect(state.players[ownerId].inGameBalance).toBe(before - upkeep);
//     expect(state.tileMarket[tileId].contractExpiresAtTurn).toBeGreaterThan(state.turnNumber);
//   });

//   it("releases an expired contract back to the market when the owner declines to renew", () => {
//     let state = freshState({}, 2);
//     const [ownerId, otherId] = state.playerOrder;
//     const tileId = firstOwnableTileId(state, "contract");
//     state.tileMarket[tileId].ownerPlayerId = ownerId;
//     state.tileMarket[tileId].purchasePrice = 200;
//     state.tileMarket[tileId].contractExpiresAtTurn = 3;

//     state = endTurn(state, ownerId);
//     state = endTurn(state, otherId);
//     expect(state.pendingDecision?.kind).toBe("renew_or_release");

//     state = resolveRenewOrRelease(state, ownerId, false);
//     expect(state.tileMarket[tileId].ownerPlayerId).toBeNull();
//     expect(state.tileMarket[tileId].contractExpiresAtTurn).toBeUndefined();
//   });
// });

// describe("shared investments (tech/crypto/startup)", () => {
//   it("lets a first-time landing player invest and become a co-owner", () => {
//     let state = freshState();
//     const pid = currentPlayerId(state);
//     const tileId = firstOwnableTileId(state, "tech_company");
//     state.players[pid].position = boardIndex(state.boardSize).byId[tileId].position - 2;
//     state = withRandomQueue([fracFor(1), fracFor(1)], () => applyRoll(state, pid));
//     expect(state.pendingDecision?.kind).toBe("invest_or_fee");

//     state = resolveInvestOrFee(state, pid, true);
//     expect(state.tileMarket[tileId].investors[pid]).toBeGreaterThan(0);
//   });

//   it("splits the landing fee among existing investors proportionally when a new player declines", () => {
//     let state = freshState({ startingCapital: 5000 }, 3);
//     const tileId = firstOwnableTileId(state, "tech_company");
//     const ts = state.tileMarket[tileId];
//     ts.investors["p0"] = 300;
//     ts.investors["p1"] = 100;

//     const tile = boardIndex(state.boardSize).byId[tileId];
//     state.players["p2"].position = tile.position - 2;
//     state.currentPlayerIndex = state.playerOrder.indexOf("p2");

//     const p0Before = state.players["p0"].inGameBalance;
//     const p1Before = state.players["p1"].inGameBalance;
//     state = withRandomQueue([fracFor(1), fracFor(1)], () => applyRoll(state, "p2"));
//     expect(state.pendingDecision?.kind).toBe("invest_or_fee");

//     state = resolveInvestOrFee(state, "p2", false);
//     // p0 owns 75% of the pool, p1 owns 25% — fee should split roughly 3:1.
//     const p0Gain = state.players["p0"].inGameBalance - p0Before;
//     const p1Gain = state.players["p1"].inGameBalance - p1Before;
//     expect(p0Gain).toBeGreaterThan(p1Gain);
//     expect(p0Gain + p1Gain).toBeGreaterThan(0);
//   });

//   it("computes ownership percent as amountInvested / totalInvested", () => {
//     let state = freshState();
//     const tileId = firstOwnableTileId(state, "crypto");
//     state.tileMarket[tileId].investors["p0"] = 300;
//     state.tileMarket[tileId].investors["p1"] = 100;

//     const assets = getPlayerAssets(state, "p0");
//     const asset = assets.find((a) => a.tileId === tileId)!;
//     expect(asset.ownershipPercent).toBeCloseTo(75, 5);
//   });
// });

// describe("betting company", () => {
//   it("pays the bettor and debits the owner on a win, and always collects rake", () => {
//     let state = freshState({ startingCapital: 1000 }, 2);
//     const [ownerId, bettorId] = state.playerOrder;
//     const tileId = firstOwnableTileId(state, "betting");
//     state.tileMarket[tileId].ownerPlayerId = ownerId;
//     state.pendingDecision = { playerId: bettorId, tileId, kind: "bet_or_fee", price: 0, currentOwnerPlayerId: ownerId, landingFee: 10 };

//     const ownerBefore = state.players[ownerId].inGameBalance;
//     const bettorBefore = state.players[bettorId].inGameBalance;

//     // BET_WIN_PROBABILITY.color ~ 0.46 -> random() below that wins.
//     state = withRandomQueue([0.01], () => resolveBetOrFee(state, bettorId, "bet", "color", 100));

//     const rake = 5; // 5% of 100
//     const payout = 200; // 2x multiplier
//     expect(state.players[bettorId].inGameBalance).toBe(bettorBefore - rake + payout);
//     expect(state.players[ownerId].inGameBalance).toBe(ownerBefore + rake - payout);
//   });

//   it("issues the owner an emergency loan when a payout exceeds their balance", () => {
//     let state = freshState({ startingCapital: 1000 }, 2);
//     const [ownerId, bettorId] = state.playerOrder;
//     state.players[ownerId].inGameBalance = 50; // can't cover a big win
//     const tileId = firstOwnableTileId(state, "betting");
//     state.tileMarket[tileId].ownerPlayerId = ownerId;
//     state.pendingDecision = { playerId: bettorId, tileId, kind: "bet_or_fee", price: 0, currentOwnerPlayerId: ownerId, landingFee: 10 };

//     state = withRandomQueue([0.001], () => resolveBetOrFee(state, bettorId, "bet", "number", 100)); // 35x multiplier, guaranteed win

//     expect(state.players[ownerId].inGameBalance).toBe(0);
//     expect(state.players[ownerId].loans.length).toBe(1);
//     expect(state.players[ownerId].loans[0].status).toBe("active");
//   });
// });

// describe("loans", () => {
//   it("caps borrowing at a percentage of net worth", () => {
//     let state = freshState({ startingCapital: 100 }, 2);
//     const pid = currentPlayerId(state);
//     state = takeLoan(state, pid, 1_000_000);
//     expect(state.players[pid].loans[0].principal).toBeLessThan(1_000_000);
//     expect(state.players[pid].inGameBalance).toBeGreaterThan(100);
//   });

//   it("adds an installment obligation that is repaid over time", () => {
//     let state = freshState({ startingCapital: 1000 }, 2);
//     const pid = currentPlayerId(state);
//     state = takeLoan(state, pid, 300);
//     expect(state.players[pid].loans).toHaveLength(1);
//     expect(state.players[pid].loans[0].installmentsRemaining).toBeGreaterThan(0);
//   });
// });

// describe("mortgage and open-market sale", () => {
//   it("mortgaging pays out half current value and suspends rent collection", () => {
//     let state = freshState();
//     const [ownerId, renterId] = state.playerOrder;
//     const tileId = firstOwnableTileId(state, "property");
//     state.tileMarket[tileId].ownerPlayerId = ownerId;
//     state.tileMarket[tileId].purchasePrice = 200;

//     const before = state.players[ownerId].inGameBalance;
//     state = mortgageTile(state, ownerId, tileId);
//     expect(state.tileMarket[tileId].mortgaged).toBe(true);
//     expect(state.players[ownerId].inGameBalance).toBeGreaterThan(before);

//     const tile = boardIndex(state.boardSize).byId[tileId];
//     state.players[renterId].position = tile.position - 2;
//     state.currentPlayerIndex = state.playerOrder.indexOf(renterId);
//     const renterBefore = state.players[renterId].inGameBalance;
//     state = withRandomQueue([fracFor(1), fracFor(1)], () => applyRoll(state, renterId));
//     expect(state.players[renterId].inGameBalance).toBe(renterBefore); // no rent charged while mortgaged
//   });

//   it("unmortgaging costs 110% of the amount received and restores the asset", () => {
//     let state = freshState();
//     const ownerId = currentPlayerId(state);
//     const tileId = firstOwnableTileId(state, "property");
//     state.tileMarket[tileId].ownerPlayerId = ownerId;
//     state.tileMarket[tileId].purchasePrice = 200;
//     state = mortgageTile(state, ownerId, tileId);
//     const mortgageAmount = state.tileMarket[tileId].mortgageAmount!;

//     const before = state.players[ownerId].inGameBalance;
//     state = unmortgageTile(state, ownerId, tileId);
//     expect(state.tileMarket[tileId].mortgaged).toBe(false);
//     expect(state.players[ownerId].inGameBalance).toBe(before - Math.round(mortgageAmount * 1.1));
//   });

//   it("lets any other player buy a listed asset at the asking price", () => {
//     let state = freshState({ startingCapital: 1000 }, 2);
//     const [ownerId, buyerId] = state.playerOrder;
//     const tileId = firstOwnableTileId(state, "property");
//     state.tileMarket[tileId].ownerPlayerId = ownerId;
//     state.tileMarket[tileId].purchasePrice = 150;

//     state = listForSale(state, ownerId, tileId, 300);
//     expect(state.tileMarket[tileId].forSalePrice).toBe(300);

//     const buyerBefore = state.players[buyerId].inGameBalance;
//     const ownerBefore = state.players[ownerId].inGameBalance;
//     state = buyListed(state, buyerId, tileId);

//     expect(state.tileMarket[tileId].ownerPlayerId).toBe(buyerId);
//     expect(state.tileMarket[tileId].forSalePrice).toBeNull();
//     expect(state.players[buyerId].inGameBalance).toBe(buyerBefore - 300);
//     expect(state.players[ownerId].inGameBalance).toBe(ownerBefore + 300);
//   });
// });

// describe("building — property vs. Estate 3x multiplier", () => {
//   it("charges 3x as much to build on an Estate as an equivalent Property", () => {
//     let stateA = freshState({ startingCapital: 100_000 });
//     let stateB = freshState({ startingCapital: 100_000 });
//     const pid = currentPlayerId(stateA);

//     const propTileId = firstOwnableTileId(stateA, "property");
//     const estateTileId = firstOwnableTileId(stateB, "estate");
//     stateA.tileMarket[propTileId].ownerPlayerId = pid;
//     stateB.tileMarket[estateTileId].ownerPlayerId = pid;

//     const balBeforeA = stateA.players[pid].inGameBalance;
//     const balBeforeB = stateB.players[pid].inGameBalance;

//     stateA = buildHouse(stateA, pid, propTileId);
//     stateB = buildHouse(stateB, pid, estateTileId);

//     const propTile = boardIndex(stateA.boardSize).byId[propTileId];
//     const estateTile = boardIndex(stateB.boardSize).byId[estateTileId];

//     const costA = balBeforeA - stateA.players[pid].inGameBalance;
//     const costB = balBeforeB - stateB.players[pid].inGameBalance;

//     // Both tiles start at build level 0 -> cost = basePrice * 0.5 * 1 * (3 for estate)
//     expect(costB).toBe(Math.round(estateTile.basePrice * 0.5 * 3));
//     expect(costA).toBe(Math.round(propTile.basePrice * 0.5));
//     expect(stateA.tileMarket[propTileId].buildLevel).toBe(1);
//     expect(stateB.tileMarket[estateTileId].buildLevel).toBe(1);
//   });

//   it("refuses to build past the max level (hotel)", () => {
//     let state = freshState({ startingCapital: 1_000_000 });
//     const pid = currentPlayerId(state);
//     const tileId = firstOwnableTileId(state, "property");
//     state.tileMarket[tileId].ownerPlayerId = pid;
//     state.tileMarket[tileId].buildLevel = 5;
//     state = buildHouse(state, pid, tileId);
//     expect(state.tileMarket[tileId].buildLevel).toBe(5); // unchanged
//   });
// });

// describe("trading", () => {
//   it("swaps cash and single-owner tiles when a trade is accepted", () => {
//     let state = freshState({ startingCapital: 1000 }, 2);
//     const [a, b] = state.playerOrder;
//     const tileId = firstOwnableTileId(state, "property");
//     state.tileMarket[tileId].ownerPlayerId = a;

//     state = proposeTrade(state, a, b, 0, [tileId], 200, []);
//     const trade = state.trades[0];
//     expect(trade.status).toBe("pending");

//     const aBefore = state.players[a].inGameBalance;
//     const bBefore = state.players[b].inGameBalance;
//     state = respondTrade(state, b, trade.id, true);

//     expect(state.tileMarket[tileId].ownerPlayerId).toBe(b);
//     expect(state.players[a].inGameBalance).toBe(aBefore + 200);
//     expect(state.players[b].inGameBalance).toBe(bBefore - 200);
//     expect(state.trades[0].status).toBe("accepted");
//   });

//   it("declines a trade whose terms are no longer valid at accept-time", () => {
//     let state = freshState({ startingCapital: 100 }, 2);
//     const [a, b] = state.playerOrder;
//     const tileId = firstOwnableTileId(state, "property");
//     state.tileMarket[tileId].ownerPlayerId = a;

//     state = proposeTrade(state, a, b, 0, [tileId], 999_999, []); // b can't possibly afford this
//     const trade = state.trades[0];
//     state = respondTrade(state, b, trade.id, true);

//     expect(state.trades[0].status).toBe("declined");
//     expect(state.tileMarket[tileId].ownerPlayerId).toBe(a); // unchanged
//   });
// });

// describe("jail", () => {
//   it("sends a player to jail when they land on Go To Jail", () => {
//     let state = freshState();
//     const pid = currentPlayerId(state);
//     const idx = boardIndex(state.boardSize);
//     const goToJailTile = idx.tiles.find((t) => t.type === "go_to_jail")!;
//     state.players[pid].position = goToJailTile.position - 2;
//     state = withRandomQueue([fracFor(1), fracFor(1)], () => applyRoll(state, pid));

//     expect(state.players[pid].inJail).toBe(true);
//     expect(state.players[pid].position).toBe(jailPosition(state.boardSize));
//   });

//   it("lets a jailed player pay bail and leave immediately", () => {
//     let state = freshState();
//     const pid = currentPlayerId(state);
//     state.players[pid].inJail = true;
//     const before = state.players[pid].inGameBalance;
//     state = payBail(state, pid);
//     expect(state.players[pid].inJail).toBe(false);
//     expect(state.players[pid].inGameBalance).toBe(before - 50);
//   });

//   it("lets a jailed player use a Get Out of Jail Free card instead of paying", () => {
//     let state = freshState();
//     const pid = currentPlayerId(state);
//     state.players[pid].inJail = true;
//     state.players[pid].getOutOfJailFreeCards = 1;
//     const before = state.players[pid].inGameBalance;
//     state = useJailCard(state, pid);
//     expect(state.players[pid].inJail).toBe(false);
//     expect(state.players[pid].getOutOfJailFreeCards).toBe(0);
//     expect(state.players[pid].inGameBalance).toBe(before); // free
//   });

//   it("escapes jail on a doubles roll attempt, and moves that turn", () => {
//     let state = freshState();
//     const pid = currentPlayerId(state);
//     state.players[pid].inJail = true;
//     state.players[pid].position = jailPosition(state.boardSize);
//     state = withRandomQueue([fracFor(4), fracFor(4)], () => attemptJailRoll(state, pid));
//     expect(state.players[pid].inJail).toBe(false);
//     expect(state.players[pid].position).not.toBe(jailPosition(state.boardSize));
//   });

//   it("forces bail after three failed jail-escape attempts", () => {
//     let state = freshState();
//     const pid = currentPlayerId(state);
//     state.players[pid].inJail = true;
//     state.players[pid].position = jailPosition(state.boardSize);

//     for (let i = 0; i < 2; i++) {
//       state.players[pid].hasRolledThisTurn = false;
//       state = withRandomQueue([fracFor(1), fracFor(2)], () => attemptJailRoll(state, pid));
//       expect(state.players[pid].inJail).toBe(true);
//     }
//     state.players[pid].hasRolledThisTurn = false;
//     const before = state.players[pid].inGameBalance;
//     state = withRandomQueue([fracFor(1), fracFor(2)], () => attemptJailRoll(state, pid));
//     expect(state.players[pid].inJail).toBe(false);
//     expect(state.players[pid].inGameBalance).toBe(before - 50);
//   });
// });

// describe("turn rotation and win conditions", () => {
//   it("advances to the next active player and skips bankrupt ones", () => {
//     let state = freshState({}, 3);
//     const [a, , c] = state.playerOrder;
//     state.players[state.playerOrder[1]].status = "bankrupt";
//     state.currentPlayerIndex = state.playerOrder.indexOf(a);
//     state = endTurn(state, a);
//     expect(currentPlayerId(state)).toBe(c);
//   });

//   it("declares the last active player the winner under bankrupt_all", () => {
//     let state = freshState({ winCondition: "bankrupt_all" }, 2);
//     const [a, b] = state.playerOrder;
//     state.players[b].status = "bankrupt";
//     state = endTurn(state, a);
//     expect(state.status).toBe("ended");
//     expect(state.winnerId).toBe(a);
//   });

//   it("declares the highest net worth the winner when time runs out", () => {
//     let state = freshState({ winCondition: "timed" }, 2);
//     const [a, b] = state.playerOrder;
//     state.players[a].inGameBalance = 1000;
//     state.players[b].inGameBalance = 5000;
//     // netWorth is cached, not auto-derived — sync it after directly mutating inGameBalance.
//     // b is deliberately NOT first in playerOrder, so this only passes if the
//     // engine actually compares net worth rather than defaulting to turn order.
//     state.players[a].netWorth = computeNetWorth(state, a);
//     state.players[b].netWorth = computeNetWorth(state, b);
//     state = endByTimeout(state);
//     expect(state.status).toBe("ended");
//     expect(state.winnerId).toBe(b);
//   });

//   it("declares a winner once someone reaches the net worth target", () => {
//     let state = freshState({ winCondition: "net_worth_target", winTarget: 4000 }, 2);
//     const [a] = state.playerOrder;
//     state.players[a].inGameBalance = 5000;
//     state.players[a].netWorth = computeNetWorth(state, a); // netWorth is cached, not auto-derived — sync it after a direct mutation
//     state = endTurn(state, currentPlayerId(state));
//     expect(state.status).toBe("ended");
//     expect(state.winnerId).toBe(a);
//   });
// });

// describe("computeNetWorth", () => {
//   it("sums cash plus asset value minus outstanding loan installments", () => {
//     let state = freshState({ startingCapital: 1000 }, 2);
//     const pid = currentPlayerId(state);
//     const tileId = firstOwnableTileId(state, "property");
//     state.tileMarket[tileId].ownerPlayerId = pid;
//     state.tileMarket[tileId].purchasePrice = 200;

//     const nw = computeNetWorth(state, pid);
//     expect(nw).toBeGreaterThanOrEqual(1000); // cash + asset value, no debt yet
//   });
// });