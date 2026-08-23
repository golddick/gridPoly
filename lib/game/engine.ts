// import { boardIndex, ESTATE_VALUE_MULTIPLIER, GO_SALARY, jailPosition, PURCHASABLE_TYPES, SHARED_TYPES, SINGLE_OWNER_TYPES } from "./board";
// import { CHANCE_DECK, COMMUNITY_DECK } from "./cards";
// import type {
//   AssetType,
//   AuctionState,
//   BetRecord,
//   BetType,
//   BoardTile,
//   CardDeck,
//   CardEffect,
//   DiceRollRecord,
//   GameLogEntry,
//   GameState,
//   Loan,
//   OwnedAssetView,
//   PlayerState,
//   RoomSettings,
//   TileMarketState,
//   TradeOffer,
// } from "./types";
// import { BET_MULTIPLIERS, BET_WIN_PROBABILITY } from "./types";

// const LOAN_INTEREST_RATE = 0.08;
// const LOAN_INSTALLMENT_INTERVAL = 3;
// const LOAN_INSTALLMENTS = 6;
// const LOAN_CAP_PCT_OF_NET_WORTH = 0.75;
// const CONTRACT_DURATION_TURNS = 15;
// const CONTRACT_RENEWAL_UPKEEP_PCT = 0.15; // % of current value, paid to renew
// const BET_RAKE_PERCENT = 0.05;
// const MIN_VALUE_MULTIPLIER = 0.15;
// const JAIL_BAIL = 50;
// const MAX_JAIL_TURNS = 3;
// const BUILD_COST_PCT_OF_BASE = 0.5; // cost per level = tile.basePrice * this
// const RENT_MULTIPLIER = [1, 2, 3, 4, 5, 8]; // index = buildLevel (5 = hotel)
// const MAX_BUILD_LEVEL = 5;
// const MORTGAGE_VALUE_PCT = 0.5; // % of currentValue received when mortgaging
// const UNMORTGAGE_PAYOFF_PCT = 1.1; // × the mortgage amount received, to pay off
// const AUCTION_MIN_INCREMENT = 10;

// function id(prefix: string) {
//   return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
// }

// function clone<T>(v: T): T {
//   return typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v));
// }

// function log(state: GameState, playerId: string, actionType: GameLogEntry["actionType"], message: string) {
//   state.log.push({ turnNumber: state.turnNumber, playerId, actionType, message, timestamp: Date.now() });
//   if (state.log.length > 250) state.log.shift();
// }

// function tiles(state: GameState) {
//   return boardIndex(state.boardSize);
// }

// function tileById(state: GameState, tileId: string): BoardTile {
//   return tiles(state).byId[tileId];
// }

// function marketState(state: GameState, tileId: string): TileMarketState {
//   return state.tileMarket[tileId];
// }

// /** Current market value of a tile — single-owner types float off basePrice; shared types float off total invested. */
// export function tileCurrentValue(state: GameState, tileId: string): number {
//   const tile = tileById(state, tileId);
//   const ts = marketState(state, tileId);
//   if (SHARED_TYPES.has(tile.type as AssetType)) {
//     const totalInvested = Object.values(ts.investors).reduce((s, v) => s + v, 0);
//     return Math.round((totalInvested > 0 ? totalInvested : tile.basePrice) * ts.valueMultiplier);
//   }
//   return Math.round(tile.basePrice * ts.valueMultiplier);
// }

// export function createInitialGameState(
//   roomId: string,
//   settings: RoomSettings,
//   players: { id: string; userId: string; username: string; pieceId: string }[]
// ): GameState {
//   const idx = boardIndex(settings.boardSize);
//   const playerStates: Record<string, PlayerState> = {};
//   for (const p of players) {
//     playerStates[p.id] = {
//       id: p.id,
//       userId: p.userId,
//       username: p.username,
//       pieceId: p.pieceId,
//       inGameBalance: settings.startingCapital,
//       position: 0,
//       status: "active",
//       loans: [],
//       netWorth: settings.startingCapital,
//       inJail: false,
//       jailTurns: 0,
//       getOutOfJailFreeCards: 0,
//       hasRolledThisTurn: false,
//       doublesStreak: 0,
//     };
//   }

//   const tileMarket: Record<string, TileMarketState> = {};
//   for (const tile of idx.tiles) {
//     if (!PURCHASABLE_TYPES.has(tile.type)) continue;
//     tileMarket[tile.id] = {
//       tileId: tile.id,
//       valueMultiplier: 1,
//       ownerPlayerId: null,
//       purchasePrice: null,
//       investors: {},
//       buildLevel: tile.type === "property" || tile.type === "estate" ? 0 : undefined,
//     };
//   }

//   return {
//     roomId,
//     settings,
//     status: "in_progress",
//     boardVariant: settings.boardVariant,
//     boardSize: idx.boardSize,
//     turnNumber: 1,
//     currentPlayerIndex: 0,
//     playerOrder: players.map((p) => p.id),
//     players: playerStates,
//     tileMarket,
//     marketEvents: [],
//     cardDraws: [],
//     bets: [],
//     trades: [],
//     auction: null,
//     lastRoll: null,
//     log: [],
//     pendingDecision: null,
//     winnerId: null,
//     endedReason: null,
//   };
// }

// export function rollDice(): [number, number] {
//   return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
// }

// export function currentPlayerId(state: GameState): string {
//   return state.playerOrder[state.currentPlayerIndex];
// }

// /** Every tile a player holds a stake in, with live value / P&L — computed on demand, never stored. */
// export function getPlayerAssets(state: GameState, playerId: string): OwnedAssetView[] {
//   const idx = tiles(state);
//   const views: OwnedAssetView[] = [];

//   for (const tile of idx.tiles) {
//     if (!PURCHASABLE_TYPES.has(tile.type)) continue;
//     const ts = state.tileMarket[tile.id];
//     const currentValue = tileCurrentValue(state, tile.id);

//     if (SINGLE_OWNER_TYPES.has(tile.type as AssetType)) {
//       if (ts.ownerPlayerId !== playerId) continue;
//       views.push({
//         tileId: tile.id,
//         name: tile.name,
//         type: tile.type as AssetType,
//         isSingleOwner: true,
//         amountInvested: ts.purchasePrice ?? 0,
//         ownershipPercent: 100,
//         currentShareValue: currentValue,
//         profitLoss: currentValue - (ts.purchasePrice ?? 0),
//         buildLevel: ts.buildLevel,
//         contractExpiresAtTurn: ts.contractExpiresAtTurn,
//         mortgaged: ts.mortgaged,
//         forSalePrice: ts.forSalePrice,
//       });
//     } else {
//       const invested = ts.investors[playerId] ?? 0;
//       if (invested <= 0) continue;
//       const totalInvested = Object.values(ts.investors).reduce((s, v) => s + v, 0);
//       const ownershipPercent = totalInvested > 0 ? (invested / totalInvested) * 100 : 0;
//       const shareValue = Math.round((ownershipPercent / 100) * currentValue);
//       views.push({
//         tileId: tile.id,
//         name: tile.name,
//         type: tile.type as AssetType,
//         isSingleOwner: false,
//         amountInvested: invested,
//         ownershipPercent,
//         currentShareValue: shareValue,
//         profitLoss: shareValue - invested,
//       });
//     }
//   }
//   return views;
// }

// export function computeNetWorth(state: GameState, playerId: string): number {
//   const player = state.players[playerId];
//   const assetValue = getPlayerAssets(state, playerId).reduce((sum, a) => sum + a.currentShareValue, 0);
//   const debt = player.loans
//     .filter((l) => l.status === "active")
//     .reduce((sum, l) => sum + l.installmentAmount * l.installmentsRemaining, 0);
//   return player.inGameBalance + assetValue - debt;
// }

// function refreshNetWorth(state: GameState, playerId: string) {
//   state.players[playerId].netWorth = computeNetWorth(state, playerId);
// }

// /** Moves a player forward by `steps` tiles, paying GO salary on wraparound, then resolves landing. */
// function moveBySteps(state: GameState, player: PlayerState, steps: number) {
//   const idx = tiles(state);
//   const prevPosition = player.position;
//   const nextPosition = (((prevPosition + steps) % idx.total) + idx.total) % idx.total;
//   const passedGo = steps > 0 && prevPosition + steps >= idx.total;

//   if (passedGo) {
//     player.inGameBalance += GO_SALARY;
//     log(state, player.id, "pass_go", `${player.username} passed GO and collected $${GO_SALARY}.`);
//   }

//   player.position = nextPosition;
//   resolveLanding(state, player, idx.byPosition[nextPosition]);
// }

// /** Moves a player directly to an absolute board position (used by cards). */
// function moveToPosition(state: GameState, player: PlayerState, position: number, collectGoIfPassed: boolean) {
//   const idx = tiles(state);
//   const target = ((position % idx.total) + idx.total) % idx.total;
//   const passed = collectGoIfPassed && target < player.position;
//   player.position = target;
//   if (passed) {
//     player.inGameBalance += GO_SALARY;
//     log(state, player.id, "pass_go", `${player.username} passed GO and collected $${GO_SALARY}.`);
//   }
//   resolveLanding(state, player, idx.byPosition[target]);
// }

// function sendToJail(state: GameState, player: PlayerState) {
//   player.position = jailPosition(state.boardSize);
//   player.inJail = true;
//   player.jailTurns = 0;
//   player.doublesStreak = 0;
//   log(state, player.id, "go_to_jail", `${player.username} was sent to Jail.`);
// }

// export function applyRoll(prevState: GameState, playerId: string): GameState {
//   const state = clone(prevState);
//   if (currentPlayerId(state) !== playerId) return state;
//   if (state.pendingDecision || state.auction) return state;

//   const player = state.players[playerId];
//   if (player.inJail) return state; // must use jail actions instead
//   if (player.hasRolledThisTurn) return state;

//   const [d1, d2] = rollDice();
//   const steps = d1 + d2;
//   const isDoubles = d1 === d2;

//   state.lastRoll = { id: id("roll"), playerId, d1, d2, isDoubles, turnNumber: state.turnNumber, timestamp: Date.now() };
//   log(state, playerId, "roll", `${player.username} rolled ${d1} + ${d2} (${steps}).`);

//   if (isDoubles) {
//     player.doublesStreak += 1;
//     if (player.doublesStreak >= 3) {
//       sendToJail(state, player);
//       player.hasRolledThisTurn = true;
//       refreshNetWorth(state, playerId);
//       return state;
//     }
//   } else {
//     player.doublesStreak = 0;
//   }

//   moveBySteps(state, player, steps);

//   // Doubles grant another roll (unless it just sent them to jail above);
//   // a non-doubles roll locks further rolling until End Turn.
//   player.hasRolledThisTurn = !isDoubles;

//   refreshNetWorth(state, playerId);
//   return state;
// }

// export function payBail(prevState: GameState, playerId: string): GameState {
//   const state = clone(prevState);
//   const player = state.players[playerId];
//   if (currentPlayerId(state) !== playerId || !player.inJail) return state;
//   if (player.inGameBalance < JAIL_BAIL) return state;

//   player.inGameBalance -= JAIL_BAIL;
//   player.inJail = false;
//   player.jailTurns = 0;
//   log(state, playerId, "pay_bail", `${player.username} paid $${JAIL_BAIL} bail and is out of Jail.`);
//   refreshNetWorth(state, playerId);
//   return state;
// }

// export function useJailCard(prevState: GameState, playerId: string): GameState {
//   const state = clone(prevState);
//   const player = state.players[playerId];
//   if (currentPlayerId(state) !== playerId || !player.inJail) return state;
//   if (player.getOutOfJailFreeCards <= 0) return state;

//   player.getOutOfJailFreeCards -= 1;
//   player.inJail = false;
//   player.jailTurns = 0;
//   log(state, playerId, "use_jail_card", `${player.username} used a Get Out of Jail Free card.`);
//   refreshNetWorth(state, playerId);
//   return state;
// }

// export function attemptJailRoll(prevState: GameState, playerId: string): GameState {
//   const state = clone(prevState);
//   const player = state.players[playerId];
//   if (currentPlayerId(state) !== playerId || !player.inJail) return state;
//   if (player.hasRolledThisTurn) return state;

//   const [d1, d2] = rollDice();
//   const isDoubles = d1 === d2;
//   state.lastRoll = { id: id("roll"), playerId, d1, d2, isDoubles, turnNumber: state.turnNumber, timestamp: Date.now() };
//   log(state, playerId, "jail_roll", `${player.username} rolled ${d1} + ${d2} trying to escape Jail.`);

