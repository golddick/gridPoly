"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EUROPEAN_WHEEL_ORDER, pocketColor } from "@/lib/game/roulette";

const SEG = 360 / EUROPEAN_WHEEL_ORDER.length; // degrees per pocket
const CENTER = 120;
const OUTER = 112;
const NUMBER_RADIUS = 96;
const EXTRA_SPINS = 6; // full decorative turns before it settles

const FILL: Record<ReturnType<typeof pocketColor>, string> = {
  green: "#1F9D57",
  red: "#C13A3A",
  black: "#1A1D22",
};

function pointAt(angleDeg: number, radius: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  // 0° at the top (12 o'clock), increasing clockwise.
  return [CENTER + radius * Math.sin(rad), CENTER - radius * Math.cos(rad)];
}

/** Pie wedge centered on `centerDeg`, spanning one pocket, from the hub to the rim. */
function wedgePath(centerDeg: number): string {
  const a0 = centerDeg - SEG / 2;
  const a1 = centerDeg + SEG / 2;
  const [x0, y0] = pointAt(a0, OUTER);
  const [x1, y1] = pointAt(a1, OUTER);
  return `M ${CENTER} ${CENTER} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${OUTER} ${OUTER} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

interface RouletteWheelProps {
  /** The authoritative landed pocket (0–36) from the BetRecord. */
  resultPocket: number;
  /** Fired once the wheel finishes settling on `resultPocket`. */
  onSettled?: () => void;
  size?: number;
}

/**
 * A European single-zero roulette wheel that spins to a given pocket. The final
 * resting position is fully determined by `resultPocket`, so the same recorded
 * spin animates identically on every client — only the decorative full turns are
 * cosmetic. Pure SVG + a CSS transform transition, no dependencies.
 */
export default function RouletteWheel({ resultPocket, onSettled, size = 240 }: RouletteWheelProps) {
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const settledRef = useRef(false);

  const wedges = useMemo(
    () =>
      EUROPEAN_WHEEL_ORDER.map((pocket, i) => ({
        pocket,
        center: i * SEG,
        d: wedgePath(i * SEG),
        color: FILL[pocketColor(pocket)],
      })),
    []
  );

  useEffect(() => {
    settledRef.current = false;
    const i = EUROPEAN_WHEEL_ORDER.indexOf(resultPocket);
    if (i < 0) return;
    // Rotation (mod 360) that brings pocket i to the top pointer, then wind on
    // full turns so it always spins forward from wherever it currently rests.
    const rest = (360 - i * SEG) % 360;
    const currentMod = ((rotationRef.current % 360) + 360) % 360;
    const delta = (rest - currentMod + 360) % 360;
    const next = rotationRef.current + delta + 360 * EXTRA_SPINS;
    rotationRef.current = next;
    // Defer so the browser paints the current angle before transitioning.
    const raf = requestAnimationFrame(() => setRotation(next));
    return () => cancelAnimationFrame(raf);
  }, [resultPocket]);

  const landedColor = pocketColor(resultPocket);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox="0 0 240 240" width={size} height={size} role="img" aria-label={`Roulette result: ${resultPocket} ${landedColor}`}>
        <circle cx={CENTER} cy={CENTER} r={OUTER + 6} fill="#0C0E11" stroke="#D4AF37" strokeWidth={3} />
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: "center",
            transition: "transform 4.4s cubic-bezier(0.15, 0.72, 0.11, 1)",
          }}
          onTransitionEnd={(e) => {
            if (e.propertyName === "transform" && !settledRef.current) {
              settledRef.current = true;
              onSettled?.();
            }
          }}
        >
          {wedges.map((w) => (
            <path key={w.pocket} d={w.d} fill={w.color} stroke="#0C0E11" strokeWidth={0.5} />
          ))}
          {wedges.map((w) => {
            const [tx, ty] = pointAt(w.center, NUMBER_RADIUS);
            return (
              <text
                key={`t-${w.pocket}`}
                x={tx}
                y={ty}
                fill="#F2EFE9"
                fontSize={7}
                fontWeight={700}
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${w.center} ${tx.toFixed(2)} ${ty.toFixed(2)})`}
              >
                {w.pocket}
              </text>
            );
          })}
          <circle cx={CENTER} cy={CENTER} r={44} fill="#15181C" stroke="#D4AF37" strokeWidth={2} />
        </g>
        {/* Fixed pointer at the top, marking the winning pocket. */}
        <polygon points="120,6 112,26 128,26" fill="#F0B94A" stroke="#0C0E11" strokeWidth={1} />
      </svg>
    </div>
  );
}
