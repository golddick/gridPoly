// import { describe, it, expect } from "vitest";
// import { boardIndex, generateBoard, jailPosition, tileLayoutPosition, PURCHASABLE_TYPES, SHARED_TYPES, SINGLE_OWNER_TYPES } from "./board";
// import { MIN_BOARD_SIZE } from "./types";

// describe("generateBoard", () => {
//   it("produces 4*(boardSize-1) tiles for a range of board sizes", () => {
//     for (const size of [10, 12, 16, 20]) {
//       const tiles = generateBoard(size);
//       expect(tiles.length).toBe(4 * (size - 1));
//     }
//   });

//   it("clamps below-minimum sizes up to MIN_BOARD_SIZE", () => {
//     const tiles = generateBoard(3);
//     expect(tiles.length).toBe(4 * (MIN_BOARD_SIZE - 1));
//   });

//   it("places exactly one GO, one Jail, one Go To Jail, and one Exchange Floor", () => {
//     const tiles = generateBoard(10);
//     const counts = (type: string) => tiles.filter((t) => t.type === type).length;
//     expect(counts("go")).toBe(1);
//     expect(counts("jail")).toBe(1);
//     expect(counts("go_to_jail")).toBe(1);
//     expect(counts("exchange_floor")).toBe(1);
//   });

//   it("includes at least one of every asset type and both card decks on a min-size board", () => {
//     const tiles = generateBoard(MIN_BOARD_SIZE);
//     const types = new Set(tiles.map((t) => t.type));
//     for (const t of ["property", "estate", "bond", "contract", "betting", "tech_company", "crypto", "startup", "chance", "community"]) {
//       expect(types.has(t)).toBe(true);
//     }
//   });

//   it("gives every tile a unique, stable id", () => {
//     const tiles = generateBoard(12);
//     const ids = tiles.map((t) => t.id);
//     expect(new Set(ids).size).toBe(ids.length);
//   });

//   it("is a pure function of boardSize — regenerating gives an identical board", () => {
//     const a = generateBoard(14);
//     const b = generateBoard(14);
//     expect(a).toEqual(b);
//   });

//   it("scales asset prices upward with position along the perimeter", () => {
//     const tiles = generateBoard(10).filter((t) => t.type === "property");
//     // Later property tiles should generally price higher than earlier ones (monotonic scale factor).
//     expect(tiles[tiles.length - 1].basePrice).toBeGreaterThan(tiles[0].basePrice);
//   });

//   it("prices Estate tiles well above ordinary Property tiles", () => {
//     const tiles = generateBoard(10);
//     const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
//     const propPrices = tiles.filter((t) => t.type === "property").map((t) => t.basePrice);
//     const estatePrices = tiles.filter((t) => t.type === "estate").map((t) => t.basePrice);
//     expect(avg(estatePrices)).toBeGreaterThan(avg(propPrices));
//   });
// });

// describe("boardIndex", () => {
//   it("caches and returns a consistent index per board size", () => {
//     const a = boardIndex(10);
//     const b = boardIndex(10);
//     expect(a).toBe(b); // same cached object
//     expect(a.total).toBe(a.tiles.length);
//   });

//   it("byId resolves every tile by its id", () => {
//     const idx = boardIndex(10);
//     for (const tile of idx.tiles) {
//       expect(idx.byId[tile.id]).toBe(tile);
//     }
//   });
// });

// describe("jailPosition", () => {
//   it("is boardSize - 1, matching the generated Jail tile's position", () => {
//     for (const size of [10, 13, 18]) {
//       const idx = boardIndex(size);
//       const jailTile = idx.tiles.find((t) => t.type === "jail")!;
//       expect(jailPosition(size)).toBe(jailTile.position);
//     }
//   });
// });

// describe("tileLayoutPosition — how the board renders movement in 3D space", () => {
//   it("walks the four corners of the perimeter in order", () => {
//     const side = 10;
//     const total = 4 * (side - 1);
//     const half = (side - 1) / 2;

