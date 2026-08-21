"use client";

import { boardIndex } from "@/lib/game/board";
import { tileCurrentValue } from "@/lib/game/engine";
import { BET_MULTIPLIERS } from "@/lib/game/types";
import type { GameState } from "@/lib/game/types";

export default function TileInfoPanel({
  game,
  tileId,
  myPlayerId,
}: {
  game: GameState;
  tileId: string;
  myPlayerId: string | null;
}) {
  const idx = boardIndex(game.boardSize);
  const tile = idx.byId[tileId];
  if (!tile) return null;

  if (
    tile.type === "go" ||
    tile.type === "jail" ||
    tile.type === "exchange_floor" ||
    tile.type === "go_to_jail" ||
    tile.type === "chance" ||
    tile.type === "community"
  ) {
    const description =
      tile.type === "go"
        ? "Pass or land here to collect your salary."
        : tile.type === "jail"
          ? "Just visiting — unless you were sent here, nothing happens."
          : tile.type === "go_to_jail"
            ? "Landing here sends you straight to Jail."
            : tile.type === "exchange_floor"
              ? "Neutral space — nothing happens here."
              : tile.type === "chance"
                ? "Draw a Chance card — bigger swings, good or bad."
                : "Draw a Community card — smaller, steadier outcomes.";
    return (
      <div className="rounded-card border border-white/10 bg-[#181B1F] p-4 text-sm">
        <p className="font-display text-base text-cream">{tile.name}</p>
        <p className="mt-1 text-cream/60">{description}</p>
      </div>
    );
  }

  const ts = game.tileMarket[tileId];
  const currentValue = tileCurrentValue(game, tileId);
  const owner = ts.ownerPlayerId ? game.players[ts.ownerPlayerId] : null;

  return (
    <div className="rounded-card border border-white/10 bg-[#181B1F] p-4 text-sm">
      <p className="font-display text-base text-cream">{tile.name}</p>

      {(tile.type === "property" || tile.type === "estate") && (
        <div className="mt-2 space-y-1 text-cream/70">
          <Row label="Price to buy" value={`$${currentValue}`} />
          <Row label="Build level" value={ts.buildLevel === 5 ? "Hotel" : `${ts.buildLevel ?? 0} house(s)`} />
          <Row
            label="Rent"
            value={`$${Math.round(
              currentValue * tile.rentPercent * [1, 2, 3, 4, 5, 8][ts.buildLevel ?? 0] * (tile.type === "estate" ? 3 : 1)
            )}`}
          />
          <Row label="Owner" value={owner ? owner.username : "Unowned"} />
          {ts.mortgaged && <Row label="Status" value="Mortgaged — no rent due" />}
          {ts.forSalePrice && <Row label="Listed" value={`$${ts.forSalePrice} — anyone can buy`} />}
          {tile.type === "estate" && <Row label="Building value" value="3× normal" />}
        </div>
      )}

      {tile.type === "bond" && (
        <div className="mt-2 space-y-1 text-cream/70">
          <Row label="Price to buy" value={`$${currentValue}`} />
          <Row label="Fixed return" value={`$${tile.baseIncomeRate}/round`} />
          <Row label="Owner" value={owner ? owner.username : "Unowned"} />
        </div>
      )}

      {tile.type === "contract" && (
        <div className="mt-2 space-y-1 text-cream/70">
          <Row label="Price to buy" value={`$${currentValue}`} />
          <Row label="Income" value={`$${tile.baseIncomeRate}/round`} />
          <Row label="Holder" value={owner ? owner.username : "Unowned"} />
          {ts.contractExpiresAtTurn && <Row label="Expires" value={`Turn ${ts.contractExpiresAtTurn}`} />}
        </div>
      )}

      {tile.type === "betting" && (
        <div className="mt-2 space-y-1 text-cream/70">
          <Row label="Price to buy" value={`$${currentValue}`} />
          <Row label="Owner (house)" value={owner ? owner.username : "Unowned"} />
          <Row label="Color" value={`${BET_MULTIPLIERS.color}×`} />
          <Row label="Range" value={`${BET_MULTIPLIERS.range}×`} />
          <Row label="Number" value={`${BET_MULTIPLIERS.number}×`} />
          <Row label="Decline fee" value={`${Math.round(tile.landingFeePercent * 100)}% of value`} />
        </div>
      )}

      {(tile.type === "tech_company" || tile.type === "crypto" || tile.type === "startup") && (
        <div className="mt-2 space-y-1 text-cream/70">
          <Row label="Price to invest" value={`$${currentValue}`} />
          <Row label="Volatility" value={`${Math.round(tile.volatility * 100)}%`} />
          <Row label="Decline fee" value={`${Math.round(tile.landingFeePercent * 100)}% of value`} />
          {myPlayerId && ts.investors[myPlayerId] > 0 && (
            <Row label="Your stake" value={`$${ts.investors[myPlayerId]}`} />
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="text-cream">{value}</span>
    </div>
  );
}
