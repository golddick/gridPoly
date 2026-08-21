import { describe, it, expect } from "vitest";
import { generateRoomCode, normalizeRoomCode, isValidRoomCode, ROOM_CODE_LENGTH } from "./roomCode";

describe("generateRoomCode", () => {
  it("produces a code of the expected length", () => {
    expect(generateRoomCode()).toHaveLength(ROOM_CODE_LENGTH);
    expect(generateRoomCode(8)).toHaveLength(8);
  });

  it("only uses unambiguous characters (no 0/O/1/I/L)", () => {
    const code = generateRoomCode(200);
    expect(code).not.toMatch(/[01OIL]/);
  });

  it("is uppercase", () => {
    const code = generateRoomCode(100);
    expect(code).toBe(code.toUpperCase());
  });

  it("produces different codes across calls (not a fixed constant)", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("normalizeRoomCode", () => {
  it("uppercases and trims surrounding whitespace", () => {
    expect(normalizeRoomCode("  abcdef  ")).toBe("ABCDEF");
  });

  it("uppercases lowercase input", () => {
    expect(normalizeRoomCode("abcdef")).toBe("ABCDEF");
  });

  it("strips characters outside the room-code alphabet", () => {
    expect(normalizeRoomCode("A-B C!D")).toBe("ABCD");
  });

  it("strips ambiguous characters that are never generated (0/O/1/I/L)", () => {
    expect(normalizeRoomCode("A0O1IL B")).toBe("AB");
  });

  it("is idempotent", () => {
    const code = generateRoomCode();
    expect(normalizeRoomCode(code)).toBe(code);
    expect(normalizeRoomCode(normalizeRoomCode(code))).toBe(normalizeRoomCode(code));
  });
});

describe("isValidRoomCode", () => {
  it("accepts a properly-sized generated code", () => {
    expect(isValidRoomCode(generateRoomCode())).toBe(true);
  });

  it("accepts a real code even with stray lowercase/whitespace", () => {
    const code = generateRoomCode();
    expect(isValidRoomCode(` ${code.toLowerCase()} `)).toBe(true);
  });

  it("rejects codes that are too short or too long", () => {
    expect(isValidRoomCode("ABC")).toBe(false);
    expect(isValidRoomCode("ABCDEFGH")).toBe(false);
  });

  it("rejects an empty or whitespace-only input", () => {
    expect(isValidRoomCode("")).toBe(false);
    expect(isValidRoomCode("   ")).toBe(false);
  });
});