import dynamic from "next/dynamic";
import Link from "next/link";
import HowToPlayButton from "@/components/HowToPlayButton";

const Board3D = dynamic(() => import("@/components/board/Board3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-cream/40">
      Loading board…
    </div>
  ),
});

const ASSET_CLASSES: {
  name: string;
  risk: string;
  color: string;
  note: string;
}[] = [
  { name: "Property", risk: "Low", color: "bg-primary", note: "Appreciates, classic rent-on-landing." },
  { name: "Bonds", risk: "Low", color: "bg-primary", note: "Steady, low return." },
  { name: "Contracts", risk: "Medium", color: "bg-gold", note: "Recurring income — can be outbid mid-game." },
  { name: "Tech Companies", risk: "Medium", color: "bg-volatile", note: "Share-based, performance-tied, dilutable." },
  { name: "Crypto", risk: "High", color: "bg-volatile", note: "Swings hard on market events." },
  { name: "Startups", risk: "High", color: "bg-volatile", note: "Cheap in, can multiply or collapse to zero." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-base">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl tracking-wide text-cream">
          GRIDPOLY
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/leaderboard"
            className="rounded-full border border-cream/20 px-4 py-2 text-sm text-cream/80 transition hover:border-cream/40 hover:text-cream"
          >
            Leaderboard
          </Link>
          <HowToPlayButton />
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 pb-16 pt-6 lg:grid-cols-2 lg:gap-6">
        <div>
          <p className="mb-4 inline-block rounded-full border border-gold/30 px-3 py-1 text-xs uppercase tracking-[0.2em] text-gold-highlight">
            Live multiplayer · demo currency
          </p>
          <h1 className="text-balance font-display text-5xl leading-[1.05] text-cream sm:text-6xl">
            Build a fortune.
            <br />
            <span className="text-gold-highlight">Or lose one trying.</span>
          </h1>
          <p className="mt-6 max-w-md text-balance text-base leading-relaxed text-cream/70">
            GridPoly is a real-time investment board game. Roll, buy, borrow, and
            out-invest the table across property, tech, contracts, crypto, and
            startups — no player-funded buy-in, just equal starting capital
            and nerve.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/lobby"
              className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-base transition hover:bg-gold-highlight"
            >
              Create a room
            </Link>
            <Link
              href="/lobby"
              className="rounded-full border border-cream/25 px-6 py-3 text-sm font-semibold text-cream transition hover:border-cream/50"
            >
              Join with a code
            </Link>
          </div>
        </div>

        <div className="h-80 overflow-hidden rounded-card border border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent sm:h-96 lg:h-[28rem]">
          <Board3D />
        </div>
      </section>

      {/* Asset classes */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-display text-2xl text-cream">
          Six ways to grow — or gamble — your stack
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ASSET_CLASSES.map((asset) => (
            <div
              key={asset.name}
              className="rounded-card border border-white/10 bg-white/[0.02] p-5"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${asset.color}`} />
                <span className="font-display text-lg text-cream">
                  {asset.name}
                </span>
                <span className="ml-auto text-xs uppercase tracking-wide text-cream/40">
                  {asset.risk} risk
                </span>
              </div>
              <p className="mt-2 text-sm text-cream/60">{asset.note}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 py-8">
        <p className="mx-auto max-w-6xl px-6 text-xs text-cream/40">
          Gride — demo currency only. Not a gambling product.
        </p>
      </footer>
    </main>
  );
}
