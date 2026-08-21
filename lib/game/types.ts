export type AssetType =
  | "property"
  | "estate"
  | "contract"
  | "betting"
  | "tech_company"
  | "bond"
  | "crypto"
  | "startup";


export type SharedOwnershipType = "tech_company" | "crypto" | "startup";
export type SingleOwnerType = "property" | "contract" | "bond" | "betting";

export type TileType = AssetType | "go" | "jail" | "go_to_jail" | "exchange_floor" | "chance" | "community";

export interface BoardTile {
  id: string;
  position: number;
  type: TileType;
  name: string;
  basePrice: number; // 0 for non-purchasable tiles
  volatility: number; // 0–1, drives market event impact
  baseIncomeRate: number; // passive payout per round (contract/bond/tech dividends)
  landingFeePercent: number; // % of currentValue charged when a player doesn't buy/invest/bet
  rentPercent: number; // property-only: rent = currentValue * rentPercent
}

export type PlayerStatus = "active" | "bankrupt" | "disconnected";
export type LoanStatus = "active" | "paid_off" | "defaulted";
export type RoomStatus = "waiting" | "in_progress" | "ended";
export type WinCondition = "bankrupt_all" | "net_worth_target" | "timed";
export type BetType = "color" | "range" | "number";

export const BET_MULTIPLIERS: Record<BetType, number> = {
  color: 2,
  range: 3,
  number: 35,
};

// Rough odds used server-side to resolve a spin — lower odds, higher multiplier.
export const BET_WIN_PROBABILITY: Record<BetType, number> = {
  color: 0.46,
  range: 0.3,
  number: 0.025,
};

export interface RoomSettings {
  winCondition: WinCondition;
  winTarget?: number;
  durationMinutes?: number;
  turnTimerSeconds: number;
  startingCapital: number;
  boardVariant: string;
  boardSize: number; // tiles per side, minimum 10
  maxPlayers: number;
  marketEventEveryNTurns: number;
}

export const MIN_BOARD_SIZE = 10;

/** Live, shared market state for one tile — separate from any single player. */
export interface TileMarketState {
  tileId: string;
  valueMultiplier: number; // 1.0 baseline, moved by market events
  ownerPlayerId: string | null; // single-owner types only
  purchasePrice: number | null; // single-owner types: what the current owner paid
  investors: Record<string, number>; // shared types: playerId -> cumulative $ invested
  contractExpiresAtTurn?: number;
  buildLevel?: number; // property/estate: 0–4 houses, 5 = hotel
  mortgaged?: boolean;
  mortgageAmount?: number; // cash received when mortgaged — payoff to unmortgage is 110% of this
  forSalePrice?: number | null; // set by the owner to list on the open market
}

export interface Loan {
  id: string;
  principal: number;
  interestRate: number;
  installmentAmount: number;
  installmentIntervalTurns: number;
  installmentsRemaining: number;
  missedPayments: number;
  status: LoanStatus;
  createdAtTurn: number;
}

export interface PlayerState {
  id: string; // RoomPlayer id
  userId: string;
  username: string;
  pieceId: string;
  inGameBalance: number;
  position: number;
  status: PlayerStatus;
  loans: Loan[];
  netWorth: number;
  inJail: boolean;
  jailTurns: number;
  getOutOfJailFreeCards: number;
  hasRolledThisTurn: boolean;
  doublesStreak: number;
}

/** Derived, read-only view of a player's stake in one tile — computed on demand. */
export interface OwnedAssetView {
  tileId: string;
  name: string;
  type: AssetType;
  isSingleOwner: boolean;
  amountInvested: number; // == purchasePrice for single-owner types
  ownershipPercent: number; // 100 for single-owner types
  currentShareValue: number;
  profitLoss: number;
  buildLevel?: number;
  contractExpiresAtTurn?: number;
  mortgaged?: boolean;
  forSalePrice?: number | null;
}

export type CardDeck = "chance" | "community";

export type CardEffect =
  | { kind: "collect"; amount: number }
  | { kind: "pay"; amount: number }
  | { kind: "collect_from_each_player"; amount: number }
  | { kind: "pay_each_player"; amount: number }
  | { kind: "move_to_position"; position: number; collectGoIfPassed: boolean }
  | { kind: "move_relative"; steps: number }
  | { kind: "go_to_jail" }
  | { kind: "get_out_of_jail_free" }
  | { kind: "repairs"; perLevel: number };