//   if (isDoubles) {
//     player.inJail = false;
//     player.jailTurns = 0;
//     player.doublesStreak = 0;
//     log(state, playerId, "jail_roll", `${player.username} rolled doubles and is out of Jail!`);
//     moveBySteps(state, player, d1 + d2);
//   } else {
//     player.jailTurns += 1;
//     if (player.jailTurns >= MAX_JAIL_TURNS) {
//       player.inGameBalance -= JAIL_BAIL;
//       player.inJail = false;
//       player.jailTurns = 0;
//       log(state, playerId, "pay_bail", `${player.username} paid bail after 3 failed attempts and is out of Jail.`);
//       moveBySteps(state, player, d1 + d2);
//     } else {
//       log(state, playerId, "jail_roll", `${player.username} stays in Jail (${player.jailTurns}/${MAX_JAIL_TURNS} attempts).`);
//     }
//   }

//   player.hasRolledThisTurn = true;
//   refreshNetWorth(state, playerId);
//   return state;
// }

// export function buildHouse(prevState: GameState, playerId: string, tileId: string): GameState {
//   const state = clone(prevState);
//   if (state.pendingDecision || state.auction) return state;
//   const tile = tileById(state, tileId);
//   const ts = state.tileMarket[tileId];
//   const player = state.players[playerId];
//   if (!tile || (tile.type !== "property" && tile.type !== "estate") || !ts || ts.ownerPlayerId !== playerId) return state;
//   if (ts.mortgaged) return state;

//   const level = ts.buildLevel ?? 0;
//   if (level >= MAX_BUILD_LEVEL) return state;

//   const isEstate = tile.type === "estate";
//   const cost = Math.round(tile.basePrice * BUILD_COST_PCT_OF_BASE * (level + 1) * (isEstate ? ESTATE_VALUE_MULTIPLIER : 1));
//   if (player.inGameBalance < cost) return state;

//   player.inGameBalance -= cost;
//   ts.buildLevel = level + 1;
//   const label = ts.buildLevel === MAX_BUILD_LEVEL ? "a hotel" : `house #${ts.buildLevel}`;
//   log(
//     state,
//     playerId,
//     "build",
//     `${player.username} built ${label} on ${tile.name} for $${cost}${isEstate ? " (estate — 3x value)" : ""}.`
//   );
//   refreshNetWorth(state, playerId);
//   return state;
// }

// function drawCard(state: GameState, player: PlayerState, deck: CardDeck) {
//   const pool = deck === "chance" ? CHANCE_DECK : COMMUNITY_DECK;
//   const card = pool[Math.floor(Math.random() * pool.length)];

//   state.cardDraws.push({ id: id("card"), turnNumber: state.turnNumber, playerId: player.id, deck, text: card.text });
//   if (state.cardDraws.length > 20) state.cardDraws.shift();
//   log(state, player.id, "draw_card", `${player.username} drew: ${card.text}`);

//   applyCardEffect(state, player, card.effect);
// }

// function applyCardEffect(state: GameState, player: PlayerState, effect: CardEffect) {
//   switch (effect.kind) {
//     case "collect":
//       player.inGameBalance += effect.amount;
//       break;
//     case "pay":
//       player.inGameBalance -= effect.amount;
//       break;
//     case "collect_from_each_player":
//       for (const pid of state.playerOrder) {
//         if (pid === player.id || state.players[pid].status !== "active") continue;
//         state.players[pid].inGameBalance -= effect.amount;
//         player.inGameBalance += effect.amount;
//         refreshNetWorth(state, pid);
//       }
//       break;
//     case "pay_each_player":
//       for (const pid of state.playerOrder) {
//         if (pid === player.id || state.players[pid].status !== "active") continue;
//         player.inGameBalance -= effect.amount;
//         state.players[pid].inGameBalance += effect.amount;
//         refreshNetWorth(state, pid);
//       }
//       break;
//     case "move_to_position":
//       moveToPosition(state, player, effect.position, effect.collectGoIfPassed);
//       return; // moveToPosition already resolves landing / refreshes downstream
//     case "move_relative":
//       moveBySteps(state, player, effect.steps);
//       return;
//     case "go_to_jail":
//       sendToJail(state, player);
//       break;
//     case "get_out_of_jail_free":
//       player.getOutOfJailFreeCards += 1;
//       break;
//     case "repairs": {
//       const totalLevels = getPlayerAssets(state, player.id)
//         .filter((a) => a.type === "property" || a.type === "estate")
//         .reduce((sum, a) => sum + (a.buildLevel ?? 0), 0);
//       player.inGameBalance -= totalLevels * effect.perLevel;
//       break;
//     }
//   }
// }

// function resolveLanding(state: GameState, player: PlayerState, tile: BoardTile) {
//   if (tile.type === "go" || tile.type === "jail" || tile.type === "exchange_floor") return;
//   if (tile.type === "go_to_jail") {
//     sendToJail(state, player);
//     return;
//   }
//   if (tile.type === "chance" || tile.type === "community") {
//     drawCard(state, player, tile.type);
//     return;
//   }
//   if (!PURCHASABLE_TYPES.has(tile.type)) return;

//   const ts = state.tileMarket[tile.id];
//   const currentValue = tileCurrentValue(state, tile.id);

//   if (tile.type === "property" || tile.type === "estate" || tile.type === "bond") {
//     if (!ts.ownerPlayerId) {
//       state.pendingDecision = { playerId: player.id, tileId: tile.id, kind: "buy_or_skip", price: currentValue };
//     } else if (ts.ownerPlayerId === player.id) {
//       log(state, player.id, "roll", `${player.username} landed on their own ${tile.name}.`);
//     } else if (ts.mortgaged) {
//       log(state, player.id, "roll", `${player.username} landed on ${tile.name} — it's mortgaged, no rent due.`);
//     } else {
//       const level = tile.type === "property" || tile.type === "estate" ? ts.buildLevel ?? 0 : 0;
//       const estateMultiplier = tile.type === "estate" ? ESTATE_VALUE_MULTIPLIER : 1;
//       const rent = Math.round(currentValue * tile.rentPercent * RENT_MULTIPLIER[level] * estateMultiplier);
//       const owner = state.players[ts.ownerPlayerId];
//       player.inGameBalance -= rent;
//       owner.inGameBalance += rent;
//       log(state, player.id, "pay_rent", `${player.username} paid $${rent} rent on ${tile.name} to ${owner.username}.`);
//       refreshNetWorth(state, owner.id);
//     }
//     return;
//   }

//   if (tile.type === "contract") {
//     if (!ts.ownerPlayerId) {
//       state.pendingDecision = { playerId: player.id, tileId: tile.id, kind: "buy_or_skip", price: currentValue };
//     } else if (ts.ownerPlayerId === player.id) {
//       log(state, player.id, "roll", `${player.username} landed on their own ${tile.name}.`);
//     } else {
//       state.pendingDecision = {
//         playerId: player.id,
//         tileId: tile.id,
//         kind: "outbid_or_skip",
//         price: currentValue,
//         currentOwnerPlayerId: ts.ownerPlayerId,
//       };
//     }
//     return;
//   }

//   if (tile.type === "betting") {
//     if (!ts.ownerPlayerId) {
//       state.pendingDecision = { playerId: player.id, tileId: tile.id, kind: "buy_or_skip", price: currentValue };
//     } else if (ts.ownerPlayerId === player.id) {
//       log(state, player.id, "roll", `${player.username} landed on their own ${tile.name}.`);
//     } else {
//       state.pendingDecision = {
//         playerId: player.id,
//         tileId: tile.id,
//         kind: "bet_or_fee",
//         price: 0,
//         currentOwnerPlayerId: ts.ownerPlayerId,
//         landingFee: Math.round(currentValue * tile.landingFeePercent),
//       };
//     }
//     return;
//   }

//   // Shared: tech_company, crypto, startup
//   const invested = ts.investors[player.id] ?? 0;
//   if (invested > 0) {
//     payLandingFeeShared(state, tile, player.id, currentValue);
//   } else {
//     state.pendingDecision = {
//       playerId: player.id,
//       tileId: tile.id,
//       kind: "invest_or_fee",
//       price: currentValue,
//       landingFee: Math.round(currentValue * tile.landingFeePercent),
//     };
//   }
// }

// function payLandingFeeShared(state: GameState, tile: BoardTile, payerId: string, currentValue: number) {
//   const ts = state.tileMarket[tile.id];
//   const player = state.players[payerId];
//   const fee = Math.round(currentValue * tile.landingFeePercent);
//   const others = Object.entries(ts.investors).filter(([pid]) => pid !== payerId);
//   const othersTotal = others.reduce((s, [, v]) => s + v, 0);

//   player.inGameBalance -= fee;
//   if (othersTotal > 0) {
//     for (const [pid, amount] of others) {
//       const share = Math.round(fee * (amount / othersTotal));
//       state.players[pid].inGameBalance += share;
//       refreshNetWorth(state, pid);
//     }
//     log(state, payerId, "pay_landing_fee", `${player.username} paid a $${fee} landing fee on ${tile.name} to existing investors.`);
//   } else {
//     log(state, payerId, "pay_landing_fee", `${player.username} paid a $${fee} landing fee on ${tile.name}.`);
//   }
// }

// export function resolveBuy(prevState: GameState, playerId: string, accept: boolean): GameState {
//   const state = clone(prevState);
//   const decision = state.pendingDecision;
//   if (!decision || decision.playerId !== playerId || decision.kind !== "buy_or_skip") return state;

//   const player = state.players[playerId];
//   const tile = tileById(state, decision.tileId);
//   const ts = state.tileMarket[tile.id];

//   if (accept && player.inGameBalance >= decision.price) {
//     player.inGameBalance -= decision.price;
//     ts.ownerPlayerId = playerId;
//     ts.purchasePrice = decision.price;
//     if (tile.type === "contract") ts.contractExpiresAtTurn = state.turnNumber + CONTRACT_DURATION_TURNS;
//     log(state, playerId, "buy", `${player.username} bought ${tile.name} for $${decision.price}.`);
//     state.pendingDecision = null;
//     refreshNetWorth(state, playerId);
//     return state;
//   }

//   log(state, playerId, "skip", `${player.username} passed on ${tile.name} — it goes to auction.`);
//   state.pendingDecision = null;
//   startAuction(state, tile.id);
//   return state;
// }

// function startAuction(state: GameState, tileId: string) {
//   const active = state.playerOrder.filter((pid) => state.players[pid].status === "active");
//   if (active.length === 0) return;
//   const startIdx = state.currentPlayerIndex % active.length;
//   state.auction = {
//     tileId,
//     highestBid: 0,
//     highestBidderId: null,
//     currentTurnPlayerId: active[startIdx],
//     activePlayerIds: active,
//     minIncrement: AUCTION_MIN_INCREMENT,
//   };
//   log(state, active[startIdx], "auction_start", `Auction started for ${tileById(state, tileId).name}.`);
// }

// function advanceAuctionTurn(state: GameState) {
//   const auction = state.auction;
//   if (!auction) return;
//   const remaining = auction.activePlayerIds;
//   if (remaining.length <= 1) return;
//   const idx = remaining.indexOf(auction.currentTurnPlayerId);
//   auction.currentTurnPlayerId = remaining[(idx + 1) % remaining.length];
// }

// function resolveAuctionIfDone(state: GameState) {
//   const auction = state.auction;
//   if (!auction) return;
//   if (auction.activePlayerIds.length > 1) return;

//   const tile = tileById(state, auction.tileId);
//   const ts = state.tileMarket[auction.tileId];
//   const winnerId = auction.activePlayerIds[0] ?? auction.highestBidderId;

//   if (winnerId && auction.highestBid > 0 && auction.highestBidderId === winnerId) {
//     const winner = state.players[winnerId];
//     winner.inGameBalance -= auction.highestBid;
//     ts.ownerPlayerId = winnerId;
//     ts.purchasePrice = auction.highestBid;
//     if (tile.type === "contract") ts.contractExpiresAtTurn = state.turnNumber + CONTRACT_DURATION_TURNS;
//     log(state, winnerId, "auction_won", `${winner.username} won the auction for ${tile.name} at $${auction.highestBid}.`);
//     refreshNetWorth(state, winnerId);
//   } else {
//     log(state, winnerId ?? currentPlayerId(state), "auction_unsold", `No bids — ${tile.name} stays unowned.`);
//   }

//   state.auction = null;
// }

// export function auctionBid(prevState: GameState, playerId: string, amount: number): GameState {
//   const state = clone(prevState);
//   const auction = state.auction;
//   if (!auction || auction.currentTurnPlayerId !== playerId) return state;
//   if (!auction.activePlayerIds.includes(playerId)) return state;

//   const player = state.players[playerId];
//   const minBid = auction.highestBid + auction.minIncrement;
//   if (amount < minBid || player.inGameBalance < amount) return state;

//   auction.highestBid = amount;
//   auction.highestBidderId = playerId;
//   log(state, playerId, "auction_bid", `${player.username} bid $${amount} on ${tileById(state, auction.tileId).name}.`);
//   advanceAuctionTurn(state);
//   resolveAuctionIfDone(state);
//   return state;
// }

