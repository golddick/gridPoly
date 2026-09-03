import { describe, expect, it } from "vitest";
import { FACE_DEFS, eulerForValue } from "./diceFaces";

// Apply a single-axis rotation (radians) to a vector using the same right-handed
// convention three.js uses. Each face rotates about exactly one axis, so applying
// them in X→Y→Z order is exact here (no compound-order ambiguity).
function rotate(
  [x, y, z]: [number, number, number],
  [rx, ry, rz]: [number, number, number]
): [number, number, number] {
  let v: [number, number, number] = [x, y, z];
  if (rx) {
    const c = Math.cos(rx);
    const s = Math.sin(rx);
    v = [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
  }
  if (ry) {
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    v = [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
  }
  if (rz) {
    const c = Math.cos(rz);
    const s = Math.sin(rz);
    v = [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
  }
  return v;
}

describe("die face orientation", () => {
  it("defines values 1–6 exactly once", () => {
    expect(FACE_DEFS.map((f) => f.value).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("is a valid Western die — opposite faces sum to 7", () => {
    for (const face of FACE_DEFS) {
      const opp = FACE_DEFS.find(
        (f) =>
          f.normal[0] === -face.normal[0] &&
          f.normal[1] === -face.normal[1] &&
          f.normal[2] === -face.normal[2]
      );
      expect(opp, `opposite face of value ${face.value}`).toBeDefined();
      expect(face.value + opp!.value).toBe(7);
    }
  });

  // The dice-display bug: values 1 and 6 had their settle rotations swapped, so a
  // rolled 1 rendered face-up as 6 and a (1,3)=4 move looked like a 9. This pins
  // every face's rotation to the invariant "your own value ends up on top (+Y)".
  it("settles each rolled value onto the top face (+Y)", () => {
    for (const face of FACE_DEFS) {
      const [rx, ry, rz] = rotate(face.normal, eulerForValue(face.value));
      expect(rx).toBeCloseTo(0, 6);
      expect(ry).toBeCloseTo(1, 6);
      expect(rz).toBeCloseTo(0, 6);
    }
  });
});
