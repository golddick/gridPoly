"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HowToPlayButton from "@/components/HowToPlayButton";

interface Entry {
  id: string;
  username: string;
  bestNetWorth: number;
  bestNetWorthAt: string | null;
  gamesWon: number;
  gamesPlayed: number;
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => setEntries(data.entries))
      .catch(() => setEntries([]));
  }, []);

  return (
    <main className="min-h-screen bg-base px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        <Link href="/" className="font-display text-lg text-cream">
          GRIDE
        </Link>
        <HowToPlayButton />
      </div>

      <div className="mx-auto mt-8 max-w-2xl">
        <h1 className="font-display text-3xl text-cream">Leaderboard</h1>
        <p className="mt-1 text-sm text-cream/60">
          Highest net worth ever reached, across every room — not tied to any one game.
        </p>

        <div className="mt-6 space-y-2">
          {entries === null && <p className="text-sm text-cream/40">Loading…</p>}
          {entries?.length === 0 && <p className="text-sm text-cream/40">No games finished yet — be the first.</p>}
          {entries?.map((e, i) => (
            <div key={e.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-sm">
              <span className="flex items-center gap-3">
                <span className={`w-6 text-right font-display ${i < 3 ? "text-gold-highlight" : "text-cream/40"}`}>{i + 1}</span>
                <span className="text-cream">{e.username}</span>
              </span>
              <span className="flex items-center gap-4 text-xs text-cream/50">
                <span>
                  {e.gamesWon}/{e.gamesPlayed} won
                </span>
                <span className="text-sm font-semibold text-gold-highlight">${e.bestNetWorth.toLocaleString()}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