// export function auctionPass(prevState: GameState, playerId: string): GameState {
//   const state = clone(prevState);
//   const auction = state.auction;
//   if (!auction || auction.currentTurnPlayerId !== playerId) return state;

//   const priorOrder = auction.activePlayerIds;
//   const passedIdx = priorOrder.indexOf(playerId);
//   auction.activePlayerIds = priorOrder.filter((pid) => pid !== playerId);
//   log(state, playerId, "auction_pass", `${state.players[playerId].username} passed on the auction.`);

//   if (auction.activePlayerIds.length > 0) {
//     // Continue the round from wherever the passed player was, rather than
//     // resetting to the first active player (which would unfairly skip others).
//     let nextIdx = passedIdx % priorOrder.length;
//     while (!auction.activePlayerIds.includes(priorOrder[nextIdx])) {
//       nextIdx = (nextIdx + 1) % priorOrder.length;
//     }
//     auction.currentTurnPlayerId = priorOrder[nextIdx];
//   }
//   resolveAuctionIfDone(state);
//   return state;
// }

// export function mortgageTile(prevState: GameState, playerId: string, tileId: string): GameState {
//   const state = clone(prevState);
//   if (state.pendingDecision || state.auction) return state;
//   const tile = tileById(state, tileId);
//   const ts = state.tileMarket[tileId];
//   const player = state.players[playerId];
//   if (!tile || !ts || ts.ownerPlayerId !== playerId || ts.mortgaged) return state;
//   if (tile.type === "contract") return state; // contracts have their own expiry/renewal lifecycle
//   if ((ts.buildLevel ?? 0) > 0) return state; // must sell buildings back down first (not modeled — block instead)

//   const currentValue = tileCurrentValue(state, tileId);
//   const amount = Math.round(currentValue * MORTGAGE_VALUE_PCT);
//   ts.mortgaged = true;
//   ts.mortgageAmount = amount;
//   player.inGameBalance += amount;
//   log(state, playerId, "mortgage", `${player.username} mortgaged ${tile.name} for $${amount}.`);
//   refreshNetWorth(state, playerId);
//   return state;
// }

// export function unmortgageTile(prevState: GameState, playerId: string, tileId: string): GameState {
//   const state = clone(prevState);
//   const tile = tileById(state, tileId);
//   const ts = state.tileMarket[tileId];
//   const player = state.players[playerId];
//   if (!tile || !ts || ts.ownerPlayerId !== playerId || !ts.mortgaged) return state;

//   const payoff = Math.round((ts.mortgageAmount ?? 0) * UNMORTGAGE_PAYOFF_PCT);
//   if (player.inGameBalance < payoff) return state;

//   player.inGameBalance -= payoff;
//   ts.mortgaged = false;
//   ts.mortgageAmount = undefined;
//   log(state, playerId, "unmortgage", `${player.username} paid $${payoff} to unmortgage ${tile.name}.`);
//   refreshNetWorth(state, playerId);
//   return state;
// }

// export function listForSale(prevState: GameState, playerId: string, tileId: string, askPrice: number): GameState {
//   const state = clone(prevState);
//   const ts = state.tileMarket[tileId];
//   if (!ts || ts.ownerPlayerId !== playerId || askPrice <= 0) return state;
//   ts.forSalePrice = askPrice;
//   log(state, playerId, "list_for_sale", `${state.players[playerId].username} listed ${tileById(state, tileId).name} for $${askPrice}.`);
//   return state;
// }

// export function cancelListing(prevState: GameState, playerId: string, tileId: string): GameState {
//   const state = clone(prevState);
//   const ts = state.tileMarket[tileId];
//   if (!ts || ts.ownerPlayerId !== playerId) return state;
//   ts.forSalePrice = null;
//   log(state, playerId, "cancel_listing", `${state.players[playerId].username} cancelled the listing on ${tileById(state, tileId).name}.`);
//   return state;
// }

// export function buyListed(prevState: GameState, buyerId: string, tileId: string): GameState {
//   const state = clone(prevState);
//   const tile = tileById(state, tileId);
//   const ts = state.tileMarket[tileId];
//   const buyer = state.players[buyerId];
//   if (!ts || !ts.forSalePrice || ts.ownerPlayerId === buyerId) return state;
//   if (buyer.inGameBalance < ts.forSalePrice) return state;

//   const sellerId = ts.ownerPlayerId!;
//   const seller = state.players[sellerId];
//   const price = ts.forSalePrice;

//   buyer.inGameBalance -= price;
//   seller.inGameBalance += price;
//   ts.ownerPlayerId = buyerId;
//   ts.purchasePrice = price;
//   ts.forSalePrice = null;
//   log(state, buyerId, "buy_listed", `${buyer.username} bought ${tile.name} from ${seller.username} for $${price}.`);
//   refreshNetWorth(state, sellerId);
//   refreshNetWorth(state, buyerId);
//   return state;
// }

// export function proposeTrade(
//   prevState: GameState,
//   fromPlayerId: string,
//   toPlayerId: string,
//   offerCash: number,
//   offerTileIds: string[],
//   requestCash: number,
//   requestTileIds: string[]
// ): GameState {
//   const state = clone(prevState);
//   if (!state.players[toPlayerId] || fromPlayerId === toPlayerId) return state;

//   const trade: TradeOffer = {
//     id: id("trade"),
//     fromPlayerId,
//     toPlayerId,
//     offerCash: Math.max(0, offerCash),
//     offerTileIds,
//     requestCash: Math.max(0, requestCash),
//     requestTileIds,
//     status: "pending",
//     createdAtTurn: state.turnNumber,
//   };
//   state.trades.push(trade);
//   if (state.trades.length > 30) state.trades.shift();
//   log(
//     state,
//     fromPlayerId,
//     "propose_trade",
//     `${state.players[fromPlayerId].username} proposed a trade to ${state.players[toPlayerId].username}.`
//   );
//   return state;
// }

// export function respondTrade(prevState: GameState, playerId: string, tradeId: string, accept: boolean): GameState {
//   const state = clone(prevState);
//   const trade = state.trades.find((t) => t.id === tradeId);
//   if (!trade || trade.status !== "pending" || trade.toPlayerId !== playerId) return state;

//   if (!accept) {
//     trade.status = "declined";
//     log(state, playerId, "decline_trade", `${state.players[playerId].username} declined a trade.`);
//     return state;
//   }

//   const from = state.players[trade.fromPlayerId];
//   const to = state.players[trade.toPlayerId];

//   const offerValid = trade.offerTileIds.every((tid) => state.tileMarket[tid]?.ownerPlayerId === trade.fromPlayerId);
//   const requestValid = trade.requestTileIds.every((tid) => state.tileMarket[tid]?.ownerPlayerId === trade.toPlayerId);
//   if (!offerValid || !requestValid || from.inGameBalance < trade.offerCash || to.inGameBalance < trade.requestCash) {
//     trade.status = "declined";
//     log(state, playerId, "decline_trade", `Trade between ${from.username} and ${to.username} fell through — terms no longer valid.`);
//     return state;
//   }

//   from.inGameBalance -= trade.offerCash;
//   to.inGameBalance += trade.offerCash;
//   to.inGameBalance -= trade.requestCash;
//   from.inGameBalance += trade.requestCash;

//   for (const tid of trade.offerTileIds) state.tileMarket[tid].ownerPlayerId = trade.toPlayerId;
//   for (const tid of trade.requestTileIds) state.tileMarket[tid].ownerPlayerId = trade.fromPlayerId;

//   trade.status = "accepted";
//   log(state, playerId, "accept_trade", `${from.username} and ${to.username} completed a trade.`);
//   refreshNetWorth(state, trade.fromPlayerId);
//   refreshNetWorth(state, trade.toPlayerId);
//   return state;
// }

// export function resolveOutbid(prevState: GameState, playerId: string, accept: boolean): GameState {
//   const state = clone(prevState);
//   const decision = state.pendingDecision;
//   if (!decision || decision.playerId !== playerId || decision.kind !== "outbid_or_skip") return state;

//   const tile = tileById(state, decision.tileId);
//   const ts = state.tileMarket[tile.id];
//   const player = state.players[playerId];
//   const ownerId = decision.currentOwnerPlayerId!;
//   const owner = state.players[ownerId];

//   if (accept && player.inGameBalance >= decision.price) {
//     const refund = ts.purchasePrice ?? 0;
//     owner.inGameBalance += refund;
//     player.inGameBalance -= decision.price;
//     ts.ownerPlayerId = playerId;
//     ts.purchasePrice = decision.price;
//     ts.contractExpiresAtTurn = state.turnNumber + CONTRACT_DURATION_TURNS;
//     log(
//       state,
//       playerId,
//       "outbid_contract",
//       `${player.username} bought out ${owner.username}'s ${tile.name} for $${decision.price} (${owner.username} refunded $${refund}).`
//     );
//     refreshNetWorth(state, ownerId);
//   } else {
//     log(state, playerId, "skip", `${player.username} let ${owner.username} keep ${tile.name}.`);
//   }

//   state.pendingDecision = null;
//   refreshNetWorth(state, playerId);
//   return state;
// }

// export function resolveInvestOrFee(prevState: GameState, playerId: string, invest: boolean): GameState {
//   const state = clone(prevState);
//   const decision = state.pendingDecision;
//   if (!decision || decision.playerId !== playerId || decision.kind !== "invest_or_fee") return state;

//   const tile = tileById(state, decision.tileId);
//   const ts = state.tileMarket[tile.id];
//   const player = state.players[playerId];

//   if (invest && player.inGameBalance >= decision.price) {
//     ts.investors[playerId] = (ts.investors[playerId] ?? 0) + decision.price;
//     player.inGameBalance -= decision.price;
//     log(state, playerId, "invest", `${player.username} invested $${decision.price} in ${tile.name}.`);
//   } else {
//     payLandingFeeShared(state, tile, playerId, decision.price);
//   }

//   state.pendingDecision = null;
//   refreshNetWorth(state, playerId);
//   return state;
// }

// export function resolveBetOrFee(
//   prevState: GameState,
//   playerId: string,
//   choice: "bet" | "fee",
//   betType?: BetType,
//   stakeAmount?: number
// ): GameState {
//   const state = clone(prevState);
//   const decision = state.pendingDecision;
//   if (!decision || decision.playerId !== playerId || decision.kind !== "bet_or_fee") return state;

//   const tile = tileById(state, decision.tileId);
//   const player = state.players[playerId];
//   const ownerId = decision.currentOwnerPlayerId!;
//   const owner = state.players[ownerId];

//   if (choice === "fee") {
//     const fee = decision.landingFee ?? 0;
//     player.inGameBalance -= fee;
//     owner.inGameBalance += fee;
//     log(state, playerId, "pay_landing_fee", `${player.username} paid a $${fee} landing fee at ${tile.name}.`);
//   } else if (betType && stakeAmount && stakeAmount > 0 && player.inGameBalance >= stakeAmount) {
//     const multiplier = BET_MULTIPLIERS[betType];
//     const rake = Math.round(stakeAmount * BET_RAKE_PERCENT);
//     player.inGameBalance -= rake;
//     owner.inGameBalance += rake;

//     const won = Math.random() < BET_WIN_PROBABILITY[betType];
//     let payoutAmount = 0;

//     if (won) {
//       payoutAmount = stakeAmount * multiplier;
//       owner.inGameBalance -= payoutAmount;
//       player.inGameBalance += payoutAmount;
//       if (owner.inGameBalance < 0) {
//         const shortfall = -owner.inGameBalance;
//         owner.inGameBalance = 0;
//         owner.loans.push(forcedLoan(state, shortfall));
//         log(state, ownerId, "take_loan", `${owner.username} couldn't cover a payout and took an emergency loan of $${shortfall}.`);
//       }
//       log(state, playerId, "bet", `${player.username} won a ${betType} bet at ${tile.name} — $${payoutAmount} from ${owner.username}.`);
//     } else {
//       owner.inGameBalance += stakeAmount;
//       player.inGameBalance -= stakeAmount;
//       log(state, playerId, "bet", `${player.username} lost a ${betType} bet at ${tile.name} — $${stakeAmount} to ${owner.username}.`);
//     }

//     const bet: BetRecord = {
//       id: id("bet"),
//       tileId: tile.id,
//       bettorPlayerId: playerId,
//       ownerPlayerId: ownerId,
//       betType,
//       betAmount: stakeAmount,
//       multiplier,
//       result: won ? "win" : "lose",
//       payoutAmount,
//       rakeAmount: rake,
//       turnNumber: state.turnNumber,
//     };
//     state.bets.push(bet);
//     if (state.bets.length > 50) state.bets.shift();
//     refreshNetWorth(state, ownerId);
//   }

