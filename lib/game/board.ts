// import type { AssetType, BoardTile, TileType } from "./types";
// import { MIN_BOARD_SIZE } from "./types";

// export const GO_SALARY = 200;

// export const TYPE_CONFIG: Record<
//   AssetType,
//   { volatility: number; landingFeePercent: number; rentPercent: number; incomeRate: number; base: number }
// > = {
//   property: { volatility: 0.15, landingFeePercent: 0, rentPercent: 0.08, incomeRate: 0, base: 160 },
//   estate: { volatility: 0.12, landingFeePercent: 0, rentPercent: 0.08, incomeRate: 0, base: 480 },
//   bond: { volatility: 0.05, landingFeePercent: 0, rentPercent: 0.04, incomeRate: 10, base: 120 },
//   contract: { volatility: 0.3, landingFeePercent: 0, rentPercent: 0, incomeRate: 30, base: 220 },
//   betting: { volatility: 0.5, landingFeePercent: 0.06, rentPercent: 0, incomeRate: 0, base: 200 },
//   tech_company: { volatility: 0.45, landingFeePercent: 0.08, rentPercent: 0, incomeRate: 0.02, base: 260 },
//   crypto: { volatility: 0.7, landingFeePercent: 0.1, rentPercent: 0, incomeRate: 0, base: 180 },
//   startup: { volatility: 0.75, landingFeePercent: 0.1, rentPercent: 0, incomeRate: 0, base: 150 },
// };

// /** Estates are premium property — building on one multiplies value/rent by this instead of the normal scale. */
// export const ESTATE_VALUE_MULTIPLIER = 3;

// const NAME_POOL: Record<AssetType, string[]> = {
//   property: ["Ikeja Heights", "Lekki Court", "Yaba Flats", "Victoria Gardens", "Abuja Rise", "Port Harcourt Bay", "Enugu Heights", "Kano Central"],
//   estate: ["Grand Manor", "Skyline Estate", "Royal Heights Estate", "The Meridian Estate"],
//   bond: ["T-Bill 2Y", "Muni Bond 5Y", "Sovereign Bond 10Y", "Corporate Note", "Infrastructure Bond"],
//   contract: ["Logistics Retainer", "Media Ad Deal", "Retail Franchise", "Catering Contract", "Security Retainer"],
//   betting: ["Roulette House", "Lucky Wheel Exchange", "Highroller Table", "Spin & Stake"],
//   tech_company: ["Fintech Startup Co", "CloudNine SaaS", "RoboWorks AI", "DataForge Labs", "NeuralByte"],
//   crypto: ["BitLite", "EtherNode", "SolWave", "ChainPeak"],
//   startup: ["GreenAgro Ventures", "QuickCart", "UrbanFleet", "MicroLend"],
// };

// const CYCLE: (AssetType | "chance" | "community")[] = [
//   "property",
//   "bond",
//   "chance",
//   "contract",
//   "property",
//   "tech_company",
//   "crypto",
//   "community",
//   "property",
//   "betting",
//   "startup",
//   "estate",
//   "property",
//   "contract",
//   "chance",
//   "bond",
//   "property",
//   "tech_company",
//   "crypto",
//   "community",
//   "betting",
//   "property",
//   "contract",
//   "chance",
//   "startup",
//   "estate",
//   "bond",
// ];

// function nameFor(type: AssetType, occurrence: number): string {
//   const pool = NAME_POOL[type];
//   const base = pool[occurrence % pool.length];
//   const cycle = Math.floor(occurrence / pool.length);
//   return cycle === 0 ? base : `${base} ${cycle + 1}`;
// }

