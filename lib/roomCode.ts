// Excludes visually ambiguous characters (0/O, 1/I/L) so codes are easy to
// read aloud and type on a phone keyboard.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(length: number = ROOM_CODE_LENGTH): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/** Uppercases and strips anything that isn't a valid room-code character, so typos/case don't cause a false "not found". */
export function normalizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .trim()
    .split("")
    .filter((c) => ALPHABET.includes(c))
    .join("");
}

export function isValidRoomCode(input: string): boolean {
  const normalized = normalizeRoomCode(input);
  return normalized.length === ROOM_CODE_LENGTH;
}