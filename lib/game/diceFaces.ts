// Pure geometry for the 3D die's faces — no three.js, no React — so it can be
// unit-tested in isolation (see diceFaces.test.ts). The Dice3D component imports
// this table to both paint the pips and settle each die onto its rolled value.
//
// The die is a standard right-handed cube. A Western die has opposite faces that
// sum to 7, and we paint the pips on these face normals:
//
//     +Y = 2   -Y = 5
//     -X = 1   +X = 6
//     -Z = 3   +Z = 4
//
// `axis` is the single-axis rotation (in radians, applied as an XYZ Euler) that
// swings THAT face's normal onto +Y, so its value ends up on top after the die
// settles. The pair that's easy to get backwards is 1 and 6: bringing +X up needs
// a +90° turn about Z, and bringing -X up needs -90°. Reversing those two is
// exactly what made a rolled 1 display as 6 (and 6 as 1). The test below pins
// every face's rotation to the +Y invariant so that can't silently regress.
export type FaceDef = {
  value: number;
  /** Unit normal of the face that carries `value`, in the die's local frame. */
  normal: [number, number, number];
  /** Euler rotation (radians) that brings `normal` to +Y (face-up). */
  axis: [number, number, number];
};

export const FACE_DEFS: FaceDef[] = [
  { value: 2, normal: [0, 1, 0], axis: [0, 0, 0] },
  { value: 5, normal: [0, -1, 0], axis: [Math.PI, 0, 0] },
  { value: 1, normal: [-1, 0, 0], axis: [0, 0, -Math.PI / 2] },
  { value: 6, normal: [1, 0, 0], axis: [0, 0, Math.PI / 2] },
  { value: 3, normal: [0, 0, -1], axis: [Math.PI / 2, 0, 0] },
  { value: 4, normal: [0, 0, 1], axis: [-Math.PI / 2, 0, 0] },
];

/** The rotation that lands `value` (1–6) face-up on the settled die. */
export function eulerForValue(value: number): [number, number, number] {
  const def = FACE_DEFS.find((f) => f.value === value) ?? FACE_DEFS[0];
  return def.axis;
}
