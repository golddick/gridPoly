"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FACE_DEFS, eulerForValue } from "@/lib/game/diceFaces";

// Pip layout on a 3x3 grid, values are [x, y] offsets in face-local space.
const PIP_PATTERNS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [
    [-0.16, 0.16],
    [0.16, -0.16],
  ],
  3: [
    [-0.16, 0.16],
    [0, 0],
    [0.16, -0.16],
  ],
  4: [
    [-0.16, 0.16],
    [0.16, 0.16],
    [-0.16, -0.16],
    [0.16, -0.16],
  ],
  5: [
    [-0.16, 0.16],
    [0.16, 0.16],
    [0, 0],
    [-0.16, -0.16],
    [0.16, -0.16],
  ],
  6: [
    [-0.16, 0.16],
    [0.16, 0.16],
    [-0.16, 0],
    [0.16, 0],
    [-0.16, -0.16],
    [0.16, -0.16],
  ],
};

// The die's face table (which value sits on which face, and the rotation that
// brings it face-up) lives in lib/game/diceFaces.ts so it can be unit-tested
// without pulling in three.js / R3F. See diceFaces.test.ts for the +Y invariant.

function Pips() {
  const size = 0.62;
  return (
    <group>
      {FACE_DEFS.map((face) => {
        // Rebuild the face normal as a vector for the pip-placement math.
        const n = new THREE.Vector3(...face.normal);
        return (
          <group key={face.value} position={[n.x * (size / 2), n.y * (size / 2), n.z * (size / 2)]}>
            {PIP_PATTERNS[face.value].map(([px, py], i) => {
              // Orient each pip cluster to sit flush on its face.
              const up = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
              const right = new THREE.Vector3().crossVectors(up, n).normalize();
              const trueUp = new THREE.Vector3().crossVectors(n, right).normalize();
              const pos = right.clone().multiplyScalar(px).add(trueUp.clone().multiplyScalar(py));
              return (
                <mesh key={i} position={[pos.x, pos.y, pos.z]}>
                  <sphereGeometry args={[0.045, 10, 10]} />
                  <meshStandardMaterial color="#1a1d21" roughness={0.4} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

function Die({ rollId, targetValue, delay, color }: { rollId: string; targetValue: number; delay: number; color: string }) {
  const ref = useRef<THREE.Group>(null);
  const angVel = useRef(new THREE.Vector3());
  const startAt = useRef<number | null>(null);
  const settleFrom = useRef<THREE.Quaternion | null>(null);
  const settleTo = useRef(new THREE.Quaternion());
  const done = useRef(false);

  const SPIN_MS = 750; // free tumble
  const SETTLE_MS = 600; // eased deceleration onto the final face

  // A fresh rollId (or a changed target) restarts the throw: pick a new random
  // tumble velocity and precompute the orientation that lands `targetValue` on top.
  useEffect(() => {
    startAt.current = performance.now() + delay * 1000;
    settleFrom.current = null;
    done.current = false;
    const rand = () => (6 + Math.random() * 6) * (Math.random() < 0.5 ? -1 : 1);
    angVel.current.set(rand(), rand(), rand());
    const [tx, ty, tz] = eulerForValue(targetValue);
    settleTo.current.setFromEuler(new THREE.Euler(tx, ty, tz));
  }, [rollId, targetValue, delay]);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g || startAt.current === null || done.current) return;

    const now = performance.now();
    if (now < startAt.current) return; // still in the per-die stagger delay
    const elapsed = now - startAt.current;

    if (elapsed < SPIN_MS) {
      // Free tumble — multiplied by delta so the spin speed is frame-rate independent.
      g.rotation.x += angVel.current.x * delta;
      g.rotation.y += angVel.current.y * delta;
      g.rotation.z += angVel.current.z * delta;
      return;
    }

    // Decelerate onto the exact target face with an ease-out cubic slerp, so the
    // die glides to a stop instead of snapping. Capture where the tumble left off.
    if (!settleFrom.current) settleFrom.current = g.quaternion.clone();
    const t = Math.min(1, (elapsed - SPIN_MS) / SETTLE_MS);
    const eased = 1 - Math.pow(1 - t, 3);
    g.quaternion.slerpQuaternions(settleFrom.current, settleTo.current, eased);
    if (t >= 1) {
      g.quaternion.copy(settleTo.current); // pin exactly on the face, then rest
      done.current = true;
    }
  });

  return (
    <group ref={ref}>
      <mesh castShadow>
        <boxGeometry args={[0.62, 0.62, 0.62]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.05} />
      </mesh>
      <Pips />
    </group>
  );
}

/**
 * Two animated dice rendered inside the R3F canvas. `rollId` changes every
 * time the server records a new roll — that change restarts each die's tumble,
 * which decelerates smoothly onto the authoritative d1/d2 value (face-up).
 */
export default function Dice3D({
  rollId,
  d1,
  d2,
  position = [0, 1.1, 0],
}: {
  rollId: string | null;
  d1: number;
  d2: number;
  position?: [number, number, number];
}) {
  if (!rollId) return null;

  return (
    <group position={position}>
      <group position={[-0.5, 0, 0]}>
        <Die rollId={rollId} targetValue={d1} delay={0} color="#F2EFE9" />
      </group>
      <group position={[0.5, 0, 0]}>
        <Die rollId={rollId} targetValue={d2} delay={0.08} color="#F2EFE9" />
      </group>
    </group>
  );
}
