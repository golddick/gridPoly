"use client";

const STORAGE_KEY = "gride:guest";

const ADJECTIVES = ["Sharp", "Bold", "Quiet", "Lucky", "Swift", "Prime", "Steady", "Sly"];
const NOUNS = ["Investor", "Broker", "Trader", "Baron", "Analyst", "Mogul", "Banker", "Founder"];

interface GuestIdentity {
  userId: string;
  username: string;
}

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `guest_${Math.random().toString(36).slice(2, 12)}`;
}

function randomUsername(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a}${n}${Math.floor(Math.random() * 100)}`;
}

/** Returns (and lazily creates) a stable per-browser guest identity. */
export function getGuestIdentity(): GuestIdentity {
  if (typeof window === "undefined") {
    // Server-side render fallback; the real id is created on the client.
    return { userId: "", username: "" };
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through and regenerate
    }
  }
  const identity: GuestIdentity = { userId: randomId(), username: randomUsername() };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}
