"use client";

import { useEffect, useState } from "react";

/** A live countdown to `deadline` (epoch ms), driven by the server's authoritative timer — this only renders it, never decides it. */
export default function TurnTimer({ deadline, urgentBelow = 10 }: { deadline: number | null; urgentBelow?: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);

  if (!deadline) return null;

  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000));
  const urgent = secondsLeft <= urgentBelow;

  return (
    <span
      className={`rounded-full border px-2.5 py-1 font-mono text-xs tabular-nums ${
        urgent ? "border-danger/50 bg-danger/10 text-danger" : "border-white/10 text-cream/60"
      }`}
      title="Time left for the current action"
    >
      {secondsLeft}s
    </span>
  );
}
