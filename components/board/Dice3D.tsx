"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

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

// Face normal -> [rotation to bring that face to +Y (up), pip value shown on that face]
const FACE_DEFS: { axis: [number, number, number]; normal: THREE.Vector3; value: number }[] = [
  { axis: [0, 0, 0], normal: new THREE.Vector3(0, 1, 0), value: 2 },
  { axis: [Math.PI, 0, 0], normal: new THREE.Vector3(0, -1, 0), value: 5 },
  { axis: [0, 0, Math.PI / 2], normal: new THREE.Vector3(-1, 0, 0), value: 1 },
  { axis: [0, 0, -Math.PI / 2], normal: new THREE.Vector3(1, 0, 0), value: 6 },
  { axis: [Math.PI / 2, 0, 0], normal: new THREE.Vector3(0, 0, -1), value: 3 },
  { axis: [-Math.PI / 2, 0, 0], normal: new THREE.Vector3(0, 0, 1), value: 4 },
];

function eulerForValue(value: number): [number, number, number] {
  const def = FACE_DEFS.find((f) => f.value === value) ?? FACE_DEFS[0];
  return def.axis;
}

function Pips({ value }: { value: number }) {
  const size = 0.62;
  return (
    <group>
      {FACE_DEFS.map((face) => (
        <group key={face.value} position={face.normal.clone().multiplyScalar(size / 2)}>
          {PIP_PATTERNS[face.value].map(([px, py], i) => {
            // Orient each pip cluster to sit flush on its face.
            const n = face.normal;
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
      ))}
    </group>
  );
}

function Die({ targetValue, rolling, delay, color }: { targetValue: number; rolling: boolean; delay: number; color: string }) {
  const ref = useRef<THREE.Group>(null);
  const spin = useRef(new THREE.Vector3(7 + Math.random() * 3, 9 + Math.random() * 3, 5 + Math.random() * 3));
  const startedAt = useRef<number | null>(null);
  const settled = useRef(false);

  useEffect(() => {
    if (rolling) {
      startedAt.current = performance.now() + delay * 1000;
      settled.current = false;
      spin.current.set(7 + Math.random() * 3, 9 + Math.random() * 3, 5 + Math.random() * 3);
    }
  }, [rolling, delay, targetValue]);

  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    if (!rolling || settled.current) return;

    const now = performance.now();
    if (startedAt.current === null || now < startedAt.current) return;

    const elapsed = (now - startedAt.current) / 1000;
    const duration = 0.9;

    if (elapsed < duration) {
      g.rotation.x += spin.current.x * 0.02;
      g.rotation.y += spin.current.y * 0.02;
      g.rotation.z += spin.current.z * 0.02;
    } else {
      const [tx, ty, tz] = eulerForValue(targetValue);
      g.rotation.set(tx, ty, tz);
      settled.current = true;
    }
  });

  return (
    <group ref={ref}>
      <mesh castShadow>
        <boxGeometry args={[0.62, 0.62, 0.62]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.05} />
      </mesh>
      <Pips value={targetValue} />
    </group>
  );
}

/**
 * Two animated dice rendered inside the R3F canvas. `rollId` changes every
 * time the server records a new roll — that change triggers the spin, which
 * settles on the authoritative d1/d2 values.
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
  const [rolling, setRolling] = useState(false);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (rollId && rollId !== lastId.current) {
      lastId.current = rollId;
      setRolling(true);
      const t = setTimeout(() => setRolling(false), 1300);
      return () => clearTimeout(t);
    }
  }, [rollId]);

  if (!rollId) return null;

  return (
    <group position={position}>
      <group position={[-0.5, 0, 0]}>
        <Die targetValue={d1} rolling={rolling} delay={0} color="#F2EFE9" />
      </group>
      <group position={[0.5, 0, 0]}>
        <Die targetValue={d2} rolling={rolling} delay={0.1} color="#F2EFE9" />
      </group>
    </group>
  );
}
