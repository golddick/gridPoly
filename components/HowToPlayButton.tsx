"use client";

import { useState } from "react";
import Modal from "./ui/Modal";

type Section = { title: string; body: string; bullets?: string[] };

const SECTIONS: Section[] = [
  {
    title: "1. Join or host a table",
    body: "A host sets the starting capital everyone plays with, the board size, the win condition, and the turn timer. Every player joins with the same balance — there's no buy-in, so the table starts on equal footing. You can add bots to fill empty seats.",
  },
  {
    title: "2. Roll, move, and pass GO",
    body: "On your turn, roll two dice and move that many tiles. Roll doubles and you go again — but three doubles in a row sends you straight to Jail. Each lap past GO pays a $200 salary, with one catch: your opening lap earns nothing, since everyone starts on GO. Salary kicks in from your second pass onward.",
  },
  {
    title: "3. The assets you'll land on",
    body: "Eight kinds of asset sit on the board. Some have a single owner; some are shared. Landing on an unowned asset lets you take it; landing on someone else's usually costs you.",
    bullets: [
      "Property — single owner. Collect rent from anyone who lands on it. Own an entire color group to start building.",
      "Estate — a premium property worth 3× as much: triple the value, triple the rent, triple the build cost.",
      "Bond — single owner, pays a flat, dependable rent. No building, low drama.",
      "Contract — single owner, but contestable: land on someone else's and you can buy it out from under them. Contracts also expire (see below).",
      "Tech, Crypto & Startup — shared ventures with many co-owners. Buy in to join the cap table; land on one you don't hold and you invest or pay a fee to the holders.",
      "Betting Company — one owner runs the house. Everyone else who lands bets against them on the wheel (see below).",
    ],
  },
  {
    title: "4. Rent, houses & mortgages",
    body: "Rent scales with an asset's live value, so market swings move it in real time. Own every tile in a color group and you can build on your properties and estates — up to four houses and then a hotel — multiplying the rent up to 8×. Short on cash? Mortgage an asset to free up money (no rent is due on it while mortgaged); buy it back later for 110% of what you raised.",
  },
  {
    title: "5. Contracts expire",
    body: "A Contract only runs for 15 turns. When it lapses, you choose: pay the upkeep to renew it for another 15 turns, or release it back to the open market. Landing on a rival's Contract lets you buy it out at its current value — they're refunded whatever they originally paid.",
  },
  {
    title: "6. Betting Companies & the wheel",
    body: "Land on a Betting Company you don't own and you can bet against the house on a single-zero roulette wheel (pockets 0–36; 0 is green, and the rest split 18 red / 18 black), or simply pay a landing fee to walk away. Your stake goes to the house up front — win and it pays you back at the multiplier; lose and the house keeps it. The same spin animates for everyone, so the whole table watches the wheel land on the same pocket.",
    bullets: [
      "Color (2×) — call red or black. Green 0 loses every color bet.",
      "Range (3×) — pick a dozen: 1–12, 13–24, or 25–36. Again, 0 loses.",
      "Number (35×) — name the exact pocket, 0 included. The long shot with the big payout.",
    ],
  },
  {
    title: "7. The market moves",
    body: "Random market events swing whole sectors — a tech boom, a crypto crash, a property rally. Because rent, landing fees, and payouts all read an asset's live value, an event can reprice your entire portfolio between one turn and the next.",
  },
  {
    title: "8. Chance, Community & Jail",
    body: "Chance and Community tiles draw a card with its own twist — a windfall, a bill, a move, or a trip to Jail. Once in Jail you can pay bail, spend a Get Out of Jail Free card, or try to roll doubles to break out.",
  },
  {
    title: "9. Loans & staying solvent",
    body: "Need capital? Borrow from the Bank and repay it automatically in installments drawn from your passive income. Miss payments and the penalties escalate — higher interest first, then forced asset liquidation, then outright seizure. A Betting Company owner who can't cover a big payout is handed an emergency loan on the spot.",
  },
  {
    title: "10. Trade, auction & outbid",
    body: "Deal directly with rivals: propose trades of assets and cash to build a monopoly or raise quick funds. Decline to buy an unowned asset and it can go to auction, where everyone bids and the highest offer wins. And remember — Contracts can always be outbid by whoever lands on them next.",
  },
  {
    title: "11. Win the table",
    body: "Depending on the host's settings, the game ends when everyone else is bankrupt, when someone reaches a net-worth target, or when the clock runs out. When it's over, the highest net worth takes the table.",
  },
];

export default function HowToPlayButton({
  className = "",
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How to play"
        title="How to play"
        className={`group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gradient-to-b from-gold/20 to-transparent text-gold transition hover:border-gold hover:bg-gold/10 hover:text-gold-highlight focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${className}`}
      >
        <span className="font-display text-lg leading-none">?</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="How to play Gride" size="xl">
        <ol className="space-y-5">
          {SECTIONS.map((section) => (
            <li key={section.title}>
              <p className="font-display text-base text-gold-highlight">
                {section.title}
              </p>
              <p className="mt-1 text-cream/75">{section.body}</p>
              {section.bullets && (
                <ul className="mt-2 space-y-1.5 border-l border-white/10 pl-4">
                  {section.bullets.map((b) => (
                    <li key={b} className="text-cream/70">
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </Modal>
    </>
  );
}
