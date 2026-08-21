"use client";

import { useState } from "react";
import type { GameState, OwnedAssetView, TradeOffer } from "@/lib/game/types";
import Modal from "@/components/ui/Modal";

function TradeRow({ trade, game, onRespond }: { trade: TradeOffer; game: GameState; onRespond: (id: string, accept: boolean) => void }) {
  const from = game.players[trade.fromPlayerId];
  return (
    <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-xs">
      <p className="text-cream">
        <span className="text-gold-highlight">{from.username}</span> offers ${trade.offerCash} + {trade.offerTileIds.length} asset(s) for $
        {trade.requestCash} + {trade.requestTileIds.length} asset(s) of yours.
      </p>
      <div className="mt-2 flex gap-2">
        <button onClick={() => onRespond(trade.id, true)} className="flex-1 rounded-full bg-gold py-1.5 text-xs font-semibold text-base hover:bg-gold-highlight">
          Accept
        </button>
        <button onClick={() => onRespond(trade.id, false)} className="flex-1 rounded-full border border-cream/25 py-1.5 text-xs text-cream hover:border-cream/50">
          Decline
        </button>
      </div>
    </div>
  );
}

export default function TradePanel({
  open,
  onClose,
  game,
  myPlayerId,
  myAssets,
  onPropose,
  onRespond,
}: {
  open: boolean;
  onClose: () => void;
  game: GameState;
  myPlayerId: string;
  myAssets: OwnedAssetView[];
  onPropose: (toPlayerId: string, offerCash: number, offerTileIds: string[], requestCash: number, requestTileIds: string[]) => void;
  onRespond: (tradeId: string, accept: boolean) => void;
}) {
  const otherPlayers = game.playerOrder.filter((pid) => pid !== myPlayerId && game.players[pid].status === "active");
  const [toPlayerId, setToPlayerId] = useState(otherPlayers[0] ?? "");
  const [offerCash, setOfferCash] = useState(0);
  const [requestCash, setRequestCash] = useState(0);
  const [offerTileIds, setOfferTileIds] = useState<string[]>([]);
  const [requestTileIds, setRequestTileIds] = useState<string[]>([]);

  const theirAssets = toPlayerId
    ? Object.entries(game.tileMarket)
        .filter(([, ts]) => ts.ownerPlayerId === toPlayerId)
        .map(([tileId]) => tileId)
    : [];

  const incoming = game.trades.filter((t) => t.status === "pending" && t.toPlayerId === myPlayerId);
  const outgoing = game.trades.filter((t) => t.status === "pending" && t.fromPlayerId === myPlayerId);

  function toggle(list: string[], setList: (v: string[]) => void, tileId: string) {
    setList(list.includes(tileId) ? list.filter((id) => id !== tileId) : [...list, tileId]);
  }

  function submit() {
    if (!toPlayerId) return;
    onPropose(toPlayerId, offerCash, offerTileIds, requestCash, requestTileIds);
    setOfferCash(0);
    setRequestCash(0);
    setOfferTileIds([]);
    setRequestTileIds([]);
  }

  return (
    <Modal open={open} onClose={onClose} title="Trade">
      {incoming.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="text-xs uppercase tracking-wide text-cream/50">Offers for you</p>
          {incoming.map((t) => (
            <TradeRow key={t.id} trade={t} game={game} onRespond={onRespond} />
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="text-xs uppercase tracking-wide text-cream/50">Your pending offers</p>
          {outgoing.map((t) => (
            <div key={t.id} className="rounded-lg border border-white/10 p-2 text-xs text-cream/60">
              Waiting on {game.players[t.toPlayerId]?.username}…
            </div>
          ))}
        </div>
      )}

      <p className="text-xs uppercase tracking-wide text-cream/50">Propose a new trade</p>
      <div className="mt-2 space-y-3">
        <select
          value={toPlayerId}
          onChange={(e) => {
            setToPlayerId(e.target.value);
            setRequestTileIds([]);
          }}
          className="w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
        >
          {otherPlayers.map((pid) => (
            <option key={pid} value={pid}>
              {game.players[pid].username}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-cream/50">You offer ($)</label>
            <input
              type="number"
              value={offerCash}
              onChange={(e) => setOfferCash(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-base px-2 py-1.5 text-sm text-cream"
            />
            <div className="mt-2 max-h-24 space-y-1 overflow-y-auto">
              {myAssets
                .filter((a) => a.isSingleOwner)
                .map((a) => (
                  <label key={a.tileId} className="flex items-center gap-1.5 text-[11px] text-cream/70">
                    <input
                      type="checkbox"
                      checked={offerTileIds.includes(a.tileId)}
                      onChange={() => toggle(offerTileIds, setOfferTileIds, a.tileId)}
                    />
                    {a.name}
                  </label>
                ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-cream/50">You request ($)</label>
            <input
              type="number"
              value={requestCash}
              onChange={(e) => setRequestCash(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-base px-2 py-1.5 text-sm text-cream"
            />
            <div className="mt-2 max-h-24 space-y-1 overflow-y-auto">
              {theirAssets.map((tileId) => (
                <label key={tileId} className="flex items-center gap-1.5 text-[11px] text-cream/70">
                  <input
                    type="checkbox"
                    checked={requestTileIds.includes(tileId)}
                    onChange={() => toggle(requestTileIds, setRequestTileIds, tileId)}
                  />
                  {tileId}
                </label>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!toPlayerId}
          className="w-full rounded-full bg-gold py-2.5 text-sm font-semibold text-base hover:bg-gold-highlight disabled:opacity-40"
        >
          Send offer
        </button>
      </div>
    </Modal>
  );
}