//     expect(tileLayoutPosition(0, total, side)).toEqual([-half, -half]); // bottom-left corner (GO)
//     expect(tileLayoutPosition(side - 1, total, side)).toEqual([half, -half]); // bottom-right corner (Jail)
//     expect(tileLayoutPosition(2 * (side - 1), total, side)).toEqual([half, half]); // top-right corner
//     expect(tileLayoutPosition(3 * (side - 1), total, side)).toEqual([-half, half]); // top-left corner
//   });

//   it("wraps back to the start position after a full lap", () => {
//     const side = 10;
//     const total = 4 * (side - 1);
//     expect(tileLayoutPosition(total, total, side)).toEqual(tileLayoutPosition(0, total, side));
//   });

//   it("produces a distinct coordinate for every tile on the perimeter (no overlaps)", () => {
//     const side = 10;
//     const total = 4 * (side - 1);
//     const coords = new Set<string>();
//     for (let i = 0; i < total; i++) {
//       const [x, y] = tileLayoutPosition(i, total, side);
//       coords.add(`${x},${y}`);
//     }
//     expect(coords.size).toBe(total);
//   });

//   it("keeps every tile within the board's outer bounds", () => {
//     const side = 12;
//     const total = 4 * (side - 1);
//     const half = (side - 1) / 2;
//     for (let i = 0; i < total; i++) {
//       const [x, y] = tileLayoutPosition(i, total, side);
//       expect(Math.abs(x)).toBeLessThanOrEqual(half + 0.001);
//       expect(Math.abs(y)).toBeLessThanOrEqual(half + 0.001);
//     }
//   });

//   it("scales consistently with board size — a bigger board spaces tiles further from center", () => {
//     const smallHalf = (10 - 1) / 2;
//     const bigHalf = (20 - 1) / 2;
//     expect(bigHalf).toBeGreaterThan(smallHalf);
//     // Corner tile 0 sits at (-half, -half) on any size, confirming the scale follows `side` directly.
//     expect(tileLayoutPosition(0, 4 * 9, 10)).toEqual([-smallHalf, -smallHalf]);
//     expect(tileLayoutPosition(0, 4 * 19, 20)).toEqual([-bigHalf, -bigHalf]);
//   });
// });

// describe("type classification sets stay consistent with PURCHASABLE_TYPES", () => {
//   it("every SHARED_TYPES and SINGLE_OWNER_TYPES entry is purchasable", () => {
//     for (const t of SHARED_TYPES) expect(PURCHASABLE_TYPES.has(t)).toBe(true);
//     for (const t of SINGLE_OWNER_TYPES) expect(PURCHASABLE_TYPES.has(t)).toBe(true);
//   });

//   it("shared and single-owner sets never overlap", () => {
//     for (const t of SHARED_TYPES) expect(SINGLE_OWNER_TYPES.has(t)).toBe(false);
//   });
// });












import { describe, it, expect } from "vitest";
import { boardIndex, generateBoard, hopPath, isWalkableHop, jailPosition, tileLayoutPosition, PURCHASABLE_TYPES, SHARED_TYPES, SINGLE_OWNER_TYPES } from "./board";
import { MIN_BOARD_SIZE, TileType } from "./types";