// /**
//  * Generates a perimeter board: 4 corner special tiles (GO, Jail, Exchange
//  * Floor, Go To Jail) + asset/Chance/Community tiles along each side.
//  * `boardSize` is tiles-per-side (min 10); total tiles = 4 * (boardSize - 1).
//  */
// export function generateBoard(boardSizeInput: number): BoardTile[] {
//   const boardSize = Math.max(MIN_BOARD_SIZE, Math.floor(boardSizeInput) || MIN_BOARD_SIZE);
//   const total = 4 * (boardSize - 1);
//   const jailPosition = boardSize - 1;
//   const exchangeFloorPosition = 2 * (boardSize - 1);
//   const goToJailPosition = 3 * (boardSize - 1);
//   const cornerPositions: Record<number, { type: TileType; name: string }> = {
//     0: { type: "go", name: "GO" },
//     [jailPosition]: { type: "jail", name: "Jail" },
//     [exchangeFloorPosition]: { type: "exchange_floor", name: "Exchange Floor" },
//     [goToJailPosition]: { type: "go_to_jail", name: "Go To Jail" },
//   };

//   const tiles: BoardTile[] = [];
//   const occurrenceCounter: Record<AssetType, number> = {
//     property: 0,
//     estate: 0,
//     bond: 0,
//     contract: 0,
//     betting: 0,
//     tech_company: 0,
//     crypto: 0,
//     startup: 0,
//   };
//   let chanceCount = 0;
//   let communityCount = 0;

//   let cycleIndex = 0;
//   for (let position = 0; position < total; position++) {
//     const corner = cornerPositions[position];
//     if (corner) {
//       tiles.push({
//         id: `corner-${position}`,
//         position,
//         type: corner.type,
//         name: corner.name,
//         basePrice: 0,
//         volatility: 0,
//         baseIncomeRate: 0,
//         landingFeePercent: 0,
//         rentPercent: 0,
//       });
//       continue;
//     }

//     const kind = CYCLE[cycleIndex % CYCLE.length];
//     cycleIndex++;

//     if (kind === "chance" || kind === "community") {
//       const n = kind === "chance" ? ++chanceCount : ++communityCount;
//       tiles.push({
//         id: `${kind}-${n}-${position}`,
//         position,
//         type: kind,
//         name: kind === "chance" ? "Chance" : "Community",
//         basePrice: 0,
//         volatility: 0,
//         baseIncomeRate: 0,
//         landingFeePercent: 0,
//         rentPercent: 0,
//       });
//       continue;
//     }

//     const type = kind as AssetType;
//     const occurrence = occurrenceCounter[type]++;
//     const cfg = TYPE_CONFIG[type];
//     const priceScale = 1 + (position / total) * 0.7;

//     tiles.push({
//       id: `${type}-${occurrence}-${position}`,
//       position,
//       type,
//       name: nameFor(type, occurrence),
//       basePrice: Math.round(cfg.base * priceScale),
//       volatility: cfg.volatility,
//       baseIncomeRate:
//         type === "tech_company"
//           ? Math.round(cfg.base * priceScale * cfg.incomeRate)
//           : Math.round(cfg.incomeRate * priceScale),
//       landingFeePercent: cfg.landingFeePercent,
//       rentPercent: cfg.rentPercent,
//     });
//   }

//   return tiles;
// }

// export function jailPosition(boardSizeInput: number): number {
//   const boardSize = Math.max(MIN_BOARD_SIZE, Math.floor(boardSizeInput) || MIN_BOARD_SIZE);
//   return boardSize - 1;
// }

// /**
//  * Grid coordinates (in tile units, board centered on origin) for a tile at
//  * `index` on a perimeter of `total` tiles with `side` tiles per edge.
//  * Pure and deterministic — used by both the 3D renderer and its tests.
//  */
// export function tileLayoutPosition(index: number, total: number, side: number): [number, number] {
//   const half = (side - 1) / 2;
//   const legLength = side - 1;
//   const leg = Math.floor(index / legLength);
//   const offset = index % legLength;

//   switch (leg % 4) {
//     case 0:
//       return [offset - half, -half]; // bottom edge, left -> right
//     case 1:
//       return [half, offset - half]; // right edge, bottom -> top
//     case 2:
//       return [half - offset, half]; // top edge, right -> left
//     default:
//       return [-half, half - offset]; // left edge, top -> bottom
//   }
// }