//   state.pendingDecision = null;
//   refreshNetWorth(state, playerId);
//   return state;
// }

// export function resolveRenewOrRelease(prevState: GameState, playerId: string, renew: boolean): GameState {
//   const state = clone(prevState);
//   const decision = state.pendingDecision;
//   if (!decision || decision.playerId !== playerId || decision.kind !== "renew_or_release") return state;

//   const tile = tileById(state, decision.tileId);
//   const ts = state.tileMarket[tile.id];
//   const player = state.players[playerId];

//   if (renew && player.inGameBalance >= decision.price) {
//     player.inGameBalance -= decision.price;
//     ts.contractExpiresAtTurn = state.turnNumber + CONTRACT_DURATION_TURNS;
//     log(state, playerId, "renew_contract", `${player.username} renewed ${tile.name} for $${decision.price}.`);
//   } else {
//     ts.ownerPlayerId = null;
//     ts.purchasePrice = null;
//     ts.contractExpiresAtTurn = undefined;
//     log(state, playerId, "release_contract", `${player.username} let ${tile.name} expire — it's back on the market.`);
//   }

//   state.pendingDecision = null;
//   refreshNetWorth(state, playerId);
//   return state;
// }

// function forcedLoan(state: GameState, principal: number): Loan {
//   return {
//     id: id("loan"),
//     principal,
//     interestRate: LOAN_INTEREST_RATE,
//     installmentAmount: Math.ceil((principal * (1 + LOAN_INTEREST_RATE)) / LOAN_INSTALLMENTS),
//     installmentIntervalTurns: LOAN_INSTALLMENT_INTERVAL,
//     installmentsRemaining: LOAN_INSTALLMENTS,
//     missedPayments: 0,
//     status: "active",
//     createdAtTurn: state.turnNumber,
//   };
// }

// export function takeLoan(prevState: GameState, playerId: string, principal: number): GameState {
//   const state = clone(prevState);
//   const player = state.players[playerId];
//   if (state.pendingDecision) return state;
//   if (principal <= 0) return state;

//   const cap = Math.max(0, computeNetWorth(state, playerId) * LOAN_CAP_PCT_OF_NET_WORTH);
//   const amount = Math.min(principal, cap);
//   if (amount <= 0) {
//     log(state, playerId, "take_loan", `${player.username} was denied a loan — insufficient net worth.`);
//     return state;
//   }

//   const loan = forcedLoan(state, amount);
//   player.loans.push(loan);
//   player.inGameBalance += amount;
//   log(state, playerId, "take_loan", `${player.username} borrowed $${amount} from the Bank/Exchange.`);
//   refreshNetWorth(state, playerId);
//   return state;
// }

// /** Passive income a player earns per turn: contract/bond fixed income + tech dividends. */
// function passiveIncome(state: GameState, playerId: string): number {
//   const idx = tiles(state);
//   let total = 0;
//   for (const tile of idx.tiles) {
//     if (tile.type !== "contract" && tile.type !== "bond" && tile.type !== "tech_company") continue;
//     const ts = state.tileMarket[tile.id];
//     if (!ts) continue;
//     if (SINGLE_OWNER_TYPES.has(tile.type as AssetType)) {
//       if (ts.ownerPlayerId === playerId) total += tile.baseIncomeRate;
//     } else {
//       const invested = ts.investors[playerId] ?? 0;
//       if (invested > 0) total += tile.baseIncomeRate; // tech dividend, precomputed as $/round in board config
//     }
//   }
//   return Math.round(total);
// }

// function liquidateLowestValueAsset(state: GameState, playerId: string): boolean {
//   const assets = getPlayerAssets(state, playerId);
//   if (assets.length === 0) return false;
//   const lowest = assets.reduce((min, a) => (a.currentShareValue < min.currentShareValue ? a : min), assets[0]);
//   const ts = state.tileMarket[lowest.tileId];
//   const player = state.players[playerId];
//   const recovered = Math.round(lowest.currentShareValue * 0.5);

//   if (lowest.isSingleOwner) {
//     ts.ownerPlayerId = null;
//     ts.purchasePrice = null;
//     ts.contractExpiresAtTurn = undefined;
//     ts.mortgaged = false;
//     ts.mortgageAmount = undefined;
//     ts.forSalePrice = null;
//     ts.buildLevel = tileById(state, lowest.tileId).type === "property" || tileById(state, lowest.tileId).type === "estate" ? 0 : ts.buildLevel;
//   } else {
//     delete ts.investors[playerId];
//   }
//   player.inGameBalance += recovered;
//   log(state, playerId, "loan_missed", `${player.username}'s ${lowest.name} was force-liquidated for $${recovered} to cover a missed payment.`);
//   return true;
// }

// function processLoanInstallments(state: GameState, playerId: string) {
//   const player = state.players[playerId];
//   const income = passiveIncome(state, playerId);
//   let incomeRemaining = income;
//   if (income > 0) player.inGameBalance += income;

//   for (const loan of player.loans) {
//     if (loan.status !== "active") continue;
//     const turnsSinceStart = state.turnNumber - loan.createdAtTurn;
//     const isDue = turnsSinceStart > 0 && turnsSinceStart % loan.installmentIntervalTurns === 0;
//     if (!isDue) continue;

//     const fromIncome = Math.min(incomeRemaining, loan.installmentAmount);
//     const remainder = loan.installmentAmount - fromIncome;
//     incomeRemaining -= fromIncome;

//     if (player.inGameBalance >= remainder) {
//       player.inGameBalance -= remainder;
//       loan.installmentsRemaining -= 1;
//       log(state, playerId, "loan_installment", `${player.username} paid a $${loan.installmentAmount} loan installment (${loan.installmentsRemaining} remaining).`);
//       if (loan.installmentsRemaining <= 0) {
//         loan.status = "paid_off";
//         log(state, playerId, "loan_installment", `${player.username} paid off a loan in full.`);
//       }
//     } else {
//       loan.missedPayments += 1;
//       if (loan.missedPayments === 1) {
//         loan.interestRate += 0.05;
//         loan.installmentAmount = Math.ceil(loan.installmentAmount * 1.1);
//         log(state, playerId, "loan_missed", `${player.username} missed a payment — penalty interest applied.`);
//       } else if (loan.missedPayments === 2) {
//         if (!liquidateLowestValueAsset(state, playerId)) {
//           loan.status = "defaulted";
//           log(state, playerId, "loan_defaulted", `${player.username} defaulted — no assets left to seize.`);
//         }
//       } else {
//         loan.status = "defaulted";
//         log(state, playerId, "loan_defaulted", `${player.username} defaulted on a loan — remaining assets seized by the Bank/Exchange.`);
//         for (const asset of getPlayerAssets(state, playerId)) {
//           const ts = state.tileMarket[asset.tileId];
//           if (asset.isSingleOwner) {
//             ts.ownerPlayerId = null;
//             ts.purchasePrice = null;
//             ts.contractExpiresAtTurn = undefined;
//             ts.mortgaged = false;
//             ts.mortgageAmount = undefined;
//             ts.forSalePrice = null;
//           } else {
//             delete ts.investors[playerId];
//           }
//         }
//       }
//     }
//   }

//   refreshNetWorth(state, playerId);
// }

// const MARKET_EVENT_TYPES: AssetType[] = ["property", "estate", "bond", "contract", "betting", "tech_company", "crypto", "startup"];

// const EVENT_LABEL: Record<AssetType, string> = {
//   property: "Property market",
//   estate: "Luxury estate market",
//   bond: "Bond market",
//   contract: "Contract sector",
//   betting: "Betting houses",
//   tech_company: "Tech sector",
//   crypto: "Crypto market",
//   startup: "Startup sector",
// };

// export function triggerMarketEvent(state: GameState): void {
//   const idx = tiles(state);
//   const affectedType = MARKET_EVENT_TYPES[Math.floor(Math.random() * MARKET_EVENT_TYPES.length)];
//   const sample = idx.tiles.find((t) => t.type === affectedType);
//   const volatility = sample?.volatility ?? 0.2;
//   const direction = Math.random() > 0.45 ? 1 : -1;
//   const impactPercent = Math.round(direction * volatility * (10 + Math.random() * 30));

//   const description = `${EVENT_LABEL[affectedType]} ${impactPercent >= 0 ? "surges" : "slides"} ${Math.abs(impactPercent)}%.`;

//   state.marketEvents.push({
//     id: id("event"),
//     triggeredAtTurn: state.turnNumber,
//     affectedAssetType: affectedType,
//     impactPercent,
//     description,
//   });
//   if (state.marketEvents.length > 20) state.marketEvents.shift();

//   for (const tile of idx.tiles) {
//     if (tile.type !== affectedType) continue;
//     const ts = state.tileMarket[tile.id];
//     if (!ts) continue;
//     ts.valueMultiplier = Math.max(MIN_VALUE_MULTIPLIER, ts.valueMultiplier * (1 + impactPercent / 100));
//   }

//   for (const pid of state.playerOrder) refreshNetWorth(state, pid);
//   log(state, currentPlayerId(state), "trigger_event", description);
// }

// function checkBankruptcy(state: GameState, playerId: string) {
//   const player = state.players[playerId];
//   if (player.status !== "active") return;
//   const assets = getPlayerAssets(state, playerId);
//   if (player.inGameBalance < 0 && assets.length === 0) {
//     player.status = "bankrupt";
//     log(state, playerId, "go_bankrupt", `${player.username} went bankrupt.`);
//   }
// }

// function checkWinCondition(state: GameState): void {
//   const active = state.playerOrder.filter((pid) => state.players[pid].status === "active");

//   if (state.settings.winCondition === "bankrupt_all" && active.length <= 1) {
//     state.status = "ended";
//     state.winnerId = active[0] ?? null;
//     state.endedReason = "All other players went bankrupt.";
//     return;
//   }

//   if (state.settings.winCondition === "net_worth_target" && state.settings.winTarget) {
//     const winner = active.find((pid) => state.players[pid].netWorth >= state.settings.winTarget!);
//     if (winner) {
//       state.status = "ended";
//       state.winnerId = winner;
//       state.endedReason = `Reached the $${state.settings.winTarget} net worth target.`;
//       return;
//     }
//   }

//   if (active.length === 0) {
//     state.status = "ended";
//     state.winnerId = null;
//     state.endedReason = "Every player went bankrupt.";
//   }
// }

// export function endByTimeout(prevState: GameState): GameState {
//   const state = clone(prevState);
//   const active = state.playerOrder.filter((pid) => state.players[pid].status === "active");
//   const winner = active.reduce<string | null>((best, pid) => {
//     if (!best) return pid;
//     return state.players[pid].netWorth > state.players[best].netWorth ? pid : best;
//   }, null);
//   state.status = "ended";
//   state.winnerId = winner;
//   state.endedReason = "Time ran out — highest net worth wins.";
//   return state;
// }

// /** Checks whether the given player has a contract expiring right now and queues a renew/release decision. */
// function checkContractExpiry(state: GameState, playerId: string): boolean {
//   for (const [tileId, ts] of Object.entries(state.tileMarket)) {
//     if (ts.ownerPlayerId !== playerId) continue;
//     if (ts.contractExpiresAtTurn === undefined) continue;
//     if (ts.contractExpiresAtTurn > state.turnNumber) continue;

//     const currentValue = tileCurrentValue(state, tileId);
//     state.pendingDecision = {
//       playerId,
//       tileId,
//       kind: "renew_or_release",
//       price: Math.round(currentValue * CONTRACT_RENEWAL_UPKEEP_PCT),
//     };
//     return true;
//   }
//   return false;
// }

// export function endTurn(prevState: GameState, playerId: string): GameState {
//   const state = clone(prevState);
//   if (currentPlayerId(state) !== playerId) return state;
//   if (state.pendingDecision || state.auction) return state;

//   checkBankruptcy(state, playerId);

//   const activeCount = state.playerOrder.filter((pid) => state.players[pid].status === "active").length;
//   if (activeCount > 0) {
//     let nextIndex = state.currentPlayerIndex;
//     do {
//       nextIndex = (nextIndex + 1) % state.playerOrder.length;
//     } while (state.players[state.playerOrder[nextIndex]].status !== "active");
//     state.currentPlayerIndex = nextIndex;
//     state.turnNumber += 1;
//   }

//   const nextPlayerId = currentPlayerId(state);
//   const nextPlayer = state.players[nextPlayerId];
//   nextPlayer.hasRolledThisTurn = false;
//   nextPlayer.doublesStreak = 0;

//   processLoanInstallments(state, nextPlayerId);
//   checkBankruptcy(state, nextPlayerId);

//   if (state.turnNumber % state.settings.marketEventEveryNTurns === 0) {
//     triggerMarketEvent(state);
//   }

//   checkContractExpiry(state, nextPlayerId);
//   checkWinCondition(state);
//   return state;
// }