describe("generateBoard", () => {
  it("produces 4*(boardSize-1) tiles for a range of board sizes", () => {
    for (const size of [10, 12, 16, 20]) {
      const tiles = generateBoard(size);
      expect(tiles.length).toBe(4 * (size - 1));
    }
  });

  it("clamps below-minimum sizes up to MIN_BOARD_SIZE", () => {
    const tiles = generateBoard(3);
    expect(tiles.length).toBe(4 * (MIN_BOARD_SIZE - 1));
  });

  it("places exactly one GO, one Jail, one Go To Jail, and one Exchange Floor", () => {
    const tiles = generateBoard(10);
    const counts = (type: string) => tiles.filter((t) => t.type === type).length;
    expect(counts("go")).toBe(1);
    expect(counts("jail")).toBe(1);
    expect(counts("go_to_jail")).toBe(1);
    expect(counts("exchange_floor")).toBe(1);
  });

  // it("includes at least one of every asset type and both card decks on a min-size board", () => {
  //   const tiles = generateBoard(MIN_BOARD_SIZE);
  //   const types = new Set(tiles.map((t) => t.type));
  //   for (const t of ["property", "estate", "bond", "contract", "betting", "tech_company", "crypto", "startup", "chance", "community"]) {
  //     expect(types.has(t)).toBe(true);
  //   }
  // });

  it("includes at least one of every asset type and both card decks on a min-size board", () => {
    const tiles = generateBoard(MIN_BOARD_SIZE);
    const types = new Set(tiles.map((t) => t.type));
    const tileTypes: TileType[] = ["property", "estate", "bond", "contract", "betting", "tech_company", "crypto", "startup", "chance", "community"];
    for (const t of tileTypes) {
      expect(types.has(t)).toBe(true);
    }
});

  it("gives every tile a unique, stable id", () => {
    const tiles = generateBoard(12);
    const ids = tiles.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is a pure function of boardSize — regenerating gives an identical board", () => {
    const a = generateBoard(14);
    const b = generateBoard(14);
    expect(a).toEqual(b);
  });

  it("scales asset prices upward with position along the perimeter", () => {
    const tiles = generateBoard(10).filter((t) => t.type === "property");
    // Later property tiles should generally price higher than earlier ones (monotonic scale factor).
    expect(tiles[tiles.length - 1].basePrice).toBeGreaterThan(tiles[0].basePrice);
  });

  it("prices Estate tiles well above ordinary Property tiles", () => {
    const tiles = generateBoard(10);
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const propPrices = tiles.filter((t) => t.type === "property").map((t) => t.basePrice);
    const estatePrices = tiles.filter((t) => t.type === "estate").map((t) => t.basePrice);
    expect(avg(estatePrices)).toBeGreaterThan(avg(propPrices));
  });
});

describe("boardIndex", () => {
  it("caches and returns a consistent index per board size", () => {
    const a = boardIndex(10);
    const b = boardIndex(10);
    expect(a).toBe(b); // same cached object
    expect(a.total).toBe(a.tiles.length);
  });

  it("byId resolves every tile by its id", () => {
    const idx = boardIndex(10);
    for (const tile of idx.tiles) {
      expect(idx.byId[tile.id]).toBe(tile);
    }
  });
});

describe("jailPosition", () => {
  it("is boardSize - 1, matching the generated Jail tile's position", () => {
    for (const size of [10, 13, 18]) {
      const idx = boardIndex(size);
      const jailTile = idx.tiles.find((t) => t.type === "jail")!;
      expect(jailPosition(size)).toBe(jailTile.position);
    }
  });
});