// export const PURCHASABLE_TYPES = new Set<TileType>([
//   "property",
//   "estate",
//   "contract",
//   "betting",
//   "tech_company",
//   "bond",
//   "crypto",
//   "startup",
// ]);

// export const SHARED_TYPES = new Set<AssetType>(["tech_company", "crypto", "startup"]);
// export const SINGLE_OWNER_TYPES = new Set<AssetType>(["property", "estate", "contract", "bond", "betting"]);

// export interface BoardIndex {
//   boardSize: number;
//   total: number;
//   tiles: BoardTile[];
//   byId: Record<string, BoardTile>;
//   byPosition: BoardTile[];
// }

// const indexCache = new Map<number, BoardIndex>();

// /**
//  * `generateBoard` is a pure function of `boardSize`, so client and server
//  * independently produce identical tile sets — no need to transmit the board
//  * over the wire, only `boardSize` itself.
//  */
// export function boardIndex(boardSizeInput: number): BoardIndex {
//   const boardSize = Math.max(MIN_BOARD_SIZE, Math.floor(boardSizeInput) || MIN_BOARD_SIZE);
//   const cached = indexCache.get(boardSize);
//   if (cached) return cached;

//   const tiles = generateBoard(boardSize);
//   const byId: Record<string, BoardTile> = {};
//   for (const t of tiles) byId[t.id] = t;

//   const index: BoardIndex = { boardSize, total: tiles.length, tiles, byId, byPosition: tiles };
//   indexCache.set(boardSize, index);
//   return index;
// }
















import type { AssetType, BoardTile, TileType } from "./types";
import { MIN_BOARD_SIZE } from "./types";

export const GO_SALARY = 200;

export const TYPE_CONFIG: Record<
  AssetType,
  { volatility: number; landingFeePercent: number; rentPercent: number; incomeRate: number; base: number }
> = {
  property: { volatility: 0.15, landingFeePercent: 0, rentPercent: 0.08, incomeRate: 0, base: 160 },
  estate: { volatility: 0.12, landingFeePercent: 0, rentPercent: 0.08, incomeRate: 0, base: 480 },
  bond: { volatility: 0.05, landingFeePercent: 0, rentPercent: 0.04, incomeRate: 10, base: 120 },
  contract: { volatility: 0.3, landingFeePercent: 0, rentPercent: 0, incomeRate: 30, base: 220 },
  betting: { volatility: 0.5, landingFeePercent: 0.06, rentPercent: 0, incomeRate: 0, base: 200 },
  tech_company: { volatility: 0.45, landingFeePercent: 0.08, rentPercent: 0, incomeRate: 0.02, base: 260 },
  crypto: { volatility: 0.7, landingFeePercent: 0.1, rentPercent: 0, incomeRate: 0, base: 180 },
  startup: { volatility: 0.75, landingFeePercent: 0.1, rentPercent: 0, incomeRate: 0, base: 150 },
};

/** Estates are premium property — building on one multiplies value/rent by this instead of the normal scale. */
export const ESTATE_VALUE_MULTIPLIER = 3;

const NAME_POOL: Record<AssetType, string[]> = {
  property: ["Ikeja Heights", "Lekki Court", "Yaba Flats", "Victoria Gardens", "Abuja Rise", "Port Harcourt Bay", "Enugu Heights", "Kano Central"],
  estate: ["Grand Manor", "Skyline Estate", "Royal Heights Estate", "The Meridian Estate"],
  bond: ["T-Bill 2Y", "Muni Bond 5Y", "Sovereign Bond 10Y", "Corporate Note", "Infrastructure Bond"],
  contract: ["Logistics Retainer", "Media Ad Deal", "Retail Franchise", "Catering Contract", "Security Retainer"],
  betting: ["Roulette House", "Lucky Wheel Exchange", "Highroller Table", "Spin & Stake"],
  tech_company: ["Fintech Startup Co", "CloudNine SaaS", "RoboWorks AI", "DataForge Labs", "6thgrid Tech"],
  crypto: ["BitLite", "EtherNode", "SolWave", "ChainPeak"],
  startup: ["GreenAgro Ventures", "xonnect", "UrbanFleet", "MicroLend"],
};

