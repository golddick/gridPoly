import { describe, it, expect } from "vitest";
import {
  WHEEL_POCKETS,
  EUROPEAN_WHEEL_ORDER,
  RED_POCKETS,
  pocketColor,
  betWins,
  spinPocket,
  RANGE_BANDS,
} from "./roulette";

describe("roulette wheel layout", () => {
  it("has 37 pockets numbered 0–36, each exactly once, in the ring", () => {
    expect(WHEEL_POCKETS).toBe(37);
    expect(EUROPEAN_WHEEL_ORDER).toHaveLength(37);
    expect(new Set(EUROPEAN_WHEEL_ORDER)).toEqual(new Set(Array.from({ length: 37 }, (_, i) => i)));
  });

  it("splits the non-zero pockets 18 red / 18 black", () => {
    expect(RED_POCKETS.size).toBe(18);
    const black = Array.from({ length: 36 }, (_, i) => i + 1).filter((n) => !RED_POCKETS.has(n));
    expect(black).toHaveLength(18);
  });

  it("colors 0 green and every other pocket red or black", () => {
    expect(pocketColor(0)).toBe("green");
    expect(pocketColor(1)).toBe("red");
    expect(pocketColor(2)).toBe("black");
    for (let n = 1; n <= 36; n++) expect(pocketColor(n)).not.toBe("green");
  });
});

describe("spinPocket", () => {
  it("always returns an integer pocket in [0, 37)", () => {
    for (const r of [0, 0.0001, 0.5, 0.999999]) {
      const p = spinPocket(() => r);
      expect(Number.isInteger(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(37);
    }
  });

  it("maps the fraction to the expected pocket", () => {
    expect(spinPocket(() => 0)).toBe(0);
    expect(spinPocket(() => (5 + 0.5) / 37)).toBe(5);
    expect(spinPocket(() => 0.9999)).toBe(36);
  });
});

describe("betWins", () => {
  it("color: wins on a matching non-zero color, 0 always loses", () => {
    expect(betWins("color", "red", 1)).toBe(true); // 1 is red
    expect(betWins("color", "black", 2)).toBe(true); // 2 is black
    expect(betWins("color", "red", 2)).toBe(false);
    expect(betWins("color", "red", 0)).toBe(false);
    expect(betWins("color", "black", 0)).toBe(false);
  });

  it("range: wins inside the chosen dozen, 0 always loses", () => {
    expect(betWins("range", "low", 1)).toBe(true);
    expect(betWins("range", "low", 12)).toBe(true);
    expect(betWins("range", "low", 13)).toBe(false);
    expect(betWins("range", "mid", 13)).toBe(true);
    expect(betWins("range", "high", 36)).toBe(true);
    expect(betWins("range", "low", 0)).toBe(false);
    // Bands tile the 1–36 range with no gaps or overlaps.
    for (let n = 1; n <= 36; n++) {
      const hits = (["low", "mid", "high"] as const).filter((b) => betWins("range", b, n));
      expect(hits).toHaveLength(1);
    }
    expect(RANGE_BANDS.high).toEqual([25, 36]);
  });

  it("number: wins only on an exact pocket match, including 0", () => {
    expect(betWins("number", "0", 0)).toBe(true);
    expect(betWins("number", "17", 17)).toBe(true);
    expect(betWins("number", "17", 18)).toBe(false);
  });
});