export interface CardDefinition {
  id: string;
  deck: CardDeck;
  text: string;
  effect: CardEffect;
}

export interface CardDrawRecord {
  id: string;
  turnNumber: number;
  playerId: string;
  deck: CardDeck;
  text: string;
}

export interface DiceRollRecord {
  id: string;
  playerId: string;
  d1: number;
  d2: number;
  isDoubles: boolean;
  turnNumber: number;
  timestamp: number;
}

export interface AuctionState {
  tileId: string;
  highestBid: number;
  highestBidderId: string | null;
  currentTurnPlayerId: string;
  activePlayerIds: string[]; // still in the auction (haven't passed)
  minIncrement: number;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offerCash: number;
  offerTileIds: string[];
  requestCash: number;
  requestTileIds: string[];
  status: "pending" | "accepted" | "declined" | "cancelled";
  createdAtTurn: number;
}

export interface ChatMessage {
  id: string;
  fromPlayerId: string;
  fromUsername: string;
  toPlayerId?: string; // present for a direct message, absent for room-wide
  message: string;
  timestamp: number;
}

export interface MarketEventRecord {
  id: string;
  triggeredAtTurn: number;
  affectedAssetType: AssetType;
  impactPercent: number;
  description: string;
}

export interface BetRecord {
  id: string;
  tileId: string;
  bettorPlayerId: string;
  ownerPlayerId: string;
  betType: BetType;
  betAmount: number;
  multiplier: number;
  result: "win" | "lose";
  payoutAmount: number;
  rakeAmount: number;
  turnNumber: number;
}

export type PendingDecisionKind =
  | "buy_or_skip" // property / estate / bond / unowned betting / unowned contract — declining starts an auction
  | "outbid_or_skip" // contract owned by someone else
  | "invest_or_fee" // shared tech/crypto/startup tile
  | "bet_or_fee" // betting company tile
  | "renew_or_release"; // contract expiring at the start of the owner's turn

export interface PendingDecision {
  playerId: string;
  tileId: string;
  kind: PendingDecisionKind;
  price: number; // buy price / outbid price / invest price / renewal upkeep
  currentOwnerPlayerId?: string;
  landingFee?: number; // shown alongside invest/bet decline options
}

export interface GameLogEntry {
  turnNumber: number;
  playerId: string;
  actionType:
    | "roll"
    | "buy"
    | "skip"
    | "outbid_contract"
    | "pay_rent"
    | "invest"
    | "pay_landing_fee"
    | "bet"
    | "renew_contract"
    | "release_contract"
    | "take_loan"
    | "loan_installment"
    | "loan_missed"
    | "loan_defaulted"
    | "trigger_event"
    | "go_bankrupt"
    | "pass_go"
    | "draw_card"
    | "go_to_jail"
    | "pay_bail"
    | "use_jail_card"
    | "jail_roll"
    | "build"
    | "mortgage"
    | "unmortgage"
    | "list_for_sale"
    | "cancel_listing"
    | "buy_listed"
    | "propose_trade"
    | "accept_trade"
    | "decline_trade"
    | "auction_start"
    | "auction_bid"
    | "auction_pass"
    | "auction_won"
    | "auction_unsold";
  message: string;
  timestamp: number;
}

export interface GameState {
  roomId: string;
  settings: RoomSettings;
  status: RoomStatus;
  boardVariant: string;
  boardSize: number;
  turnNumber: number;
  currentPlayerIndex: number;
  playerOrder: string[]; // RoomPlayer ids, in turn order
  players: Record<string, PlayerState>;
  tileMarket: Record<string, TileMarketState>;
  marketEvents: MarketEventRecord[];
  cardDraws: CardDrawRecord[];
  bets: BetRecord[];
  trades: TradeOffer[];
  auction: AuctionState | null;
  lastRoll: DiceRollRecord | null;
  log: GameLogEntry[];
  pendingDecision: PendingDecision | null;
  winnerId: string | null;
  endedReason: string | null;
}