const CYCLE: (AssetType | "chance" | "community")[] = [
  "property",
  "bond",
  "chance",
  "contract",
  "property",
  "tech_company",
  "crypto",
  "community",
  "property",
  "betting",
  "startup",
  "estate",
  "property",
  "contract",
  "chance",
  "bond",
  "property",
  "tech_company",
  "crypto",
  "community",
  "betting",
  "property",
  "contract",
  "chance",
  "startup",
  "estate",
  "bond",
];

function nameFor(type: AssetType, occurrence: number): string {
  const pool = NAME_POOL[type];
  const base = pool[occurrence % pool.length];
  const cycle = Math.floor(occurrence / pool.length);
  return cycle === 0 ? base : `${base} ${cycle + 1}`;
}

/**
 * Generates a perimeter board: 4 corner special tiles (GO, Jail, Exchange
 * Floor, Go To Jail) + asset/Chance/Community tiles along each side.
 * `boardSize` is tiles-per-side (min 10); total tiles = 4 * (boardSize - 1).
 */
export function generateBoard(boardSizeInput: number): BoardTile[] {
  const boardSize = Math.max(MIN_BOARD_SIZE, Math.floor(boardSizeInput) || MIN_BOARD_SIZE);
  const total = 4 * (boardSize - 1);
  const jailPosition = boardSize - 1;
  const exchangeFloorPosition = 2 * (boardSize - 1);
  const goToJailPosition = 3 * (boardSize - 1);
  const cornerPositions: Record<number, { type: TileType; name: string }> = {
    0: { type: "go", name: "GO" },
    [jailPosition]: { type: "jail", name: "Jail" },
    [exchangeFloorPosition]: { type: "exchange_floor", name: "Exchange Floor" },
    [goToJailPosition]: { type: "go_to_jail", name: "Go To Jail" },
  };

  const tiles: BoardTile[] = [];
  const occurrenceCounter: Record<AssetType, number> = {
    property: 0,
    estate: 0,
    bond: 0,
    contract: 0,
    betting: 0,
    tech_company: 0,
    crypto: 0,
    startup: 0,
  };
  let chanceCount = 0;
  let communityCount = 0;

  let cycleIndex = 0;
  for (let position = 0; position < total; position++) {
    const corner = cornerPositions[position];
    if (corner) {
      tiles.push({
        id: `corner-${position}`,
        position,
        type: corner.type,
        name: corner.name,
        basePrice: 0,
        volatility: 0,
        baseIncomeRate: 0,
        landingFeePercent: 0,
        rentPercent: 0,
      });
      continue;
    }

    const kind = CYCLE[cycleIndex % CYCLE.length];
    cycleIndex++;

    if (kind === "chance" || kind === "community") {
      const n = kind === "chance" ? ++chanceCount : ++communityCount;
      tiles.push({
        id: `${kind}-${n}-${position}`,
        position,
        type: kind,
        name: kind === "chance" ? "Chance" : "Community",
        basePrice: 0,
        volatility: 0,
        baseIncomeRate: 0,
        landingFeePercent: 0,
        rentPercent: 0,
      });
      continue;
    }

    const type = kind as AssetType;
    const occurrence = occurrenceCounter[type]++;
    const cfg = TYPE_CONFIG[type];
    const priceScale = 1 + (position / total) * 0.7;

    tiles.push({
      id: `${type}-${occurrence}-${position}`,
      position,
      type,
      name: nameFor(type, occurrence),
      basePrice: Math.round(cfg.base * priceScale),
      volatility: cfg.volatility,
      baseIncomeRate:
        type === "tech_company"
          ? Math.round(cfg.base * priceScale * cfg.incomeRate)
          : Math.round(cfg.incomeRate * priceScale),
      landingFeePercent: cfg.landingFeePercent,
      rentPercent: cfg.rentPercent,
    });
  }

  return tiles;
}