describe("tileLayoutPosition — how the board renders movement in 3D space", () => {
  it("walks the four corners of the perimeter in order", () => {
    const side = 10;
    const total = 4 * (side - 1);
    const half = (side - 1) / 2;

    expect(tileLayoutPosition(0, total, side)).toEqual([-half, -half]); // bottom-left corner (GO)
    expect(tileLayoutPosition(side - 1, total, side)).toEqual([half, -half]); // bottom-right corner (Jail)
    expect(tileLayoutPosition(2 * (side - 1), total, side)).toEqual([half, half]); // top-right corner
    expect(tileLayoutPosition(3 * (side - 1), total, side)).toEqual([-half, half]); // top-left corner
  });

  it("wraps back to the start position after a full lap", () => {
    const side = 10;
    const total = 4 * (side - 1);
    expect(tileLayoutPosition(total, total, side)).toEqual(tileLayoutPosition(0, total, side));
  });

  it("produces a distinct coordinate for every tile on the perimeter (no overlaps)", () => {
    const side = 10;
    const total = 4 * (side - 1);
    const coords = new Set<string>();
    for (let i = 0; i < total; i++) {
      const [x, y] = tileLayoutPosition(i, total, side);
      coords.add(`${x},${y}`);
    }
    expect(coords.size).toBe(total);
  });

  it("keeps every tile within the board's outer bounds", () => {
    const side = 12;
    const total = 4 * (side - 1);
    const half = (side - 1) / 2;
    for (let i = 0; i < total; i++) {
      const [x, y] = tileLayoutPosition(i, total, side);
      expect(Math.abs(x)).toBeLessThanOrEqual(half + 0.001);
      expect(Math.abs(y)).toBeLessThanOrEqual(half + 0.001);
    }
  });

  it("scales consistently with board size — a bigger board spaces tiles further from center", () => {
    const smallHalf = (10 - 1) / 2;
    const bigHalf = (20 - 1) / 2;
    expect(bigHalf).toBeGreaterThan(smallHalf);
    // Corner tile 0 sits at (-half, -half) on any size, confirming the scale follows `side` directly.
    expect(tileLayoutPosition(0, 4 * 9, 10)).toEqual([-smallHalf, -smallHalf]);
    expect(tileLayoutPosition(0, 4 * 19, 20)).toEqual([-bigHalf, -bigHalf]);
  });
});

describe("hopPath — tile-by-tile token animation math", () => {
  it("returns exactly the tiles walked forward, matching a normal roll's step count", () => {
    // Rolling 7 from position 3 on a 36-tile board should produce a 7-tile hop chain.
    const path = hopPath(3, 10, 36);
    expect(path).toEqual([4, 5, 6, 7, 8, 9, 10]);
  });

  it("wraps around the board and still lands exactly on the target (passing GO)", () => {
    const path = hopPath(34, 2, 36);
    expect(path).toEqual([35, 0, 1, 2]);
    expect(path[path.length - 1]).toBe(2);
  });

  it("returns a single-element path (no movement) when start equals destination", () => {
    expect(hopPath(5, 5, 36)).toEqual([5]);
  });

  it("never exceeds `total` hops even for a full-lap distance", () => {
    const path = hopPath(0, 35, 36); // walk almost all the way around
    expect(path.length).toBeLessThanOrEqual(36);
    expect(path[path.length - 1]).toBe(35);
  });

  it("is consistent with jailPosition for a go-to-jail style jump", () => {
    const total = 36;
    const jail = jailPosition(10);
    const path = hopPath(20, jail, total);
    expect(path[path.length - 1]).toBe(jail);
  });
});

describe("isWalkableHop", () => {
  it("is true for any ordinary two-die roll distance (2–12)", () => {
    for (let steps = 2; steps <= 12; steps++) {
      expect(isWalkableHop(0, steps, 36)).toBe(true);
    }
  });

  it("is false for a long-distance teleport (e.g. sent to Jail from across the board)", () => {
    expect(isWalkableHop(2, 30, 36)).toBe(false);
  });

  it("respects a custom maxHops threshold", () => {
    expect(isWalkableHop(0, 5, 36, 4)).toBe(false);
    expect(isWalkableHop(0, 4, 36, 4)).toBe(true);
  });
});
  it("every SHARED_TYPES and SINGLE_OWNER_TYPES entry is purchasable", () => {
    for (const t of SHARED_TYPES) expect(PURCHASABLE_TYPES.has(t)).toBe(true);
    for (const t of SINGLE_OWNER_TYPES) expect(PURCHASABLE_TYPES.has(t)).toBe(true);
  });

  it("shared and single-owner sets never overlap", () => {
    for (const t of SHARED_TYPES) expect(SINGLE_OWNER_TYPES.has(t)).toBe(false);
  });
