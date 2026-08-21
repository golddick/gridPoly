"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatMessage } from "@/lib/game/types";

export default function Chat({
  messages,
  players,
  myPlayerId,
  onSend,
}: {
  messages: ChatMessage[];
  players: { id: string; username: string }[];
  myPlayerId: string | null;
  onSend: (message: string, toPlayerId?: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [target, setTarget] = useState<string>("all");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(draft, target === "all" ? undefined : target);
    setDraft("");
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto pr-1 text-xs">
        {messages.length === 0 && <p className="text-cream/30">No messages yet.</p>}
        {messages.map((m) => {
          const isDm = Boolean(m.toPlayerId);
          const isMine = m.fromPlayerId === myPlayerId;
          return (
            <div key={m.id} className={isDm ? "rounded bg-gold/10 px-2 py-1" : ""}>
              <span className={isMine ? "text-gold-highlight" : "text-primary-accent"}>{m.fromUsername}</span>
              {isDm && (
                <span className="ml-1 text-[10px] uppercase tracking-wide text-cream/40">
                  {isMine ? `→ ${players.find((p) => p.id === m.toPlayerId)?.username ?? "DM"}` : "→ you"}
                </span>
              )}
              <span className="text-cream/70">: {m.message}</span>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="mt-2 flex gap-1.5">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="rounded-lg border border-white/10 bg-base px-1.5 py-1.5 text-[11px] text-cream/70"
        >
          <option value="all">Everyone</option>
          {players
            .filter((p) => p.id !== myPlayerId)
            .map((p) => (
              <option key={p.id} value={p.id}>
                DM {p.username}
              </option>
            ))}
        </select>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message…"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-base px-2 py-1.5 text-xs text-cream"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg border border-gold/40 px-2.5 py-1.5 text-xs text-gold-highlight hover:bg-gold/10"
        >
          Send
        </button>
      </form>
    </div>
  );
}