export function jailPosition(boardSizeInput: number): number {
  const boardSize = Math.max(MIN_BOARD_SIZE, Math.floor(boardSizeInput) || MIN_BOARD_SIZE);
  return boardSize - 1;
}

/**
 * The sequence of intermediate tile positions a token passes through moving
 * forward from `fromPosition` to `toPosition` (inclusive of the destination,
 * exclusive of the start) — always walks forward around the perimeter,
 * wrapping at `total`. Pure and deterministic so the 3D renderer can animate
 * a real tile-by-tile hop instead of a single jump, and so the path length
 * (== dice total, for an ordinary roll) is independently testable.
 */
export function hopPath(fromPosition: number, toPosition: number, total: number): number[] {
  if (total <= 0) return [toPosition];
  const from = ((fromPosition % total) + total) % total;
  const to = ((toPosition % total) + total) % total;
  if (from === to) return [to];

  const path: number[] = [];
  let pos = from;
  for (let i = 0; i < total; i++) {
    pos = (pos + 1) % total;
    path.push(pos);
    if (pos === to) break;
  }
  return path;
}

/**
 * Rendering hint for hop animation: whether a position change was a real
 * dice-driven walk (short, worth hopping tile-by-tile) or a long-distance
 * teleport (sent to Jail, a "move to position" card) that should just snap.
 * `maxHops` mirrors the largest a normal two-die roll can produce.
 */
export function isWalkableHop(fromPosition: number, toPosition: number, total: number, maxHops = 12): boolean {
  return hopPath(fromPosition, toPosition, total).length <= maxHops;
}

/**
 * Grid coordinates (in tile units, board centered on origin) for a tile at
 * `index` on a perimeter of `total` tiles with `side` tiles per edge.
 * Pure and deterministic — used by both the 3D renderer and its tests.
 */
export function tileLayoutPosition(index: number, total: number, side: number): [number, number] {
  const half = (side - 1) / 2;
  const legLength = side - 1;
  const leg = Math.floor(index / legLength);
  const offset = index % legLength;

  switch (leg % 4) {
    case 0:
      return [offset - half, -half]; // bottom edge, left -> right
    case 1:
      return [half, offset - half]; // right edge, bottom -> top
    case 2:
      return [half - offset, half]; // top edge, right -> left
    default:
      return [-half, half - offset]; // left edge, top -> bottom
  }
}

export const PURCHASABLE_TYPES = new Set<TileType>([
  "property",
  "estate",
  "contract",
  "betting",
  "tech_company",
  "bond",
  "crypto",
  "startup",
]);

export const SHARED_TYPES = new Set<AssetType>(["tech_company", "crypto", "startup"]);
export const SINGLE_OWNER_TYPES = new Set<AssetType>(["property", "estate", "contract", "bond", "betting"]);

export interface BoardIndex {
  boardSize: number;
  total: number;
  tiles: BoardTile[];
  byId: Record<string, BoardTile>;
  byPosition: BoardTile[];
}

const indexCache = new Map<number, BoardIndex>();

/**
 * `generateBoard` is a pure function of `boardSize`, so client and server
 * independently produce identical tile sets — no need to transmit the board
 * over the wire, only `boardSize` itself.
 */
export function boardIndex(boardSizeInput: number): BoardIndex {
  const boardSize = Math.max(MIN_BOARD_SIZE, Math.floor(boardSizeInput) || MIN_BOARD_SIZE);
  const cached = indexCache.get(boardSize);
  if (cached) return cached;

  const tiles = generateBoard(boardSize);
  const byId: Record<string, BoardTile> = {};
  for (const t of tiles) byId[t.id] = t;

  const index: BoardIndex = { boardSize, total: tiles.length, tiles, byId, byPosition: tiles };
  indexCache.set(boardSize, index);
  return index;
}