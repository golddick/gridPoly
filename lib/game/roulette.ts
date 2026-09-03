import type { BetType } from "./types";

/**
 * Single-zero ("European") roulette — the authoritative model behind every
 * Betting Company spin. Pure and isomorphic: the engine draws the pocket
 * server-side, and the client wheel/modal render the exact same layout, so a
 * spin looks identical on every screen (the landed pocket is recorded on the
 * BetRecord, just like a dice roll records d1/d2).
 */

/** Pockets 0–36 — the single green 0 is the entire house edge. */
export const WHEEL_POCKETS = 37;

/** Physical pocket order around the wheel, used to render the ring. */
export const EUROPEAN_WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26,
];

/** The red pockets on a European wheel; every other non-zero pocket is black. */
export const RED_POCKETS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type PocketColor = "green" | "red" | "black";

export function pocketColor(n: number): PocketColor {
  if (n === 0) return "green";
  return RED_POCKETS.has(n) ? "red" : "black";
}

/** The three "dozen" range bands a Range bet chooses between (inclusive). */
export const RANGE_BANDS: Record<"low" | "mid" | "high", [number, number]> = {
  low: [1, 12],
  mid: [13, 24],
  high: [25, 36],
};

export type RangeBand = keyof typeof RANGE_BANDS;

export const RANGE_BAND_LABELS: Record<RangeBand, string> = {
  low: "1–12",
  mid: "13–24",
  high: "25–36",
};

/** The single random draw that decides a spin. Injectable for deterministic tests. */
export function spinPocket(rand: () => number = Math.random): number {
  return Math.floor(rand() * WHEEL_POCKETS);
}

/**
 * Whether a bet's selection wins against the landed pocket.
 * - color:  selection is "red" | "black" — wins if the pocket is that color (0 loses).
 * - range:  selection is "low" | "mid" | "high" — wins if the pocket is in that dozen (0 loses).
 * - number: selection is the pocket number 0–36 (as a string) — wins on an exact match.
 */
export function betWins(betType: BetType, selection: string, pocket: number): boolean {
  if (betType === "color") return pocket !== 0 && pocketColor(pocket) === selection;
  if (betType === "range") {
    const band = RANGE_BANDS[selection as RangeBand];
    return !!band && pocket >= band[0] && pocket <= band[1];
  }
  if (betType === "number") return Number(selection) === pocket;
  return false;
}
