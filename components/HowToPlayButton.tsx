"use client";

import { useState } from "react";
import Modal from "./ui/Modal";

const STEPS: { title: string; body: string }[] = [
  {
    title: "1. Join or host a table",
    body: "A host sets the starting capital everyone plays with, the board size, the win condition, and the turn timer. Every player joins with the same balance — there's no buy-in, so the table starts on equal footing.",
  },
  {
    title: "2. Roll and land",
    body: "Roll doubles and you go again — three in a row sends you to Jail. Landing on an asset lets you buy it, invest in it, or place a bet, depending on the tile.",
  },
  {
    title: "3. Build a portfolio",
    body: "Property, Contracts, and Bonds are single-owner. Tech, Crypto, and Startups are shared — anyone can invest alongside existing holders. A Betting Company has one owner acting as the house.",
  },
  {
    title: "4. Build houses, feel the market",
    body: "Build houses (and eventually a hotel) on properties you own to raise the rent. Random market events swing whole sectors — a tech boom, a crypto crash — and rent, fees, and payouts always use an asset's live value.",
  },
  {
    title: "5. Chance, Community & Jail",
    body: "Chance and Community tiles draw a card with its own twist — cash, movement, or a trip to Jail. In Jail, pay bail, use a Get Out of Jail Free card, or try to roll doubles to escape.",
  },
  {
    title: "6. Borrow if you need to",
    body: "Take a loan from the Bank, repaid automatically in installments from your passive income. Miss a payment and penalties escalate — higher interest, then forced asset liquidation, then seizure.",
  },
  {
    title: "7. Win the table",
    body: "Depending on the host's settings, the game ends when everyone else is bankrupt, someone hits a net-worth target, or time runs out — highest net worth wins.",
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

      <Modal open={open} onClose={() => setOpen(false)} title="How to play Gride">
        <ol className="space-y-4">
          {STEPS.map((step) => (
            <li key={step.title}>
              <p className="font-display text-base text-gold-highlight">
                {step.title}
              </p>
              <p className="mt-1 text-cream/75">{step.body}</p>
            </li>
          ))}
        </ol>
      </Modal>
    </>
  );
}