import { boardIndex, ESTATE_VALUE_MULTIPLIER, GO_SALARY, jailPosition, PURCHASABLE_TYPES, SHARED_TYPES, SINGLE_OWNER_TYPES } from "./board";
import { CHANCE_DECK, COMMUNITY_DECK } from "./cards";
import type {
  AssetType,
  AuctionState,
  BetRecord,
  BetType,
  BoardTile,
  CardDeck,
  CardEffect,
  DiceRollRecord,
  GameLogEntry,
  GameState,
  Loan,
  OwnedAssetView,
  PlayerState,
  RoomSettings,
  TileMarketState,
  TradeOffer,
} from "./types";
import { BET_MULTIPLIERS, BET_WIN_PROBABILITY } from "./types";

const LOAN_INTEREST_RATE = 0.08;
const LOAN_INSTALLMENT_INTERVAL = 3;
const LOAN_INSTALLMENTS = 6;
const LOAN_CAP_PCT_OF_NET_WORTH = 0.75;
const CONTRACT_DURATION_TURNS = 15;
const CONTRACT_RENEWAL_UPKEEP_PCT = 0.15; // % of current value, paid to renew
const BET_RAKE_PERCENT = 0.05;
const MIN_VALUE_MULTIPLIER = 0.15;
const JAIL_BAIL = 50;
const MAX_JAIL_TURNS = 3;
const BUILD_COST_PCT_OF_BASE = 0.5; // cost per level = tile.basePrice * this
const RENT_MULTIPLIER = [1, 2, 3, 4, 5, 8]; // index = buildLevel (5 = hotel)
const MAX_BUILD_LEVEL = 5;
const MORTGAGE_VALUE_PCT = 0.5; // % of currentValue received when mortgaging
const UNMORTGAGE_PAYOFF_PCT = 1.1; // × the mortgage amount received, to pay off
const AUCTION_MIN_INCREMENT = 10;

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function clone<T>(v: T): T {
  return typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

function log(state: GameState, playerId: string, actionType: GameLogEntry["actionType"], message: string) {
  state.log.push({ turnNumber: state.turnNumber, playerId, actionType, message, timestamp: Date.now() });
  if (state.log.length > 250) state.log.shift();
}

function tiles(state: GameState) {
  return boardIndex(state.boardSize);
}

function tileById(state: GameState, tileId: string): BoardTile {
  return tiles(state).byId[tileId];
}

function marketState(state: GameState, tileId: string): TileMarketState {
  return state.tileMarket[tileId];
}

/** Current market value of a tile — single-owner types float off basePrice; shared types float off total invested. */
export function tileCurrentValue(state: GameState, tileId: string): number {
  const tile = tileById(state, tileId);
  const ts = marketState(state, tileId);
  if (SHARED_TYPES.has(tile.type as AssetType)) {
    const totalInvested = Object.values(ts.investors).reduce((s, v) => s + v, 0);
    return Math.round((totalInvested > 0 ? totalInvested : tile.basePrice) * ts.valueMultiplier);
  }
  return Math.round(tile.basePrice * ts.valueMultiplier);
}

export function createInitialGameState(
  roomId: string,
  settings: RoomSettings,
  players: { id: string; userId: string; username: string; pieceId: string }[]
): GameState {
  const idx = boardIndex(settings.boardSize);
  const playerStates: Record<string, PlayerState> = {};
  for (const p of players) {
    playerStates[p.id] = {
      id: p.id,
      userId: p.userId,
      username: p.username,
      pieceId: p.pieceId,
      inGameBalance: settings.startingCapital,
      position: 0,
      status: "active",
      loans: [],
      netWorth: settings.startingCapital,
      inJail: false,
      jailTurns: 0,
      getOutOfJailFreeCards: 0,
      hasRolledThisTurn: false,
      doublesStreak: 0,
    };
  }

  const tileMarket: Record<string, TileMarketState> = {};
  for (const tile of idx.tiles) {
    if (!PURCHASABLE_TYPES.has(tile.type)) continue;
    tileMarket[tile.id] = {
      tileId: tile.id,
      valueMultiplier: 1,
      ownerPlayerId: null,
      purchasePrice: null,
      investors: {},
      buildLevel: tile.type === "property" || tile.type === "estate" ? 0 : undefined,
    };
  }

  return {
    roomId,
    settings,
    status: "in_progress",
    boardVariant: settings.boardVariant,
    boardSize: idx.boardSize,
    turnNumber: 1,
    currentPlayerIndex: 0,
    playerOrder: players.map((p) => p.id),
    players: playerStates,
    tileMarket,
    marketEvents: [],
    cardDraws: [],
    bets: [],
    trades: [],
    auction: null,
    lastRoll: null,
    log: [],
    pendingDecision: null,
    winnerId: null,
    endedReason: null,
  };
}

export function rollDice(): [number, number] {
  return [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
}

export function currentPlayerId(state: GameState): string {
  return state.playerOrder[state.currentPlayerIndex];
}

/** Every tile a player holds a stake in, with live value / P&L — computed on demand, never stored. */
export function getPlayerAssets(state: GameState, playerId: string): OwnedAssetView[] {
  const idx = tiles(state);
  const views: OwnedAssetView[] = [];

  for (const tile of idx.tiles) {
    if (!PURCHASABLE_TYPES.has(tile.type)) continue;
    const ts = state.tileMarket[tile.id];
    const currentValue = tileCurrentValue(state, tile.id);

    if (SINGLE_OWNER_TYPES.has(tile.type as AssetType)) {
      if (ts.ownerPlayerId !== playerId) continue;
      views.push({
        tileId: tile.id,
        name: tile.name,
        type: tile.type as AssetType,
        isSingleOwner: true,
        amountInvested: ts.purchasePrice ?? 0,
        ownershipPercent: 100,
        currentShareValue: currentValue,
        profitLoss: currentValue - (ts.purchasePrice ?? 0),
        buildLevel: ts.buildLevel,
        contractExpiresAtTurn: ts.contractExpiresAtTurn,
        mortgaged: ts.mortgaged,
        forSalePrice: ts.forSalePrice,
      });
    } else {
      const invested = ts.investors[playerId] ?? 0;
      if (invested <= 0) continue;
      const totalInvested = Object.values(ts.investors).reduce((s, v) => s + v, 0);
      const ownershipPercent = totalInvested > 0 ? (invested / totalInvested) * 100 : 0;
      const shareValue = Math.round((ownershipPercent / 100) * currentValue);
      views.push({
        tileId: tile.id,
        name: tile.name,
        type: tile.type as AssetType,
        isSingleOwner: false,
        amountInvested: invested,
        ownershipPercent,
        currentShareValue: shareValue,
        profitLoss: shareValue - invested,
      });
    }
  }
  return views;
}

export function computeNetWorth(state: GameState, playerId: string): number {
  const player = state.players[playerId];
  const assetValue = getPlayerAssets(state, playerId).reduce((sum, a) => sum + a.currentShareValue, 0);
  const debt = player.loans
    .filter((l) => l.status === "active")
    .reduce((sum, l) => sum + l.installmentAmount * l.installmentsRemaining, 0);
  return player.inGameBalance + assetValue - debt;
}

function refreshNetWorth(state: GameState, playerId: string) {
  state.players[playerId].netWorth = computeNetWorth(state, playerId);
}

/** Moves a player forward by `steps` tiles, paying GO salary on wraparound, then resolves landing. */
function moveBySteps(state: GameState, player: PlayerState, steps: number) {
  const idx = tiles(state);
  const prevPosition = player.position;
  const nextPosition = (((prevPosition + steps) % idx.total) + idx.total) % idx.total;
  const passedGo = steps > 0 && prevPosition + steps >= idx.total;

  if (passedGo) {
    player.inGameBalance += GO_SALARY;
    log(state, player.id, "pass_go", `${player.username} passed GO and collected $${GO_SALARY}.`);
  }

  player.position = nextPosition;
  resolveLanding(state, player, idx.byPosition[nextPosition]);
}

/** Moves a player directly to an absolute board position (used by cards). */
function moveToPosition(state: GameState, player: PlayerState, position: number, collectGoIfPassed: boolean) {
  const idx = tiles(state);
  const target = ((position % idx.total) + idx.total) % idx.total;
  const passed = collectGoIfPassed && target < player.position;
  player.position = target;
  if (passed) {
    player.inGameBalance += GO_SALARY;
    log(state, player.id, "pass_go", `${player.username} passed GO and collected $${GO_SALARY}.`);
  }
  resolveLanding(state, player, idx.byPosition[target]);
}

function sendToJail(state: GameState, player: PlayerState) {
  player.position = jailPosition(state.boardSize);
  player.inJail = true;
  player.jailTurns = 0;
  player.doublesStreak = 0;
  log(state, player.id, "go_to_jail", `${player.username} was sent to Jail.`);
}

export function applyRoll(prevState: GameState, playerId: string): GameState {
  const state = clone(prevState);
  if (currentPlayerId(state) !== playerId) return state;
  if (state.pendingDecision || state.auction) return state;

  const player = state.players[playerId];
  if (player.inJail) return state; // must use jail actions instead
  if (player.hasRolledThisTurn) return state;

  const [d1, d2] = rollDice();
  const steps = d1 + d2;
  const isDoubles = d1 === d2;

  state.lastRoll = { id: id("roll"), playerId, d1, d2, isDoubles, turnNumber: state.turnNumber, timestamp: Date.now() };
  log(state, playerId, "roll", `${player.username} rolled ${d1} + ${d2} (${steps}).`);

  if (isDoubles) {
    player.doublesStreak += 1;
    if (player.doublesStreak >= 3) {
      sendToJail(state, player);
      player.hasRolledThisTurn = true;
      refreshNetWorth(state, playerId);
      return state;
    }
  } else {
    player.doublesStreak = 0;
  }

  moveBySteps(state, player, steps);

  // Doubles grant another roll (unless it just sent them to jail above);
  // a non-doubles roll locks further rolling until End Turn.
  player.hasRolledThisTurn = !isDoubles;

  refreshNetWorth(state, playerId);
  return state;
}

export function payBail(prevState: GameState, playerId: string): GameState {
  const state = clone(prevState);
  const player = state.players[playerId];
  if (currentPlayerId(state) !== playerId || !player.inJail) return state;
  if (player.inGameBalance < JAIL_BAIL) return state;

  player.inGameBalance -= JAIL_BAIL;
  player.inJail = false;
  player.jailTurns = 0;
  log(state, playerId, "pay_bail", `${player.username} paid $${JAIL_BAIL} bail and is out of Jail.`);
  refreshNetWorth(state, playerId);
  return state;
}

export function useJailCard(prevState: GameState, playerId: string): GameState {
  const state = clone(prevState);
  const player = state.players[playerId];
  if (currentPlayerId(state) !== playerId || !player.inJail) return state;
  if (player.getOutOfJailFreeCards <= 0) return state;

  player.getOutOfJailFreeCards -= 1;
  player.inJail = false;
  player.jailTurns = 0;
  log(state, playerId, "use_jail_card", `${player.username} used a Get Out of Jail Free card.`);
  refreshNetWorth(state, playerId);
  return state;
}

export function attemptJailRoll(prevState: GameState, playerId: string): GameState {
  const state = clone(prevState);
  const player = state.players[playerId];
  if (currentPlayerId(state) !== playerId || !player.inJail) return state;
  if (player.hasRolledThisTurn) return state;

  const [d1, d2] = rollDice();
  const isDoubles = d1 === d2;
  state.lastRoll = { id: id("roll"), playerId, d1, d2, isDoubles, turnNumber: state.turnNumber, timestamp: Date.now() };
  log(state, playerId, "jail_roll", `${player.username} rolled ${d1} + ${d2} trying to escape Jail.`);

  if (isDoubles) {
    player.inJail = false;
    player.jailTurns = 0;
    player.doublesStreak = 0;
    log(state, playerId, "jail_roll", `${player.username} rolled doubles and is out of Jail!`);
    moveBySteps(state, player, d1 + d2);
  } else {
    player.jailTurns += 1;
    if (player.jailTurns >= MAX_JAIL_TURNS) {
      player.inGameBalance -= JAIL_BAIL;
      player.inJail = false;
      player.jailTurns = 0;
      log(state, playerId, "pay_bail", `${player.username} paid bail after 3 failed attempts and is out of Jail.`);
      moveBySteps(state, player, d1 + d2);
    } else {
      log(state, playerId, "jail_roll", `${player.username} stays in Jail (${player.jailTurns}/${MAX_JAIL_TURNS} attempts).`);
    }
  }

  player.hasRolledThisTurn = true;
  refreshNetWorth(state, playerId);
  return state;
}

/** Whether `playerId` owns every tile in the same color group as `tile` — the classic Monopoly "own the whole set" rule for building. Ungrouped tiles (no colorGroup) have no such requirement. */
export function ownsWholeColorGroup(state: GameState, playerId: string, tile: BoardTile): boolean {
  if (!tile.colorGroup) return true;
  const groupTiles = tiles(state).tiles.filter((t) => t.colorGroup === tile.colorGroup);
  return groupTiles.length > 0 && groupTiles.every((t) => state.tileMarket[t.id]?.ownerPlayerId === playerId);
}

export interface ColorGroupStatus {
  colorGroup: string;
  groupColor: string;
  ownedByPlayer: number;
  total: number;
  ownsAll: boolean;
}

/** For the tile-info UI: how many of this tile's color group a given player owns, out of how many total. */
export function getColorGroupStatus(state: GameState, tileId: string, playerId: string | null): ColorGroupStatus | null {
  const tile = tileById(state, tileId);
  if (!tile?.colorGroup) return null;
  const groupTiles = tiles(state).tiles.filter((t) => t.colorGroup === tile.colorGroup);
  const ownedByPlayer = playerId ? groupTiles.filter((t) => state.tileMarket[t.id]?.ownerPlayerId === playerId).length : 0;
  return {
    colorGroup: tile.colorGroup,
    groupColor: tile.groupColor ?? "#8B5A2B",
    ownedByPlayer,
    total: groupTiles.length,
    ownsAll: groupTiles.length > 0 && ownedByPlayer === groupTiles.length,
  };
}

export function buildHouse(prevState: GameState, playerId: string, tileId: string): GameState {
  const state = clone(prevState);
  if (state.pendingDecision || state.auction) return state;
  const tile = tileById(state, tileId);
  const ts = state.tileMarket[tileId];
  const player = state.players[playerId];
  if (!tile || (tile.type !== "property" && tile.type !== "estate") || !ts || ts.ownerPlayerId !== playerId) return state;
  if (ts.mortgaged) return state;
  if (!ownsWholeColorGroup(state, playerId, tile)) return state; // must own the entire color group first, like real Monopoly

  const level = ts.buildLevel ?? 0;
  if (level >= MAX_BUILD_LEVEL) return state;

  const isEstate = tile.type === "estate";
  const cost = Math.round(tile.basePrice * BUILD_COST_PCT_OF_BASE * (level + 1) * (isEstate ? ESTATE_VALUE_MULTIPLIER : 1));
  if (player.inGameBalance < cost) return state;

  player.inGameBalance -= cost;
  ts.buildLevel = level + 1;
  const label = ts.buildLevel === MAX_BUILD_LEVEL ? "a hotel" : `house #${ts.buildLevel}`;
  log(
    state,
    playerId,
    "build",
    `${player.username} built ${label} on ${tile.name} for $${cost}${isEstate ? " (estate — 3x value)" : ""}.`
  );
  refreshNetWorth(state, playerId);
  return state;
}

function drawCard(state: GameState, player: PlayerState, deck: CardDeck) {
  const pool = deck === "chance" ? CHANCE_DECK : COMMUNITY_DECK;
  const card = pool[Math.floor(Math.random() * pool.length)];

  state.cardDraws.push({ id: id("card"), turnNumber: state.turnNumber, playerId: player.id, deck, text: card.text });
  if (state.cardDraws.length > 20) state.cardDraws.shift();
  log(state, player.id, "draw_card", `${player.username} drew: ${card.text}`);

  applyCardEffect(state, player, card.effect);
}

function applyCardEffect(state: GameState, player: PlayerState, effect: CardEffect) {
  switch (effect.kind) {
    case "collect":
      player.inGameBalance += effect.amount;
      break;
    case "pay":
      player.inGameBalance -= effect.amount;
      break;
    case "collect_from_each_player":
      for (const pid of state.playerOrder) {
        if (pid === player.id || state.players[pid].status !== "active") continue;
        state.players[pid].inGameBalance -= effect.amount;
        player.inGameBalance += effect.amount;
        refreshNetWorth(state, pid);
      }
      break;
    case "pay_each_player":
      for (const pid of state.playerOrder) {
        if (pid === player.id || state.players[pid].status !== "active") continue;
        player.inGameBalance -= effect.amount;
        state.players[pid].inGameBalance += effect.amount;
        refreshNetWorth(state, pid);
      }
      break;
    case "move_to_position":
      moveToPosition(state, player, effect.position, effect.collectGoIfPassed);
      return; // moveToPosition already resolves landing / refreshes downstream
    case "move_relative":
      moveBySteps(state, player, effect.steps);
      return;
    case "go_to_jail":
      sendToJail(state, player);
      break;
    case "get_out_of_jail_free":
      player.getOutOfJailFreeCards += 1;
      break;
    case "repairs": {
      const totalLevels = getPlayerAssets(state, player.id)
        .filter((a) => a.type === "property" || a.type === "estate")
        .reduce((sum, a) => sum + (a.buildLevel ?? 0), 0);
      player.inGameBalance -= totalLevels * effect.perLevel;
      break;
    }
  }
}

function resolveLanding(state: GameState, player: PlayerState, tile: BoardTile) {
  if (tile.type === "go" || tile.type === "jail" || tile.type === "exchange_floor") return;
  if (tile.type === "go_to_jail") {
    sendToJail(state, player);
    return;
  }
  if (tile.type === "chance" || tile.type === "community") {
    drawCard(state, player, tile.type);
    return;
  }
  if (!PURCHASABLE_TYPES.has(tile.type)) return;

  const ts = state.tileMarket[tile.id];
  const currentValue = tileCurrentValue(state, tile.id);

  if (tile.type === "property" || tile.type === "estate" || tile.type === "bond") {
    if (!ts.ownerPlayerId) {
      state.pendingDecision = { playerId: player.id, tileId: tile.id, kind: "buy_or_skip", price: currentValue };
    } else if (ts.ownerPlayerId === player.id) {
      log(state, player.id, "roll", `${player.username} landed on their own ${tile.name}.`);
    } else if (ts.mortgaged) {
      log(state, player.id, "roll", `${player.username} landed on ${tile.name} — it's mortgaged, no rent due.`);
    } else {
      const level = tile.type === "property" || tile.type === "estate" ? ts.buildLevel ?? 0 : 0;
      const estateMultiplier = tile.type === "estate" ? ESTATE_VALUE_MULTIPLIER : 1;
      const rent = Math.round(currentValue * tile.rentPercent * RENT_MULTIPLIER[level] * estateMultiplier);
      const owner = state.players[ts.ownerPlayerId];
      player.inGameBalance -= rent;
      owner.inGameBalance += rent;
      log(state, player.id, "pay_rent", `${player.username} paid $${rent} rent on ${tile.name} to ${owner.username}.`);
      refreshNetWorth(state, owner.id);
    }
    return;
  }

  if (tile.type === "contract") {
    if (!ts.ownerPlayerId) {
      state.pendingDecision = { playerId: player.id, tileId: tile.id, kind: "buy_or_skip", price: currentValue };
    } else if (ts.ownerPlayerId === player.id) {
      log(state, player.id, "roll", `${player.username} landed on their own ${tile.name}.`);
    } else {
      state.pendingDecision = {
        playerId: player.id,
        tileId: tile.id,
        kind: "outbid_or_skip",
        price: currentValue,
        currentOwnerPlayerId: ts.ownerPlayerId,
      };
    }
    return;
  }

  if (tile.type === "betting") {
    if (!ts.ownerPlayerId) {
      state.pendingDecision = { playerId: player.id, tileId: tile.id, kind: "buy_or_skip", price: currentValue };
    } else if (ts.ownerPlayerId === player.id) {
      log(state, player.id, "roll", `${player.username} landed on their own ${tile.name}.`);
    } else {
      state.pendingDecision = {
        playerId: player.id,
        tileId: tile.id,
        kind: "bet_or_fee",
        price: 0,
        currentOwnerPlayerId: ts.ownerPlayerId,
        landingFee: Math.round(currentValue * tile.landingFeePercent),
      };
    }
    return;
  }

  // Shared: tech_company, crypto, startup
  const invested = ts.investors[player.id] ?? 0;
  if (invested > 0) {
    payLandingFeeShared(state, tile, player.id, currentValue);
  } else {
    state.pendingDecision = {
      playerId: player.id,
      tileId: tile.id,
      kind: "invest_or_fee",
      price: currentValue,
      landingFee: Math.round(currentValue * tile.landingFeePercent),
    };
  }
}

function payLandingFeeShared(state: GameState, tile: BoardTile, payerId: string, currentValue: number) {
  const ts = state.tileMarket[tile.id];
  const player = state.players[payerId];
  const fee = Math.round(currentValue * tile.landingFeePercent);
  const others = Object.entries(ts.investors).filter(([pid]) => pid !== payerId);
  const othersTotal = others.reduce((s, [, v]) => s + v, 0);

  player.inGameBalance -= fee;
  if (othersTotal > 0) {
    for (const [pid, amount] of others) {
      const share = Math.round(fee * (amount / othersTotal));
      state.players[pid].inGameBalance += share;
      refreshNetWorth(state, pid);
    }
    log(state, payerId, "pay_landing_fee", `${player.username} paid a $${fee} landing fee on ${tile.name} to existing investors.`);
  } else {
    log(state, payerId, "pay_landing_fee", `${player.username} paid a $${fee} landing fee on ${tile.name}.`);
  }
}

export function resolveBuy(prevState: GameState, playerId: string, accept: boolean): GameState {
  const state = clone(prevState);
  const decision = state.pendingDecision;
  if (!decision || decision.playerId !== playerId || decision.kind !== "buy_or_skip") return state;

  const player = state.players[playerId];
  const tile = tileById(state, decision.tileId);
  const ts = state.tileMarket[tile.id];

  if (accept && player.inGameBalance >= decision.price) {
    player.inGameBalance -= decision.price;
    ts.ownerPlayerId = playerId;
    ts.purchasePrice = decision.price;
    if (tile.type === "contract") ts.contractExpiresAtTurn = state.turnNumber + CONTRACT_DURATION_TURNS;
    log(state, playerId, "buy", `${player.username} bought ${tile.name} for $${decision.price}.`);
    state.pendingDecision = null;
    refreshNetWorth(state, playerId);
    return state;
  }

  log(state, playerId, "skip", `${player.username} passed on ${tile.name} — it goes to auction.`);
  state.pendingDecision = null;
  startAuction(state, tile.id);
  return state;
}

function startAuction(state: GameState, tileId: string) {
  const active = state.playerOrder.filter((pid) => state.players[pid].status === "active");
  if (active.length === 0) return;
  const startIdx = state.currentPlayerIndex % active.length;
  state.auction = {
    tileId,
    highestBid: 0,
    highestBidderId: null,
    currentTurnPlayerId: active[startIdx],
    activePlayerIds: active,
    minIncrement: AUCTION_MIN_INCREMENT,
  };
  log(state, active[startIdx], "auction_start", `Auction started for ${tileById(state, tileId).name}.`);
}

function advanceAuctionTurn(state: GameState) {
  const auction = state.auction;
  if (!auction) return;
  const remaining = auction.activePlayerIds;
  if (remaining.length <= 1) return;
  const idx = remaining.indexOf(auction.currentTurnPlayerId);
  auction.currentTurnPlayerId = remaining[(idx + 1) % remaining.length];
}

function resolveAuctionIfDone(state: GameState) {
  const auction = state.auction;
  if (!auction) return;
  if (auction.activePlayerIds.length > 1) return;

  const tile = tileById(state, auction.tileId);
  const ts = state.tileMarket[auction.tileId];
  const winnerId = auction.activePlayerIds[0] ?? auction.highestBidderId;

  if (winnerId && auction.highestBid > 0 && auction.highestBidderId === winnerId) {
    const winner = state.players[winnerId];
    winner.inGameBalance -= auction.highestBid;
    ts.ownerPlayerId = winnerId;
    ts.purchasePrice = auction.highestBid;
    if (tile.type === "contract") ts.contractExpiresAtTurn = state.turnNumber + CONTRACT_DURATION_TURNS;
    log(state, winnerId, "auction_won", `${winner.username} won the auction for ${tile.name} at $${auction.highestBid}.`);
    refreshNetWorth(state, winnerId);
  } else {
    log(state, winnerId ?? currentPlayerId(state), "auction_unsold", `No bids — ${tile.name} stays unowned.`);
  }

  state.auction = null;
}

export function auctionBid(prevState: GameState, playerId: string, amount: number): GameState {
  const state = clone(prevState);
  const auction = state.auction;
  if (!auction || auction.currentTurnPlayerId !== playerId) return state;
  if (!auction.activePlayerIds.includes(playerId)) return state;

  const player = state.players[playerId];
  const minBid = auction.highestBid + auction.minIncrement;
  if (amount < minBid || player.inGameBalance < amount) return state;

  auction.highestBid = amount;
  auction.highestBidderId = playerId;
  log(state, playerId, "auction_bid", `${player.username} bid $${amount} on ${tileById(state, auction.tileId).name}.`);
  advanceAuctionTurn(state);
  resolveAuctionIfDone(state);
  return state;
}

export function auctionPass(prevState: GameState, playerId: string): GameState {
  const state = clone(prevState);
  const auction = state.auction;
  if (!auction || auction.currentTurnPlayerId !== playerId) return state;

  const priorOrder = auction.activePlayerIds;
  const passedIdx = priorOrder.indexOf(playerId);
  auction.activePlayerIds = priorOrder.filter((pid) => pid !== playerId);
  log(state, playerId, "auction_pass", `${state.players[playerId].username} passed on the auction.`);

  if (auction.activePlayerIds.length > 0) {
    // Continue the round from wherever the passed player was, rather than
    // resetting to the first active player (which would unfairly skip others).
    let nextIdx = passedIdx % priorOrder.length;
    while (!auction.activePlayerIds.includes(priorOrder[nextIdx])) {
      nextIdx = (nextIdx + 1) % priorOrder.length;
    }
    auction.currentTurnPlayerId = priorOrder[nextIdx];
  }
  resolveAuctionIfDone(state);
  return state;
}

export function mortgageTile(prevState: GameState, playerId: string, tileId: string): GameState {
  const state = clone(prevState);
  if (state.pendingDecision || state.auction) return state;
  const tile = tileById(state, tileId);
  const ts = state.tileMarket[tileId];
  const player = state.players[playerId];
  if (!tile || !ts || ts.ownerPlayerId !== playerId || ts.mortgaged) return state;
  if (tile.type === "contract") return state; // contracts have their own expiry/renewal lifecycle
  if ((ts.buildLevel ?? 0) > 0) return state; // must sell buildings back down first (not modeled — block instead)

  const currentValue = tileCurrentValue(state, tileId);
  const amount = Math.round(currentValue * MORTGAGE_VALUE_PCT);
  ts.mortgaged = true;
  ts.mortgageAmount = amount;
  player.inGameBalance += amount;
  log(state, playerId, "mortgage", `${player.username} mortgaged ${tile.name} for $${amount}.`);
  refreshNetWorth(state, playerId);
  return state;
}

export function unmortgageTile(prevState: GameState, playerId: string, tileId: string): GameState {
  const state = clone(prevState);
  const tile = tileById(state, tileId);
  const ts = state.tileMarket[tileId];
  const player = state.players[playerId];
  if (!tile || !ts || ts.ownerPlayerId !== playerId || !ts.mortgaged) return state;

  const payoff = Math.round((ts.mortgageAmount ?? 0) * UNMORTGAGE_PAYOFF_PCT);
  if (player.inGameBalance < payoff) return state;

  player.inGameBalance -= payoff;
  ts.mortgaged = false;
  ts.mortgageAmount = undefined;
  log(state, playerId, "unmortgage", `${player.username} paid $${payoff} to unmortgage ${tile.name}.`);
  refreshNetWorth(state, playerId);
  return state;
}

export function listForSale(prevState: GameState, playerId: string, tileId: string, askPrice: number): GameState {
  const state = clone(prevState);
  const ts = state.tileMarket[tileId];
  if (!ts || ts.ownerPlayerId !== playerId || askPrice <= 0) return state;
  ts.forSalePrice = askPrice;
  log(state, playerId, "list_for_sale", `${state.players[playerId].username} listed ${tileById(state, tileId).name} for $${askPrice}.`);
  return state;
}

export function cancelListing(prevState: GameState, playerId: string, tileId: string): GameState {
  const state = clone(prevState);
  const ts = state.tileMarket[tileId];
  if (!ts || ts.ownerPlayerId !== playerId) return state;
  ts.forSalePrice = null;
  log(state, playerId, "cancel_listing", `${state.players[playerId].username} cancelled the listing on ${tileById(state, tileId).name}.`);
  return state;
}

export function buyListed(prevState: GameState, buyerId: string, tileId: string): GameState {
  const state = clone(prevState);
  const tile = tileById(state, tileId);
  const ts = state.tileMarket[tileId];
  const buyer = state.players[buyerId];
  if (!ts || !ts.forSalePrice || ts.ownerPlayerId === buyerId) return state;
  if (buyer.inGameBalance < ts.forSalePrice) return state;

  const sellerId = ts.ownerPlayerId!;
  const seller = state.players[sellerId];
  const price = ts.forSalePrice;

  buyer.inGameBalance -= price;
  seller.inGameBalance += price;
  ts.ownerPlayerId = buyerId;
  ts.purchasePrice = price;
  ts.forSalePrice = null;
  log(state, buyerId, "buy_listed", `${buyer.username} bought ${tile.name} from ${seller.username} for $${price}.`);
  refreshNetWorth(state, sellerId);
  refreshNetWorth(state, buyerId);
  return state;
}

export function proposeTrade(
  prevState: GameState,
  fromPlayerId: string,
  toPlayerId: string,
  offerCash: number,
  offerTileIds: string[],
  requestCash: number,
  requestTileIds: string[]
): GameState {
  const state = clone(prevState);
  if (!state.players[toPlayerId] || fromPlayerId === toPlayerId) return state;

  const trade: TradeOffer = {
    id: id("trade"),
    fromPlayerId,
    toPlayerId,
    offerCash: Math.max(0, offerCash),
    offerTileIds,
    requestCash: Math.max(0, requestCash),
    requestTileIds,
    status: "pending",
    createdAtTurn: state.turnNumber,
  };
  state.trades.push(trade);
  if (state.trades.length > 30) state.trades.shift();
  log(
    state,
    fromPlayerId,
    "propose_trade",
    `${state.players[fromPlayerId].username} proposed a trade to ${state.players[toPlayerId].username}.`
  );
  return state;
}

export function respondTrade(prevState: GameState, playerId: string, tradeId: string, accept: boolean): GameState {
  const state = clone(prevState);
  const trade = state.trades.find((t) => t.id === tradeId);
  if (!trade || trade.status !== "pending" || trade.toPlayerId !== playerId) return state;

  if (!accept) {
    trade.status = "declined";
    log(state, playerId, "decline_trade", `${state.players[playerId].username} declined a trade.`);
    return state;
  }

  const from = state.players[trade.fromPlayerId];
  const to = state.players[trade.toPlayerId];

  const offerValid = trade.offerTileIds.every((tid) => state.tileMarket[tid]?.ownerPlayerId === trade.fromPlayerId);
  const requestValid = trade.requestTileIds.every((tid) => state.tileMarket[tid]?.ownerPlayerId === trade.toPlayerId);
  if (!offerValid || !requestValid || from.inGameBalance < trade.offerCash || to.inGameBalance < trade.requestCash) {
    trade.status = "declined";
    log(state, playerId, "decline_trade", `Trade between ${from.username} and ${to.username} fell through — terms no longer valid.`);
    return state;
  }

  from.inGameBalance -= trade.offerCash;
  to.inGameBalance += trade.offerCash;
  to.inGameBalance -= trade.requestCash;
  from.inGameBalance += trade.requestCash;

  for (const tid of trade.offerTileIds) state.tileMarket[tid].ownerPlayerId = trade.toPlayerId;
  for (const tid of trade.requestTileIds) state.tileMarket[tid].ownerPlayerId = trade.fromPlayerId;

  trade.status = "accepted";
  log(state, playerId, "accept_trade", `${from.username} and ${to.username} completed a trade.`);
  refreshNetWorth(state, trade.fromPlayerId);
  refreshNetWorth(state, trade.toPlayerId);
  return state;
}

export function resolveOutbid(prevState: GameState, playerId: string, accept: boolean): GameState {
  const state = clone(prevState);
  const decision = state.pendingDecision;
  if (!decision || decision.playerId !== playerId || decision.kind !== "outbid_or_skip") return state;

  const tile = tileById(state, decision.tileId);
  const ts = state.tileMarket[tile.id];
  const player = state.players[playerId];
  const ownerId = decision.currentOwnerPlayerId!;
  const owner = state.players[ownerId];

  if (accept && player.inGameBalance >= decision.price) {
    const refund = ts.purchasePrice ?? 0;
    owner.inGameBalance += refund;
    player.inGameBalance -= decision.price;
    ts.ownerPlayerId = playerId;
    ts.purchasePrice = decision.price;
    ts.contractExpiresAtTurn = state.turnNumber + CONTRACT_DURATION_TURNS;
    log(
      state,
      playerId,
      "outbid_contract",
      `${player.username} bought out ${owner.username}'s ${tile.name} for $${decision.price} (${owner.username} refunded $${refund}).`
    );
    refreshNetWorth(state, ownerId);
  } else {
    log(state, playerId, "skip", `${player.username} let ${owner.username} keep ${tile.name}.`);
  }

  state.pendingDecision = null;
  refreshNetWorth(state, playerId);
  return state;
}

export function resolveInvestOrFee(prevState: GameState, playerId: string, invest: boolean): GameState {
  const state = clone(prevState);
  const decision = state.pendingDecision;
  if (!decision || decision.playerId !== playerId || decision.kind !== "invest_or_fee") return state;

  const tile = tileById(state, decision.tileId);
  const ts = state.tileMarket[tile.id];
  const player = state.players[playerId];

  if (invest && player.inGameBalance >= decision.price) {
    ts.investors[playerId] = (ts.investors[playerId] ?? 0) + decision.price;
    player.inGameBalance -= decision.price;
    log(state, playerId, "invest", `${player.username} invested $${decision.price} in ${tile.name}.`);
  } else {
    payLandingFeeShared(state, tile, playerId, decision.price);
  }

  state.pendingDecision = null;
  refreshNetWorth(state, playerId);
  return state;
}

export function resolveBetOrFee(
  prevState: GameState,
  playerId: string,
  choice: "bet" | "fee",
  betType?: BetType,
  stakeAmount?: number
): GameState {
  const state = clone(prevState);
  const decision = state.pendingDecision;
  if (!decision || decision.playerId !== playerId || decision.kind !== "bet_or_fee") return state;

  const tile = tileById(state, decision.tileId);
  const player = state.players[playerId];
  const ownerId = decision.currentOwnerPlayerId!;
  const owner = state.players[ownerId];

  if (choice === "fee") {
    const fee = decision.landingFee ?? 0;
    player.inGameBalance -= fee;
    owner.inGameBalance += fee;
    log(state, playerId, "pay_landing_fee", `${player.username} paid a $${fee} landing fee at ${tile.name}.`);
  } else if (betType && stakeAmount && stakeAmount > 0 && player.inGameBalance >= stakeAmount) {
    const multiplier = BET_MULTIPLIERS[betType];
    const rake = Math.round(stakeAmount * BET_RAKE_PERCENT);
    player.inGameBalance -= rake;
    owner.inGameBalance += rake;

    const won = Math.random() < BET_WIN_PROBABILITY[betType];
    let payoutAmount = 0;

    if (won) {
      payoutAmount = stakeAmount * multiplier;
      owner.inGameBalance -= payoutAmount;
      player.inGameBalance += payoutAmount;
      if (owner.inGameBalance < 0) {
        const shortfall = -owner.inGameBalance;
        owner.inGameBalance = 0;
        owner.loans.push(forcedLoan(state, shortfall));
        log(state, ownerId, "take_loan", `${owner.username} couldn't cover a payout and took an emergency loan of $${shortfall}.`);
      }
      log(state, playerId, "bet", `${player.username} won a ${betType} bet at ${tile.name} — $${payoutAmount} from ${owner.username}.`);
    } else {
      owner.inGameBalance += stakeAmount;
      player.inGameBalance -= stakeAmount;
      log(state, playerId, "bet", `${player.username} lost a ${betType} bet at ${tile.name} — $${stakeAmount} to ${owner.username}.`);
    }

    const bet: BetRecord = {
      id: id("bet"),
      tileId: tile.id,
      bettorPlayerId: playerId,
      ownerPlayerId: ownerId,
      betType,
      betAmount: stakeAmount,
      multiplier,
      result: won ? "win" : "lose",
      payoutAmount,
      rakeAmount: rake,
      turnNumber: state.turnNumber,
    };
    state.bets.push(bet);
    if (state.bets.length > 50) state.bets.shift();
    refreshNetWorth(state, ownerId);
  }

  state.pendingDecision = null;
  refreshNetWorth(state, playerId);
  return state;
}

export function resolveRenewOrRelease(prevState: GameState, playerId: string, renew: boolean): GameState {
  const state = clone(prevState);
  const decision = state.pendingDecision;
  if (!decision || decision.playerId !== playerId || decision.kind !== "renew_or_release") return state;

  const tile = tileById(state, decision.tileId);
  const ts = state.tileMarket[tile.id];
  const player = state.players[playerId];

  if (renew && player.inGameBalance >= decision.price) {
    player.inGameBalance -= decision.price;
    ts.contractExpiresAtTurn = state.turnNumber + CONTRACT_DURATION_TURNS;
    log(state, playerId, "renew_contract", `${player.username} renewed ${tile.name} for $${decision.price}.`);
  } else {
    ts.ownerPlayerId = null;
    ts.purchasePrice = null;
    ts.contractExpiresAtTurn = undefined;
    log(state, playerId, "release_contract", `${player.username} let ${tile.name} expire — it's back on the market.`);
  }

  state.pendingDecision = null;
  refreshNetWorth(state, playerId);
  return state;
}

function forcedLoan(state: GameState, principal: number): Loan {
  return {
    id: id("loan"),
    principal,
    interestRate: LOAN_INTEREST_RATE,
    installmentAmount: Math.ceil((principal * (1 + LOAN_INTEREST_RATE)) / LOAN_INSTALLMENTS),
    installmentIntervalTurns: LOAN_INSTALLMENT_INTERVAL,
    installmentsRemaining: LOAN_INSTALLMENTS,
    missedPayments: 0,
    status: "active",
    createdAtTurn: state.turnNumber,
  };
}

export function takeLoan(prevState: GameState, playerId: string, principal: number): GameState {
  const state = clone(prevState);
  const player = state.players[playerId];
  if (state.pendingDecision) return state;
  if (principal <= 0) return state;

  const cap = Math.max(0, computeNetWorth(state, playerId) * LOAN_CAP_PCT_OF_NET_WORTH);
  const amount = Math.min(principal, cap);
  if (amount <= 0) {
    log(state, playerId, "take_loan", `${player.username} was denied a loan — insufficient net worth.`);
    return state;
  }

  const loan = forcedLoan(state, amount);
  player.loans.push(loan);
  player.inGameBalance += amount;
  log(state, playerId, "take_loan", `${player.username} borrowed $${amount} from the Bank/Exchange.`);
  refreshNetWorth(state, playerId);
  return state;
}

/** Passive income a player earns per turn: contract/bond fixed income + tech dividends. */
function passiveIncome(state: GameState, playerId: string): number {
  const idx = tiles(state);
  let total = 0;
  for (const tile of idx.tiles) {
    if (tile.type !== "contract" && tile.type !== "bond" && tile.type !== "tech_company") continue;
    const ts = state.tileMarket[tile.id];
    if (!ts) continue;
    if (SINGLE_OWNER_TYPES.has(tile.type as AssetType)) {
      if (ts.ownerPlayerId === playerId) total += tile.baseIncomeRate;
    } else {
      const invested = ts.investors[playerId] ?? 0;
      if (invested > 0) total += tile.baseIncomeRate; // tech dividend, precomputed as $/round in board config
    }
  }
  return Math.round(total);
}

function liquidateLowestValueAsset(state: GameState, playerId: string): boolean {
  const assets = getPlayerAssets(state, playerId);
  if (assets.length === 0) return false;
  const lowest = assets.reduce((min, a) => (a.currentShareValue < min.currentShareValue ? a : min), assets[0]);
  const ts = state.tileMarket[lowest.tileId];
  const player = state.players[playerId];
  const recovered = Math.round(lowest.currentShareValue * 0.5);

  if (lowest.isSingleOwner) {
    ts.ownerPlayerId = null;
    ts.purchasePrice = null;
    ts.contractExpiresAtTurn = undefined;
    ts.mortgaged = false;
    ts.mortgageAmount = undefined;
    ts.forSalePrice = null;
    ts.buildLevel = tileById(state, lowest.tileId).type === "property" || tileById(state, lowest.tileId).type === "estate" ? 0 : ts.buildLevel;
  } else {
    delete ts.investors[playerId];
  }
  player.inGameBalance += recovered;
  log(state, playerId, "loan_missed", `${player.username}'s ${lowest.name} was force-liquidated for $${recovered} to cover a missed payment.`);
  return true;
}

function processLoanInstallments(state: GameState, playerId: string) {
  const player = state.players[playerId];
  const income = passiveIncome(state, playerId);
  let incomeRemaining = income;
  if (income > 0) player.inGameBalance += income;

  for (const loan of player.loans) {
    if (loan.status !== "active") continue;
    const turnsSinceStart = state.turnNumber - loan.createdAtTurn;
    const isDue = turnsSinceStart > 0 && turnsSinceStart % loan.installmentIntervalTurns === 0;
    if (!isDue) continue;

    const fromIncome = Math.min(incomeRemaining, loan.installmentAmount);
    const remainder = loan.installmentAmount - fromIncome;
    incomeRemaining -= fromIncome;

    if (player.inGameBalance >= remainder) {
      player.inGameBalance -= remainder;
      loan.installmentsRemaining -= 1;
      log(state, playerId, "loan_installment", `${player.username} paid a $${loan.installmentAmount} loan installment (${loan.installmentsRemaining} remaining).`);
      if (loan.installmentsRemaining <= 0) {
        loan.status = "paid_off";
        log(state, playerId, "loan_installment", `${player.username} paid off a loan in full.`);
      }
    } else {
      loan.missedPayments += 1;
      if (loan.missedPayments === 1) {
        loan.interestRate += 0.05;
        loan.installmentAmount = Math.ceil(loan.installmentAmount * 1.1);
        log(state, playerId, "loan_missed", `${player.username} missed a payment — penalty interest applied.`);
      } else if (loan.missedPayments === 2) {
        if (!liquidateLowestValueAsset(state, playerId)) {
          loan.status = "defaulted";
          log(state, playerId, "loan_defaulted", `${player.username} defaulted — no assets left to seize.`);
        }
      } else {
        loan.status = "defaulted";
        log(state, playerId, "loan_defaulted", `${player.username} defaulted on a loan — remaining assets seized by the Bank/Exchange.`);
        for (const asset of getPlayerAssets(state, playerId)) {
          const ts = state.tileMarket[asset.tileId];
          if (asset.isSingleOwner) {
            ts.ownerPlayerId = null;
            ts.purchasePrice = null;
            ts.contractExpiresAtTurn = undefined;
            ts.mortgaged = false;
            ts.mortgageAmount = undefined;
            ts.forSalePrice = null;
          } else {
            delete ts.investors[playerId];
          }
        }
      }
    }
  }

  refreshNetWorth(state, playerId);
}

const MARKET_EVENT_TYPES: AssetType[] = ["property", "estate", "bond", "contract", "betting", "tech_company", "crypto", "startup"];

const EVENT_LABEL: Record<AssetType, string> = {
  property: "Property market",
  estate: "Luxury estate market",
  bond: "Bond market",
  contract: "Contract sector",
  betting: "Betting houses",
  tech_company: "Tech sector",
  crypto: "Crypto market",
  startup: "Startup sector",
};

export function triggerMarketEvent(state: GameState): void {
  const idx = tiles(state);
  const affectedType = MARKET_EVENT_TYPES[Math.floor(Math.random() * MARKET_EVENT_TYPES.length)];
  const sample = idx.tiles.find((t) => t.type === affectedType);
  const volatility = sample?.volatility ?? 0.2;
  const direction = Math.random() > 0.45 ? 1 : -1;
  const impactPercent = Math.round(direction * volatility * (10 + Math.random() * 30));

  const description = `${EVENT_LABEL[affectedType]} ${impactPercent >= 0 ? "surges" : "slides"} ${Math.abs(impactPercent)}%.`;

  state.marketEvents.push({
    id: id("event"),
    triggeredAtTurn: state.turnNumber,
    affectedAssetType: affectedType,
    impactPercent,
    description,
  });
  if (state.marketEvents.length > 20) state.marketEvents.shift();

  for (const tile of idx.tiles) {
    if (tile.type !== affectedType) continue;
    const ts = state.tileMarket[tile.id];
    if (!ts) continue;
    ts.valueMultiplier = Math.max(MIN_VALUE_MULTIPLIER, ts.valueMultiplier * (1 + impactPercent / 100));
  }

  for (const pid of state.playerOrder) refreshNetWorth(state, pid);
  log(state, currentPlayerId(state), "trigger_event", description);
}

function checkBankruptcy(state: GameState, playerId: string) {
  const player = state.players[playerId];
  if (player.status !== "active") return;
  const assets = getPlayerAssets(state, playerId);
  if (player.inGameBalance < 0 && assets.length === 0) {
    player.status = "bankrupt";
    log(state, playerId, "go_bankrupt", `${player.username} went bankrupt.`);
  }
}

function checkWinCondition(state: GameState): void {
  const active = state.playerOrder.filter((pid) => state.players[pid].status === "active");

  if (state.settings.winCondition === "bankrupt_all" && active.length <= 1) {
    state.status = "ended";
    state.winnerId = active[0] ?? null;
    state.endedReason = "All other players went bankrupt.";
    return;
  }

  if (state.settings.winCondition === "net_worth_target" && state.settings.winTarget) {
    const winner = active.find((pid) => state.players[pid].netWorth >= state.settings.winTarget!);
    if (winner) {
      state.status = "ended";
      state.winnerId = winner;
      state.endedReason = `Reached the $${state.settings.winTarget} net worth target.`;
      return;
    }
  }

  if (active.length === 0) {
    state.status = "ended";
    state.winnerId = null;
    state.endedReason = "Every player went bankrupt.";
  }
}

/**
 * Re-checks win conditions against the current state and ends the game if
 * met — safe to call after ANY action, not just endTurn. Without this, a
 * player could hit bankruptcy or a net-worth target via a bet, trade, or
 * auction loss and the game wouldn't recognize it until someone's turn
 * happened to end. No-ops if the game already ended.
 */
export function refreshWinCondition(prevState: GameState): GameState {
  if (prevState.status !== "in_progress") return prevState;
  const state = clone(prevState);
  for (const pid of state.playerOrder) checkBankruptcy(state, pid);
  checkWinCondition(state);
  return state;
}

export function endByTimeout(prevState: GameState): GameState {
  const state = clone(prevState);
  const active = state.playerOrder.filter((pid) => state.players[pid].status === "active");
  const winner = active.reduce<string | null>((best, pid) => {
    if (!best) return pid;
    return state.players[pid].netWorth > state.players[best].netWorth ? pid : best;
  }, null);
  state.status = "ended";
  state.winnerId = winner;
  state.endedReason = "Time ran out — highest net worth wins.";
  return state;
}

/** The host manually ending the game early — highest net worth among active players wins, same tiebreak as a timeout. */
export function endByHost(prevState: GameState): GameState {
  const state = clone(prevState);
  if (state.status !== "in_progress") return state;
  const active = state.playerOrder.filter((pid) => state.players[pid].status === "active");
  const winner = active.reduce<string | null>((best, pid) => {
    if (!best) return pid;
    return state.players[pid].netWorth > state.players[best].netWorth ? pid : best;
  }, null);
  state.status = "ended";
  state.winnerId = winner;
  state.endedReason = "The host ended the game.";
  return state;
}

/** Checks whether the given player has a contract expiring right now and queues a renew/release decision. */
function checkContractExpiry(state: GameState, playerId: string): boolean {
  for (const [tileId, ts] of Object.entries(state.tileMarket)) {
    if (ts.ownerPlayerId !== playerId) continue;
    if (ts.contractExpiresAtTurn === undefined) continue;
    if (ts.contractExpiresAtTurn > state.turnNumber) continue;

    const currentValue = tileCurrentValue(state, tileId);
    state.pendingDecision = {
      playerId,
      tileId,
      kind: "renew_or_release",
      price: Math.round(currentValue * CONTRACT_RENEWAL_UPKEEP_PCT),
    };
    return true;
  }
  return false;
}

export function endTurn(prevState: GameState, playerId: string): GameState {
  const state = clone(prevState);
  if (currentPlayerId(state) !== playerId) return state;
  if (state.pendingDecision || state.auction) return state;

  checkBankruptcy(state, playerId);

  const activeCount = state.playerOrder.filter((pid) => state.players[pid].status === "active").length;
  if (activeCount > 0) {
    let nextIndex = state.currentPlayerIndex;
    do {
      nextIndex = (nextIndex + 1) % state.playerOrder.length;
    } while (state.players[state.playerOrder[nextIndex]].status !== "active");
    state.currentPlayerIndex = nextIndex;
    state.turnNumber += 1;
  }

  const nextPlayerId = currentPlayerId(state);
  const nextPlayer = state.players[nextPlayerId];
  nextPlayer.hasRolledThisTurn = false;
  nextPlayer.doublesStreak = 0;

  processLoanInstallments(state, nextPlayerId);
  checkBankruptcy(state, nextPlayerId);

  if (state.turnNumber % state.settings.marketEventEveryNTurns === 0) {
    triggerMarketEvent(state);
  }

  checkContractExpiry(state, nextPlayerId);
  checkWinCondition(state);
  return state;
}