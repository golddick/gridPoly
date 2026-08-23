"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import HowToPlayButton from "@/components/HowToPlayButton";
import Modal from "@/components/ui/Modal";
import TileInfoPanel from "@/components/TileInfoPanel";
import Chat from "@/components/Chat";
import TradePanel from "@/components/TradePanel";
import PieceSelector from "@/components/PieceSelector";
import TurnTimer from "@/components/TurnTimer";
import { useGameStore } from "@/lib/store";
import { normalizeRoomCode } from "@/lib/roomCode";
import { boardIndex } from "@/lib/game/board";
import { getPlayerAssets, getColorGroupStatus } from "@/lib/game/engine";
import { BET_MULTIPLIERS, type BetType } from "@/lib/game/types";
import { useGridAuth } from "@/lib/auth";

const Board3D = dynamic(() => import("@/components/board/Board3D"), { ssr: false });

const ASSET_DOT: Record<string, string> = {
  property: "bg-primary",
  estate: "bg-gold",
  bond: "bg-primary-accent",
  contract: "bg-gold",
  betting: "bg-danger",
  tech_company: "bg-volatile",
  crypto: "bg-volatile",
  startup: "bg-volatile",
};

export default function RoomPage({ params }: { params: { roomId: string } }) {
  const roomId = normalizeRoomCode(params.roomId);
  const { userId, loading: authLoading } = useGridAuth();
  const {
    join,
    leave,
    choosePiece,
    start,
    endGame,
    roll,
    buyDecision,
    outbidDecision,
    investDecision,
    betDecision,
    renewDecision,
    takeLoan,
    endTurn,
    payBail,
    useJailCard,
    attemptJailRoll,
    build,
    mortgage,
    unmortgage,
    listForSale,
    cancelListing,
    buyListed,
    auctionBid,
    auctionPass,
    proposeTrade,
    respondTrade,
    sendChat,
    snapshot,
    myPlayerId,
    chatMessages,
    error,
  } = useGameStore();

  const [loanInput, setLoanInput] = useState(500);
  const [dismissedEventId, setDismissedEventId] = useState<string | null>(null);
  const [dismissedCardId, setDismissedCardId] = useState<string | null>(null);
  const [hoveredTileId, setHoveredTileId] = useState<string | null>(null);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [betType, setBetType] = useState<BetType>("color");
  const [stakeInput, setStakeInput] = useState(100);
  const [chatOpen, setChatOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [listPriceInput, setListPriceInput] = useState<Record<string, number>>({});
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [auctionBidInput, setAuctionBidInput] = useState(0);
  const [dismissedTradeNoticeId, setDismissedTradeNoticeId] = useState<string | null>(null);
  const [dismissedChatNoticeId, setDismissedChatNoticeId] = useState<string | null>(null);
  const [endGameConfirmOpen, setEndGameConfirmOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    join(roomId, userId, selectedPieceId ?? undefined);
    return () => leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId]);

  const game = snapshot?.game ?? null;
  const isHost = snapshot && userId === snapshot.hostUserId;
  const isMyTurn = game && myPlayerId && game.playerOrder[game.currentPlayerIndex] === myPlayerId;
  const me = game && myPlayerId ? game.players[myPlayerId] : null;
  const myAssets = useMemo(() => (game && myPlayerId ? getPlayerAssets(game, myPlayerId) : []), [game, myPlayerId]);

  const latestEvent = game?.marketEvents[game.marketEvents.length - 1] ?? null;
  const showEventModal = Boolean(latestEvent && latestEvent.id !== dismissedEventId);

  const latestCard = game?.cardDraws[game.cardDraws.length - 1] ?? null;
  const showCardModal = Boolean(latestCard && latestCard.id !== dismissedCardId && latestCard.playerId === myPlayerId);

  const pending = game?.pendingDecision;
  const pendingIsMine = pending && pending.playerId === myPlayerId;
  const idx = game ? boardIndex(game.boardSize) : null;
  const pendingTile = pending && idx ? idx.byId[pending.tileId] : null;
  const infoTileId = selectedTileId ?? hoveredTileId;

  const auction = game?.auction;
  const auctionTile = auction && idx ? idx.byId[auction.tileId] : null;
  const isMyAuctionTurn = auction && auction.currentTurnPlayerId === myPlayerId;

  const unreadDms = chatMessages.filter((m) => m.toPlayerId === myPlayerId).length;

  const incomingTrade = game?.trades.find((t) => t.status === "pending" && t.toPlayerId === myPlayerId) ?? null;
  const showTradeNotice = Boolean(incomingTrade && incomingTrade.id !== dismissedTradeNoticeId && !tradeOpen);

  const latestIncomingChat = [...chatMessages].reverse().find((m) => m.toPlayerId === myPlayerId && m.fromPlayerId !== myPlayerId) ?? null;
  const showChatNotice = Boolean(latestIncomingChat && latestIncomingChat.id !== dismissedChatNoticeId && !chatOpen);

  if (authLoading || !userId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-base">
        <p className="text-sm text-cream/50">Signing in…</p>
      </main>
    );
  }

  if (!game || snapshot?.status === "waiting") {
    const takenPieces = (snapshot?.waitingPlayers ?? []).filter((p) => p.userId !== userId).map((p) => p.pieceId);
    const myWaiting = snapshot?.waitingPlayers.find((p) => p.userId === userId);

    return (
      <main className="min-h-screen bg-base px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Link href="/" className="font-display text-lg text-cream">
            GRIDE
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/leaderboard" className="text-xs text-cream/50 hover:text-cream">
              Leaderboard
            </Link>
            <HowToPlayButton />
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-xl rounded-card border border-white/10 bg-white/[0.02] p-6 sm:p-8">
          <h1 className="font-display text-2xl text-cream">Waiting room</h1>
          <p className="mt-1 text-sm text-cream/60">Share this code so others can join:</p>

          <div className="mt-3 flex items-center gap-2">
            <span className="flex-1 rounded-lg border border-gold/40 bg-gold/5 py-3 text-center font-mono text-2xl tracking-[0.3em] text-gold-highlight">
              {roomId}
            </span>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(roomId)}
              className="shrink-0 rounded-full border border-cream/25 px-4 py-3 text-xs text-cream hover:border-cream/50"
            >
              Copy
            </button>
          </div>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <ul className="mt-6 space-y-2">
            {(snapshot?.waitingPlayers ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-2 text-sm text-cream">
                <span>{p.username}</span>
                {p.userId === snapshot?.hostUserId && <span className="text-xs uppercase tracking-wide text-gold-highlight">Host</span>}
              </li>
            ))}
            {(!snapshot || snapshot.waitingPlayers.length === 0) && <li className="text-sm text-cream/40">Connecting…</li>}
          </ul>

          <div className="mt-6">
            <PieceSelector
              selectedPieceId={selectedPieceId ?? myWaiting?.pieceId ?? null}
              takenPieceIds={takenPieces}
              onSelect={(pieceId) => {
                setSelectedPieceId(pieceId);
                choosePiece(pieceId);
              }}
            />
          </div>

          {isHost && (
            <button
              onClick={start}
              disabled={(snapshot?.waitingPlayers.length ?? 0) < 1}
              className="mt-8 w-full rounded-full bg-gold py-3 text-sm font-semibold text-base transition hover:bg-gold-highlight disabled:opacity-50"
            >
              Start game
            </button>
          )}
          {!isHost && <p className="mt-8 text-center text-sm text-cream/40">Waiting for the host to start…</p>}
        </div>
      </main>
    );
  }

  if (game.status === "ended") {
    const ranked = [...game.playerOrder].map((pid) => game.players[pid]).sort((a, b) => b.netWorth - a.netWorth);

    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-base px-6 py-10 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-gold-highlight">Game over</p>
        <h1 className="mt-3 font-display text-4xl text-cream">
          {game.winnerId ? `${game.players[game.winnerId].username} wins` : "No winner"}
        </h1>
        <p className="mt-2 text-sm text-cream/60">{game.endedReason}</p>

        <div className="mt-8 w-full max-w-md space-y-2">
          {ranked.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3 text-sm">
              <span className="text-cream">
                {i + 1}. {p.username}
              </span>
              <span className="text-gold-highlight">${p.netWorth.toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 flex gap-3">
          <a href="/lobby" className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-base hover:bg-gold-highlight">
            New game
          </a>
          <a href="/leaderboard" className="rounded-full border border-cream/25 px-6 py-3 text-sm text-cream hover:border-cream/50">
            Leaderboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-base">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
        <div>
          <span className="font-display text-base text-cream sm:text-lg">GRIDE</span>
          <span className="ml-2 text-xs text-cream/40 sm:ml-3">Turn {game.turnNumber}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span className={`text-xs sm:text-sm ${isMyTurn ? "font-semibold text-gold-highlight" : "text-cream/70"}`}>
            {isMyTurn ? "Your turn" : `${game.players[game.playerOrder[game.currentPlayerIndex]].username}'s turn`}
          </span>
          <TurnTimer deadline={snapshot?.actionDeadline ?? null} />
          <button onClick={() => setTradeOpen(true)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-cream/70 hover:border-white/25">
            Trade
          </button>
          <button onClick={() => setChatOpen(true)} className="relative rounded-full border border-white/10 px-3 py-1.5 text-xs text-cream/70 hover:border-white/25">
            Chat
            {unreadDms > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-danger" />}
          </button>
          <Link href="/leaderboard" className="hidden text-xs text-cream/50 hover:text-cream sm:inline">
            Leaderboard
          </Link>
          {isHost && (
            <button
              onClick={() => setEndGameConfirmOpen(true)}
              className="rounded-full border border-danger/40 px-3 py-1.5 text-xs text-danger hover:bg-danger/10"
            >
              End game
            </button>
          )}
          <HowToPlayButton />
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
        <section className="relative min-h-[360px] sm:min-h-[420px]">
          <Board3D
            game={game}
            onHoverTile={setHoveredTileId}
            onSelectTile={(id) => setSelectedTileId((cur) => (cur === id ? null : id))}
          />
          {infoTileId && (
            <>
              {/* Desktop: floating panel near the cursor/selection */}
              <div className="pointer-events-none absolute bottom-4 left-4 hidden w-64 sm:block">
                <TileInfoPanel game={game} tileId={infoTileId} myPlayerId={myPlayerId} />
              </div>
              {/* Mobile: bottom sheet, since hover doesn't exist on touch */}
              <div className="absolute inset-x-0 bottom-0 sm:hidden">
                <div className="mx-2 mb-2">
                  <TileInfoPanel game={game} tileId={infoTileId} myPlayerId={myPlayerId} />
                </div>
              </div>
            </>
          )}
        </section>

        <aside className="space-y-5 border-t border-white/10 bg-white/[0.02] p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div>
            <h2 className="font-display text-lg text-cream">Your position</h2>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between rounded-lg border border-white/10 p-3">
                <span className="text-cream/60">Cash</span>
                <span className="text-gold-highlight">${me?.inGameBalance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between rounded-lg border border-white/10 p-3">
                <span className="text-cream/60">Net worth</span>
                <span className="text-primary-accent">${me?.netWorth.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wide text-cream/50">Portfolio</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {myAssets.length ? (
                myAssets.map((a) => (
                  <li key={a.tileId} className="rounded-lg border border-white/10 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-cream/80">
                        <span className={`h-2 w-2 rounded-full ${ASSET_DOT[a.type]}`} />
                        {a.name}
                        {!a.isSingleOwner && <span className="text-cream/40">({Math.round(a.ownershipPercent)}%)</span>}
                        {a.mortgaged && <span className="text-[10px] uppercase text-danger">Mortgaged</span>}
                      </span>
                      <span className={a.profitLoss >= 0 ? "text-primary-accent" : "text-danger"}>
                        ${a.currentShareValue.toLocaleString()}
                      </span>
                    </div>
                    {a.isSingleOwner && isMyTurn && !pending && !auction && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {(a.type === "property" || a.type === "estate") && (a.buildLevel ?? 0) < 5 && !a.mortgaged && (() => {
                          const groupStatus = getColorGroupStatus(game, a.tileId, myPlayerId);
                          const canBuild = !groupStatus || groupStatus.ownsAll;
                          return canBuild ? (
                            <button onClick={() => build(a.tileId)} className="rounded border border-gold/40 px-1.5 py-0.5 text-[10px] text-gold-highlight hover:bg-gold/10">
                              Build
                            </button>
                          ) : (
                            <span
                              className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-cream/40"
                              title="Own every property in this color group first"
                            >
                              Need {groupStatus.total - groupStatus.ownedByPlayer} more of set to build
                            </span>
                          );
                        })()}
                        {!a.mortgaged ? (
                          <button onClick={() => mortgage(a.tileId)} className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-cream/60 hover:border-white/30">
                            Mortgage
                          </button>
                        ) : (
                          <button onClick={() => unmortgage(a.tileId)} className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-cream/60 hover:border-white/30">
                            Unmortgage
                          </button>
                        )}
                        {a.forSalePrice ? (
                          <button onClick={() => cancelListing(a.tileId)} className="rounded border border-danger/40 px-1.5 py-0.5 text-[10px] text-danger hover:bg-danger/10">
                            Cancel listing (${a.forSalePrice})
                          </button>
                        ) : (
                          <span className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="Ask $"
                              value={listPriceInput[a.tileId] ?? ""}
                              onChange={(e) => setListPriceInput((s) => ({ ...s, [a.tileId]: Number(e.target.value) }))}
                              className="w-16 rounded border border-white/15 bg-base px-1 py-0.5 text-[10px] text-cream"
                            />
                            <button
                              onClick={() => listForSale(a.tileId, listPriceInput[a.tileId] || a.currentShareValue)}
                              className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-cream/60 hover:border-white/30"
                            >
                              List
                            </button>
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                ))
              ) : (
                <li className="text-cream/40">No assets yet</li>
              )}
            </ul>
          </div>

          {game.playerOrder.some((pid) =>
            Object.values(game.tileMarket).some((ts) => ts.ownerPlayerId === pid && pid !== myPlayerId && ts.forSalePrice)
          ) && (
            <div>
              <h3 className="text-xs uppercase tracking-wide text-cream/50">On the market</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {Object.entries(game.tileMarket)
                  .filter(([, ts]) => ts.forSalePrice && ts.ownerPlayerId !== myPlayerId)
                  .map(([tileId, ts]) => (
                    <li key={tileId} className="flex items-center justify-between">
                      <span className="text-cream/70">{idx?.byId[tileId]?.name}</span>
                      <button onClick={() => buyListed(tileId)} className="rounded border border-gold/40 px-2 py-0.5 text-[10px] text-gold-highlight hover:bg-gold/10">
                        Buy ${ts.forSalePrice}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-xs uppercase tracking-wide text-cream/50">Loans</h3>
            {me?.loans.filter((l) => l.status === "active").length ? (
              <ul className="mt-2 space-y-1.5 text-sm">
                {me.loans
                  .filter((l) => l.status === "active")
                  .map((l) => (
                    <li key={l.id} className="flex items-center justify-between">
                      <span className="text-cream/80">${l.installmentAmount}/installment</span>
                      <span className="text-cream/60">{l.installmentsRemaining} left</span>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-cream/40">None active</p>
            )}
            {isMyTurn && (
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  value={loanInput}
                  onChange={(e) => setLoanInput(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-base px-2 py-1.5 text-sm text-cream"
                />
                <button onClick={() => takeLoan(loanInput)} className="shrink-0 rounded-lg border border-gold/40 px-3 py-1.5 text-xs text-gold-highlight hover:bg-gold/10">
                  Borrow
                </button>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs uppercase tracking-wide text-cream/50">Activity</h3>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-cream/50">
              {[...game.log].reverse().slice(0, 12).map((entry, i) => (
                <li key={i}>{entry.message}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <footer className="flex items-center justify-between border-t border-white/10 px-4 py-3 sm:px-6 sm:py-4">
        <span className="text-xs text-cream/40">
          {me?.status === "bankrupt"
            ? "You're out — spectating"
            : me?.inJail
              ? `In Jail — attempt ${me.jailTurns}/3`
              : me?.doublesStreak
                ? "Doubles! Roll again."
                : ""}
        </span>
        <div className="flex gap-2">
          {isMyTurn && me?.inJail ? (
            <>
              <button onClick={payBail} disabled={Boolean(pending) || (me?.inGameBalance ?? 0) < 50} className="rounded-full border border-cream/25 px-3 py-2 text-xs text-cream hover:border-cream/50 disabled:opacity-40 sm:px-4 sm:text-sm">
                Pay $50 bail
              </button>
              {me.getOutOfJailFreeCards > 0 && (
                <button onClick={useJailCard} disabled={Boolean(pending)} className="rounded-full border border-gold/40 px-3 py-2 text-xs text-gold-highlight hover:bg-gold/10 disabled:opacity-40 sm:px-4 sm:text-sm">
                  Use card
                </button>
              )}
              <button onClick={attemptJailRoll} disabled={Boolean(pending) || me.hasRolledThisTurn} className="rounded-full bg-gold px-3 py-2 text-xs font-semibold text-base hover:bg-gold-highlight disabled:opacity-40 sm:px-4 sm:text-sm">
                Roll
              </button>
              <button onClick={endTurn} disabled={!me.hasRolledThisTurn || Boolean(pending)} className="rounded-full border border-cream/25 px-3 py-2 text-xs text-cream hover:border-cream/50 disabled:opacity-40 sm:px-4 sm:text-sm">
                End turn
              </button>
            </>
          ) : (
            <>
              <button onClick={roll} disabled={!isMyTurn || Boolean(pending) || Boolean(auction) || Boolean(me?.hasRolledThisTurn)} className="rounded-full border border-cream/25 px-3 py-2 text-xs text-cream hover:border-cream/50 disabled:opacity-40 sm:px-4 sm:text-sm">
                Roll
              </button>
              <button onClick={endTurn} disabled={!isMyTurn || Boolean(pending) || Boolean(auction)} className="rounded-full bg-gold px-3 py-2 text-xs font-semibold text-base hover:bg-gold-highlight disabled:opacity-40 sm:px-4 sm:text-sm">
                End turn
              </button>
            </>
          )}
        </div>
      </footer>

      <Modal open={Boolean(pendingIsMine && pending?.kind === "buy_or_skip")} onClose={() => buyDecision(false)} title={pendingTile ? `Buy ${pendingTile.name}?` : "Buy?"}>
        <p>
          Price: <span className="text-gold-highlight">${pending?.price}</span>. You have ${me?.inGameBalance.toLocaleString()}.
        </p>
        <p className="mt-1 text-xs text-cream/40">Passing sends it to a live auction among everyone at the table.</p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => buyDecision(true)} className="flex-1 rounded-full bg-gold py-2.5 text-sm font-semibold text-base hover:bg-gold-highlight">
            Buy now
          </button>
          <button onClick={() => buyDecision(false)} className="flex-1 rounded-full border border-cream/25 py-2.5 text-sm text-cream hover:border-cream/50">
            Auction it
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(pendingIsMine && pending?.kind === "outbid_or_skip")} onClose={() => outbidDecision(false)} title={pendingTile ? `Buy out ${pendingTile.name}?` : "Outbid?"}>
        <p>
          Currently held by <span className="text-gold-highlight">{pending?.currentOwnerPlayerId ? game.players[pending.currentOwnerPlayerId]?.username : ""}</span>. Taking it costs{" "}
          <span className="text-gold-highlight">${pending?.price}</span> — they're refunded what they originally paid.
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => outbidDecision(true)} className="flex-1 rounded-full bg-gold py-2.5 text-sm font-semibold text-base hover:bg-gold-highlight">
            Buy out
          </button>
          <button onClick={() => outbidDecision(false)} className="flex-1 rounded-full border border-cream/25 py-2.5 text-sm text-cream hover:border-cream/50">
            Let it go
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(pendingIsMine && pending?.kind === "invest_or_fee")} onClose={() => investDecision(false)} title={pendingTile ? `Invest in ${pendingTile.name}?` : "Invest?"}>
        <p>
          Invest <span className="text-gold-highlight">${pending?.price}</span> to become a co-owner, or pay a{" "}
          <span className="text-gold-highlight">${pending?.landingFee}</span> landing fee to existing investors instead.
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => investDecision(true)} className="flex-1 rounded-full bg-gold py-2.5 text-sm font-semibold text-base hover:bg-gold-highlight">
            Invest
          </button>
          <button onClick={() => investDecision(false)} className="flex-1 rounded-full border border-cream/25 py-2.5 text-sm text-cream hover:border-cream/50">
            Pay fee
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(pendingIsMine && pending?.kind === "bet_or_fee")} onClose={() => betDecision("fee")} title={pendingTile ? `${pendingTile.name}` : "Betting Company"}>
        <p className="mb-4">
          Owned by <span className="text-gold-highlight">{pending?.currentOwnerPlayerId ? game.players[pending.currentOwnerPlayerId]?.username : ""}</span>. Place a bet, or pay a{" "}
          <span className="text-gold-highlight">${pending?.landingFee}</span> landing fee to skip it.
        </p>
        <div className="space-y-3">
          <div className="flex gap-2">
            {(Object.keys(BET_MULTIPLIERS) as BetType[]).map((t) => (
              <button key={t} onClick={() => setBetType(t)} className={`flex-1 rounded-lg border px-2 py-2 text-xs capitalize ${betType === t ? "border-gold bg-gold/10 text-gold-highlight" : "border-white/10 text-cream/60"}`}>
                {t} ({BET_MULTIPLIERS[t]}×)
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-cream/50">Stake</label>
            <input type="number" value={stakeInput} onChange={(e) => setStakeInput(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream" />
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={() => betDecision("bet", betType, stakeInput)} className="flex-1 rounded-full bg-gold py-2.5 text-sm font-semibold text-base hover:bg-gold-highlight">
            Place bet
          </button>
          <button onClick={() => betDecision("fee")} className="flex-1 rounded-full border border-cream/25 py-2.5 text-sm text-cream hover:border-cream/50">
            Pay fee
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(pendingIsMine && pending?.kind === "renew_or_release")} onClose={() => renewDecision(false)} title={pendingTile ? `${pendingTile.name} is expiring` : "Contract expiring"}>
        <p>
          Pay <span className="text-gold-highlight">${pending?.price}</span> upkeep to renew for another 15 turns, or release it back to the market.
        </p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => renewDecision(true)} className="flex-1 rounded-full bg-gold py-2.5 text-sm font-semibold text-base hover:bg-gold-highlight">
            Renew
          </button>
          <button onClick={() => renewDecision(false)} className="flex-1 rounded-full border border-cream/25 py-2.5 text-sm text-cream hover:border-cream/50">
            Release
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(auction)} onClose={() => {}} title={auctionTile ? `Auction: ${auctionTile.name}` : "Auction"}>
        <p className="text-sm text-cream/70">
          Highest bid: <span className="text-gold-highlight">${auction?.highestBid ?? 0}</span>
          {auction?.highestBidderId && <> by {game.players[auction.highestBidderId]?.username}</>}
        </p>
        <p className="mt-1 text-xs text-cream/40">
          {isMyAuctionTurn ? "Your turn to bid or pass." : `Waiting on ${auction ? game.players[auction.currentTurnPlayerId]?.username : ""}…`}
        </p>
        {isMyAuctionTurn && auction && (
          <div className="mt-4 flex gap-2">
            <input
              type="number"
              value={auctionBidInput || auction.highestBid + auction.minIncrement}
              onChange={(e) => setAuctionBidInput(Number(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
            />
            <button onClick={() => auctionBid(auctionBidInput || auction.highestBid + auction.minIncrement)} className="shrink-0 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-base hover:bg-gold-highlight">
              Bid
            </button>
          </div>
        )}
        {isMyAuctionTurn && (
          <button onClick={auctionPass} className="mt-3 w-full rounded-full border border-cream/25 py-2.5 text-sm text-cream hover:border-cream/50">
            Pass
          </button>
        )}
      </Modal>

      <Modal open={showCardModal} onClose={() => latestCard && setDismissedCardId(latestCard.id)} title={latestCard?.deck === "chance" ? "Chance" : "Community"}>
        <p className="text-lg text-gold-highlight">{latestCard?.text}</p>
        <button onClick={() => latestCard && setDismissedCardId(latestCard.id)} className="mt-6 w-full rounded-full bg-gold py-2.5 text-sm font-semibold text-base hover:bg-gold-highlight">
          Got it
        </button>
      </Modal>

      <Modal open={showEventModal} onClose={() => latestEvent && setDismissedEventId(latestEvent.id)} title="Market event">
        <p className="text-lg text-gold-highlight">{latestEvent?.description}</p>
        <button onClick={() => latestEvent && setDismissedEventId(latestEvent.id)} className="mt-6 w-full rounded-full bg-gold py-2.5 text-sm font-semibold text-base hover:bg-gold-highlight">
          Got it
        </button>
      </Modal>

      <Modal open={chatOpen} onClose={() => setChatOpen(false)} title="Chat">
        <div className="h-72">
          <Chat
            messages={chatMessages}
            players={game.playerOrder.map((pid) => ({ id: pid, username: game.players[pid].username }))}
            myPlayerId={myPlayerId}
            onSend={sendChat}
          />
        </div>
      </Modal>

      {myPlayerId && (
        <TradePanel
          open={tradeOpen}
          onClose={() => setTradeOpen(false)}
          game={game}
          myPlayerId={myPlayerId}
          myAssets={myAssets}
          onPropose={proposeTrade}
          onRespond={respondTrade}
        />
      )}

      {/* Host: confirm before ending the game early */}
      <Modal open={endGameConfirmOpen} onClose={() => setEndGameConfirmOpen(false)} title="End the game?">
        <p className="text-sm text-cream/70">
          This ends the game immediately for everyone. Whoever has the highest net worth right now wins.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              endGame();
              setEndGameConfirmOpen(false);
            }}
            className="flex-1 rounded-full bg-danger py-2.5 text-sm font-semibold text-cream hover:bg-danger/80"
          >
            End game now
          </button>
          <button
            onClick={() => setEndGameConfirmOpen(false)}
            className="flex-1 rounded-full border border-cream/25 py-2.5 text-sm text-cream hover:border-cream/50"
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* Popup notices — appear as soon as something arrives, whether or not Trade/Chat happen to be open */}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4">
        {showTradeNotice && incomingTrade && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-gold/40 bg-[#181B1F] px-4 py-2 text-xs text-cream shadow-lg">
            <span>
              <span className="text-gold-highlight">{game.players[incomingTrade.fromPlayerId]?.username}</span> sent you a trade offer
            </span>
            <button
              onClick={() => {
                setTradeOpen(true);
                setDismissedTradeNoticeId(incomingTrade.id);
              }}
              className="rounded-full bg-gold px-3 py-1 font-semibold text-base hover:bg-gold-highlight"
            >
              View
            </button>
            <button onClick={() => setDismissedTradeNoticeId(incomingTrade.id)} className="text-cream/40 hover:text-cream/70">
              ✕
            </button>
          </div>
        )}
        {showChatNotice && latestIncomingChat && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-primary-accent/40 bg-[#181B1F] px-4 py-2 text-xs text-cream shadow-lg">
            <span>
              <span className="text-primary-accent">{latestIncomingChat.fromUsername}</span>: {latestIncomingChat.message.slice(0, 60)}
            </span>
            <button
              onClick={() => {
                setChatOpen(true);
                setDismissedChatNoticeId(latestIncomingChat.id);
              }}
              className="rounded-full bg-primary-accent px-3 py-1 font-semibold text-base hover:bg-primary"
            >
              View
            </button>
            <button onClick={() => setDismissedChatNoticeId(latestIncomingChat.id)} className="text-cream/40 hover:text-cream/70">
              ✕
            </button>
          </div>
        )}
      </div>
    </main>
  );
}






















// "use client";

// import { useEffect, useMemo, useState } from "react";
// import dynamic from "next/dynamic";
// import Link from "next/link";
// import HowToPlayButton from "@/components/HowToPlayButton";
// import Modal from "@/components/ui/Modal";
// import TileInfoPanel from "@/components/TileInfoPanel";
// import Chat from "@/components/Chat";
// import TradePanel from "@/components/TradePanel";
// import PieceSelector from "@/components/PieceSelector";
// import TurnTimer from "@/components/TurnTimer";
// import { useGameStore } from "@/lib/store";
// import { normalizeRoomCode } from "@/lib/roomCode";
// import { boardIndex } from "@/lib/game/board";
// import { getPlayerAssets } from "@/lib/game/engine";
// import { BET_MULTIPLIERS, type BetType } from "@/lib/game/types";
// import { useGridAuth } from "@/lib/auth";

// const Board3D = dynamic(() => import("@/components/board/Board3D"), { ssr: false });

// const ASSET_DOT: Record<string, string> = {
//   property: "bg-primary",
//   estate: "bg-gold",
//   bond: "bg-primary-accent",
//   contract: "bg-gold",
//   betting: "bg-danger",
//   tech_company: "bg-volatile",
//   crypto: "bg-volatile",
//   startup: "bg-volatile",
// };

// export default function RoomPage({ params }: { params: { roomId: string } }) {
//   const roomId = normalizeRoomCode(params.roomId);
//   const { userId, loading: authLoading } = useGridAuth();
//   const {
//     join,
//     leave,
//     choosePiece,
//     start,
//     roll,
//     buyDecision,
//     outbidDecision,
//     investDecision,
//     betDecision,
//     renewDecision,
//     takeLoan,
//     endTurn,
//     payBail,
//     useJailCard,
//     attemptJailRoll,
//     build,
//     mortgage,
//     unmortgage,
//     listForSale,
//     cancelListing,
//     buyListed,
//     auctionBid,
//     auctionPass,
//     proposeTrade,
//     respondTrade,
//     sendChat,
//     snapshot,
//     myPlayerId,
//     chatMessages,
//     error,
//   } = useGameStore();

//   const [loanInput, setLoanInput] = useState(500);
//   const [dismissedEventId, setDismissedEventId] = useState<string | null>(null);
//   const [dismissedCardId, setDismissedCardId] = useState<string | null>(null);
//   const [hoveredTileId, setHoveredTileId] = useState<string | null>(null);
//   const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
//   const [betType, setBetType] = useState<BetType>("color");
//   const [stakeInput, setStakeInput] = useState(100);
//   const [chatOpen, setChatOpen] = useState(false);
//   const [tradeOpen, setTradeOpen] = useState(false);
//   const [listPriceInput, setListPriceInput] = useState<Record<string, number>>({});
//   const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
//   const [auctionBidInput, setAuctionBidInput] = useState(0);

//   useEffect(() => {
//     if (!userId) return;
//     join(roomId, userId, selectedPieceId ?? undefined);
//     return () => leave();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [roomId, userId]);

//   const game = snapshot?.game ?? null;
//   const isHost = snapshot && userId === snapshot.hostUserId;
//   const isMyTurn = game && myPlayerId && game.playerOrder[game.currentPlayerIndex] === myPlayerId;
//   const me = game && myPlayerId ? game.players[myPlayerId] : null;
//   const myAssets = useMemo(() => (game && myPlayerId ? getPlayerAssets(game, myPlayerId) : []), [game, myPlayerId]);

//   const latestEvent = game?.marketEvents[game.marketEvents.length - 1] ?? null;
//   const showEventModal = Boolean(latestEvent && latestEvent.id !== dismissedEventId);

//   const latestCard = game?.cardDraws[game.cardDraws.length - 1] ?? null;
//   const showCardModal = Boolean(latestCard && latestCard.id !== dismissedCardId && latestCard.playerId === myPlayerId);

//   const pending = game?.pendingDecision;
//   const pendingIsMine = pending && pending.playerId === myPlayerId;
//   const idx = game ? boardIndex(game.boardSize) : null;
//   const pendingTile = pending && idx ? idx.byId[pending.tileId] : null;
//   const infoTileId = selectedTileId ?? hoveredTileId;

//   const auction = game?.auction;
//   const auctionTile = auction && idx ? idx.byId[auction.tileId] : null;
//   const isMyAuctionTurn = auction && auction.currentTurnPlayerId === myPlayerId;

//   const unreadDms = chatMessages.filter((m) => m.toPlayerId === myPlayerId).length;

//   if (authLoading || !userId) {
//     return (
//       <main className="flex min-h-screen items-center justify-center bg-base">
//         <p className="text-sm text-cream/50">Signing in…</p>
//       </main>
//     );
//   }

//   if (!game || snapshot?.status === "waiting") {
//     const takenPieces = (snapshot?.waitingPlayers ?? []).filter((p) => p.userId !== userId).map((p) => p.pieceId);
//     const myWaiting = snapshot?.waitingPlayers.find((p) => p.userId === userId);

//     return (
//       <main className="min-h-screen bg-base px-4 py-8 sm:px-6 sm:py-10">
//         <div className="mx-auto flex max-w-xl items-center justify-between">
//           <Link href="/" className="font-display text-lg text-cream">
//             GRIDE
//           </Link>
//           <div className="flex items-center gap-2">
//             <Link href="/leaderboard" className="text-xs text-cream/50 hover:text-cream">
//               Leaderboard
//             </Link>
//             <HowToPlayButton />
//           </div>
//         </div>

//         <div className="mx-auto mt-8 max-w-xl rounded-card border border-white/10 bg-white/[0.02] p-6 sm:p-8">
//           <h1 className="font-display text-2xl text-cream">Waiting room</h1>
//           <p className="mt-1 text-sm text-cream/60">Share this code so others can join:</p>

//           <div className="mt-3 flex items-center gap-2">
//             <span className="flex-1 rounded-lg border border-gold/40 bg-gold/5 py-3 text-center font-mono text-2xl tracking-[0.3em] text-gold-highlight">
//               {roomId}
//             </span>
//             <button
//               type="button"
//               onClick={() => navigator.clipboard?.writeText(roomId)}
//               className="shrink-0 rounded-full border border-cream/25 px-4 py-3 text-xs text-cream hover:border-cream/50"
//             >
//               Copy
//             </button>
//           </div>

//           {error && <p className="mt-4 text-sm text-danger">{error}</p>}

//           <ul className="mt-6 space-y-2">
//             {(snapshot?.waitingPlayers ?? []).map((p) => (
//               <li key={p.id} className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-2 text-sm text-cream">
//                 <span>{p.username}</span>
//                 {p.userId === snapshot?.hostUserId && <span className="text-xs uppercase tracking-wide text-gold-highlight">Host</span>}
//               </li>
//             ))}
//             {(!snapshot || snapshot.waitingPlayers.length === 0) && <li className="text-sm text-cream/40">Connecting…</li>}
//           </ul>

//           <div className="mt-6">
//             <PieceSelector
//               selectedPieceId={selectedPieceId ?? myWaiting?.pieceId ?? null}
//               takenPieceIds={takenPieces}
//               onSelect={(pieceId) => {
//                 setSelectedPieceId(pieceId);
//                 choosePiece(pieceId);
//               }}
//             />
//           </div>

//           {isHost && (
//             <button
//               onClick={start}
//               disabled={(snapshot?.waitingPlayers.length ?? 0) < 1}
//               className="mt-8 w-full rounded-full bg-gold py-3 text-sm font-semibold text-base transition hover:bg-gold-highlight disabled:opacity-50"
//             >
//               Start game
//             </button>
//           )}
//           {!isHost && <p className="mt-8 text-center text-sm text-cream/40">Waiting for the host to start…</p>}
//         </div>
//       </main>
//     );
//   }

//   if (game.status === "ended") {
//     const ranked = [...game.playerOrder].map((pid) => game.players[pid]).sort((a, b) => b.netWorth - a.netWorth);

//     return (
//       <main className="flex min-h-screen flex-col items-center justify-center bg-base px-6 py-10 text-center">
//         <p className="text-xs uppercase tracking-[0.2em] text-gold-highlight">Game over</p>
//         <h1 className="mt-3 font-display text-4xl text-cream">
//           {game.winnerId ? `${game.players[game.winnerId].username} wins` : "No winner"}
//         </h1>
//         <p className="mt-2 text-sm text-cream/60">{game.endedReason}</p>

//         <div className="mt-8 w-full max-w-md space-y-2">
//           {ranked.map((p, i) => (
//             <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3 text-sm">
//               <span className="text-cream">
//                 {i + 1}. {p.username}
//               </span>
//               <span className="text-gold-highlight">${p.netWorth.toLocaleString()}</span>
//             </div>
//           ))}
//         </div>

//         <div className="mt-8 flex gap-3">
//           <a href="/lobby" className="rounded-full bg-gold px-6 py-3 text-sm font-semibold text-base hover:bg-gold-highlight">
//             New game
//           </a>
//           <a href="/leaderboard" className="rounded-full border border-cream/25 px-6 py-3 text-sm text-cream hover:border-cream/50">
//             Leaderboard
//           </a>
//         </div>
//       </main>
//     );
//   }

//   return (
//     <main className="flex min-h-screen flex-col bg-base">
//       <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
//         <div>
//           <span className="font-display text-base text-cream sm:text-lg">GRIDE</span>
//           <span className="ml-2 text-xs text-cream/40 sm:ml-3">Turn {game.turnNumber}</span>
//         </div>
//         <div className="flex items-center gap-2 sm:gap-4">
//           <span className={`text-xs sm:text-sm ${isMyTurn ? "font-semibold text-gold-highlight" : "text-cream/70"}`}>
//             {isMyTurn ? "Your turn" : `${game.players[game.playerOrder[game.currentPlayerIndex]].username}'s turn`}
//           </span>
//           <TurnTimer deadline={snapshot?.actionDeadline ?? null} />
//           <button onClick={() => setTradeOpen(true)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-cream/70 hover:border-white/25">
//             Trade
//           </button>
//           <button onClick={() => setChatOpen(true)} className="relative rounded-full border border-white/10 px-3 py-1.5 text-xs text-cream/70 hover:border-white/25">
//             Chat
//             {unreadDms > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-danger" />}
//           </button>
//           <Link href="/leaderboard" className="hidden text-xs text-cream/50 hover:text-cream sm:inline">
//             Leaderboard
//           </Link>
//           <HowToPlayButton />
//         </div>
//       </header>

//       <div className="grid flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
//         <section className="relative min-h-[360px] sm:min-h-[420px]">
          
//           <Board3D
//             game={game}
//             ticker={{
//               messages: ["Custom announcement", "Anything you want"], // omit to use the live game log
//               enabled: true,          // set false to hide entirely
//               color: "#F0B94A",       // text glow color
//               background: "#14120F",  // panel background
//               bezelColor: "#14120F",  // frame color
//               speed: 0.05,            // scroll speed
//             }}
//             onHoverTile={setHoveredTileId}
//             onSelectTile={(id) => setSelectedTileId((cur) => (cur === id ? null : id))}
//           />
//           {infoTileId && (
//             <>
//               {/* Desktop: floating panel near the cursor/selection */}
//               <div className="pointer-events-none absolute bottom-4 left-4 hidden w-64 sm:block">
//                 <TileInfoPanel game={game} tileId={infoTileId} myPlayerId={myPlayerId} />
//               </div>
//               {/* Mobile: bottom sheet, since hover doesn't exist on touch */}
//               <div className="absolute inset-x-0 bottom-0 sm:hidden">
//                 <div className="mx-2 mb-2">
//                   <TileInfoPanel game={game} tileId={infoTileId} myPlayerId={myPlayerId} />
//                 </div>
//               </div>
//             </>
//           )}
//         </section>

//         <aside className="space-y-5 border-t border-white/10 bg-white/[0.02] p-4 sm:p-5 lg:border-l lg:border-t-0">
//           <div>
//             <h2 className="font-display text-lg text-cream">Your position</h2>
//             <div className="mt-3 space-y-2 text-sm">
//               <div className="flex justify-between rounded-lg border border-white/10 p-3">
//                 <span className="text-cream/60">Cash</span>
//                 <span className="text-gold-highlight">${me?.inGameBalance.toLocaleString()}</span>
//               </div>
//               <div className="flex justify-between rounded-lg border border-white/10 p-3">
//                 <span className="text-cream/60">Net worth</span>
//                 <span className="text-primary-accent">${me?.netWorth.toLocaleString()}</span>
//               </div>
//             </div>
//           </div>

//           <div>
//             <h3 className="text-xs uppercase tracking-wide text-cream/50">Portfolio</h3>
//             <ul className="mt-2 space-y-2 text-sm">
//               {myAssets.length ? (
//                 myAssets.map((a) => (
//                   <li key={a.tileId} className="rounded-lg border border-white/10 p-2">
//                     <div className="flex items-center justify-between gap-2">
//                       <span className="flex items-center gap-2 text-cream/80">
//                         <span className={`h-2 w-2 rounded-full ${ASSET_DOT[a.type]}`} />
//                         {a.name}
//                         {!a.isSingleOwner && <span className="text-cream/40">({Math.round(a.ownershipPercent)}%)</span>}
//                         {a.mortgaged && <span className="text-[10px] uppercase text-danger">Mortgaged</span>}
//                       </span>
//                       <span className={a.profitLoss >= 0 ? "text-primary-accent" : "text-danger"}>
//                         ${a.currentShareValue.toLocaleString()}
//                       </span>
//                     </div>
//                     {a.isSingleOwner && isMyTurn && !pending && !auction && (
//                       <div className="mt-1.5 flex flex-wrap gap-1.5">
//                         {(a.type === "property" || a.type === "estate") && (a.buildLevel ?? 0) < 5 && !a.mortgaged && (
//                           <button onClick={() => build(a.tileId)} className="rounded border border-gold/40 px-1.5 py-0.5 text-[10px] text-gold-highlight hover:bg-gold/10">
//                             Build
//                           </button>
//                         )}
//                         {!a.mortgaged ? (
//                           <button onClick={() => mortgage(a.tileId)} className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-cream/60 hover:border-white/30">
//                             Mortgage
//                           </button>
//                         ) : (
//                           <button onClick={() => unmortgage(a.tileId)} className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-cream/60 hover:border-white/30">
//                             Unmortgage
//                           </button>
//                         )}
//                         {a.forSalePrice ? (
//                           <button onClick={() => cancelListing(a.tileId)} className="rounded border border-danger/40 px-1.5 py-0.5 text-[10px] text-danger hover:bg-danger/10">
//                             Cancel listing (${a.forSalePrice})
//                           </button>
//                         ) : (
//                           <span className="flex items-center gap-1">
//                             <input
//                               type="number"
//                               placeholder="Ask $"
//                               value={listPriceInput[a.tileId] ?? ""}
//                               onChange={(e) => setListPriceInput((s) => ({ ...s, [a.tileId]: Number(e.target.value) }))}
//                               className="w-16 rounded border border-white/15 bg-base px-1 py-0.5 text-[10px] text-cream"
//                             />
//                             <button
//                               onClick={() => listForSale(a.tileId, listPriceInput[a.tileId] || a.currentShareValue)}
//                               className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-cream/60 hover:border-white/30"
//                             >
//                               List
//                             </button>
//                           </span>
//                         )}
//                       </div>
//                     )}
//                   </li>
//                 ))
//               ) : (
//                 <li className="text-cream/40">No assets yet</li>
//               )}
//             </ul>
//           </div>

//           {game.playerOrder.some((pid) =>
//             Object.values(game.tileMarket).some((ts) => ts.ownerPlayerId === pid && pid !== myPlayerId && ts.forSalePrice)
//           ) && (
//             <div>
//               <h3 className="text-xs uppercase tracking-wide text-cream/50">On the market</h3>
//               <ul className="mt-2 space-y-1.5 text-sm">
//                 {Object.entries(game.tileMarket)
//                   .filter(([, ts]) => ts.forSalePrice && ts.ownerPlayerId !== myPlayerId)
//                   .map(([tileId, ts]) => (
//                     <li key={tileId} className="flex items-center justify-between">
//                       <span className="text-cream/70">{idx?.byId[tileId]?.name}</span>
//                       <button onClick={() => buyListed(tileId)} className="rounded border border-gold/40 px-2 py-0.5 text-[10px] text-gold-highlight hover:bg-gold/10">
//                         Buy ${ts.forSalePrice}
//                       </button>
//                     </li>
//                   ))}
//               </ul>
//             </div>
//           )}

//           <div>
//             <h3 className="text-xs uppercase tracking-wide text-cream/50">Loans</h3>
//             {me?.loans.filter((l) => l.status === "active").length ? (
//               <ul className="mt-2 space-y-1.5 text-sm">
//                 {me.loans
//                   .filter((l) => l.status === "active")
//                   .map((l) => (
//                     <li key={l.id} className="flex items-center justify-between">
//                       <span className="text-cream/80">${l.installmentAmount}/installment</span>
//                       <span className="text-cream/60">{l.installmentsRemaining} left</span>
//                     </li>
//                   ))}
//               </ul>
//             ) : (
//               <p className="mt-2 text-sm text-cream/40">None active</p>
//             )}
//             {isMyTurn && (
//               <div className="mt-3 flex gap-2">
//                 <input
//                   type="number"
//                   value={loanInput}
//                   onChange={(e) => setLoanInput(Number(e.target.value))}
//                   className="w-full rounded-lg border border-white/10 bg-base px-2 py-1.5 text-sm text-cream"
//                 />
//                 <button onClick={() => takeLoan(loanInput)} className="shrink-0 rounded-lg border border-gold/40 px-3 py-1.5 text-xs text-gold-highlight hover:bg-gold/10">
//                   Borrow
//                 </button>
//               </div>
//             )}
//           </div>

//           <div>
//             <h3 className="text-xs uppercase tracking-wide text-cream/50">Activity</h3>
//             <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-cream/50">
//               {[...game.log].reverse().slice(0, 12).map((entry, i) => (
//                 <li key={i}>{entry.message}</li>
//               ))}
//             </ul>
//           </div>
//         </aside>
//       </div>

//       <footer className="flex items-center justify-between border-t border-white/10 px-4 py-3 sm:px-6 sm:py-4">
//         <span className="text-xs text-cream/40">
//           {me?.status === "bankrupt"
//             ? "You're out — spectating"
//             : me?.inJail
//               ? `In Jail — attempt ${me.jailTurns}/3`
//               : me?.doublesStreak
//                 ? "Doubles! Roll again."
//                 : ""}
//         </span>
//         <div className="flex gap-2">
//           {isMyTurn && me?.inJail ? (
//             <>
//               <button onClick={payBail} disabled={Boolean(pending) || (me?.inGameBalance ?? 0) < 50} className="rounded-full border border-cream/25 px-3 py-2 text-xs text-cream hover:border-cream/50 disabled:opacity-40 sm:px-4 sm:text-sm">
//                 Pay $50 bail
//               </button>
//               {me.getOutOfJailFreeCards > 0 && (
//                 <button onClick={useJailCard} disabled={Boolean(pending)} className="rounded-full border border-gold/40 px-3 py-2 text-xs text-gold-highlight hover:bg-gold/10 disabled:opacity-40 sm:px-4 sm:text-sm">
//                   Use card
//                 </button>
//               )}
//               <button onClick={attemptJailRoll} disabled={Boolean(pending) || me.hasRolledThisTurn} className="rounded-full bg-gold px-3 py-2 text-xs font-semibold text-base hover:bg-gold-highlight disabled:opacity-40 sm:px-4 sm:text-sm">
//                 Roll
//               </button>
//               <button onClick={endTurn} disabled={!me.hasRolledThisTurn || Boolean(pending)} className="rounded-full border border-cream/25 px-3 py-2 text-xs text-cream hover:border-cream/50 disabled:opacity-40 sm:px-4 sm:text-sm">
//                 End turn
//               </button>
//             </>
//           ) : (
//             <>
//               <button onClick={roll} disabled={!isMyTurn || Boolean(pending) || Boolean(auction) || Boolean(me?.hasRolledThisTurn)} className="rounded-full border border-cream/25 px-3 py-2 text-xs text-cream hover:border-cream/50 disabled:opacity-40 sm:px-4 sm:text-sm">
//                 Roll
//               </button>
//               <button onClick={endTurn} disabled={!isMyTurn || Boolean(pending) || Boolean(auction)} className="rounded-full bg-gold px-3 py-2 text-xs font-semibold text-base hover:bg-gold-highlight disabled:opacity-40 sm:px-4 sm:text-sm">
//                 End turn
//               </button>
//             </>
//           )}
//         </div>
//       </footer>

//       <Modal open={Boolean(pendingIsMine && pending?.kind === "buy_or_skip")} onClose={() => buyDecision(false)} title={pendingTile ? `Buy ${pendingTile.name}?` : "Buy?"}>
//         <p>
//           Price: <span className="text-gold-highlight">${pending?.price}</span>. You have ${me?.inGameBalance.toLocaleString()}.
//         </p>
//         <p className="mt-1 text-xs text-cream/40">Passing sends it to a live auction among everyone at the table.</p>
//         <div className="mt-6 flex gap-3">
//           <button onClick={() => buyDecision(true)} className="flex-1 rounded-full bg-gold py-2.5 text-sm font-semibold text-base hover:bg-gold-highlight">
//             Buy now
//           </button>
//           <button onClick={() => buyDecision(false)} className="flex-1 rounded-full border border-cream/25 py-2.5 text-sm text-cream hover:border-cream/50">
//             Auction it
//           </button>
//         </div>
//       </Modal>

//       <Modal open={Boolean(pendingIsMine && pending?.kind === "outbid_or_skip")} onClose={() => outbidDecision(false)} title={pendingTile ? `Buy out ${pendingTile.name}?` : "Outbid?"}>
//         <p>
//           Currently held by <span className="text-gold-highlight">{pending?.currentOwnerPlayerId ? game.players[pending.currentOwnerPlayerId]?.username : ""}</span>. Taking it costs{" "}
//           <span className="text-gold-highlight">${pending?.price}</span> — they're refunded what they originally paid.
//         </p>
//         <div className="mt-6 flex gap-3">
//           <button onClick={() => outbidDecision(true)} className="flex-1 rounded-full bg-gold py-2.5 text-sm font-semibold text-base hover:bg-gold-highlight">
//             Buy out
//           </button>
//           <button onClick={() => outbidDecision(false)} className="flex-1 rounded-full border border-cream/25 py-2.5 text-sm text-cream hover:border-cream/50">
//             Let it go
//           </button>
//         </div>
//       </Modal>

//       <Modal open={Boolean(pendingIsMine && pending?.kind === "invest_or_fee")} onClose={() => investDecision(false)} title={pendingTile ? `Invest in ${pendingTile.name}?` : "Invest?"}>
//         <p>
//           Invest <span className="text-gold-highlight">${pending?.price}</span> to become a co-owner, or pay a{" "}
//           <span className="text-gold-highlight">${pending?.landingFee}</span> landing fee to existing investors instead.
//         </p>
//         <div className="mt-6 flex gap-3">
//           <button onClick={() => investDecision(true)} className="flex-1 rounded-full bg-gold py-2.5 text-sm font-semibold text-base hover:bg-gold-highlight">
//             Invest
//           </button>
//           <button onClick={() => investDecision(false)} className="flex-1 rounded-full border border-cream/25 py-2.5 text-sm text-cream hover:border-cream/50">
//             Pay fee
//           </button>
//         </div>
//       </Modal>

//       <Modal open={Boolean(pendingIsMine && pending?.kind === "bet_or_fee")} onClose={() => betDecision("fee")} title={pendingTile ? `${pendingTile.name}` : "Betting Company"}>
//         <p className="mb-4">
//           Owned by <span className="text-gold-highlight">{pending?.currentOwnerPlayerId ? game.players[pending.currentOwnerPlayerId]?.username : ""}</span>. Place a bet, or pay a{" "}
//           <span className="text-gold-highlight">${pending?.landingFee}</span> landing fee to skip it.
//         </p>
//         <div className="space-y-3">
//           <div className="flex gap-2">
//             {(Object.keys(BET_MULTIPLIERS) as BetType[]).map((t) => (
//               <button key={t} onClick={() => setBetType(t)} className={`flex-1 rounded-lg border px-2 py-2 text-xs capitalize ${betType === t ? "border-gold bg-gold/10 text-gold-highlight" : "border-white/10 text-cream/60"}`}>
//                 {t} ({BET_MULTIPLIERS[t]}×)
//               </button>
//             ))}
//           </div>
//           <div>
//             <label className="block text-xs uppercase tracking-wide text-cream/50">Stake</label>
//             <input type="number" value={stakeInput} onChange={(e) => setStakeInput(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream" />
//           </div>
//         </div>
//         <div className="mt-6 flex gap-3">
//           <button onClick={() => betDecision("bet", betType, stakeInput)} className="flex-1 rounded-full bg-gold py-2.5 text-sm font-semibold text-base hover:bg-gold-highlight">
//             Place bet
//           </button>
//           <button onClick={() => betDecision("fee")} className="flex-1 rounded-full border border-cream/25 py-2.5 text-sm text-cream hover:border-cream/50">
//             Pay fee
//           </button>
//         </div>
//       </Modal>

//       <Modal open={Boolean(pendingIsMine && pending?.kind === "renew_or_release")} onClose={() => renewDecision(false)} title={pendingTile ? `${pendingTile.name} is expiring` : "Contract expiring"}>
//         <p>
//           Pay <span className="text-gold-highlight">${pending?.price}</span> upkeep to renew for another 15 turns, or release it back to the market.
//         </p>
//         <div className="mt-6 flex gap-3">
//           <button onClick={() => renewDecision(true)} className="flex-1 rounded-full bg-gold py-2.5 text-sm font-semibold text-base hover:bg-gold-highlight">
//             Renew
//           </button>
//           <button onClick={() => renewDecision(false)} className="flex-1 rounded-full border border-cream/25 py-2.5 text-sm text-cream hover:border-cream/50">
//             Release
//           </button>
//         </div>
//       </Modal>

//       <Modal open={Boolean(auction)} onClose={() => {}} title={auctionTile ? `Auction: ${auctionTile.name}` : "Auction"}>
//         <p className="text-sm text-cream/70">
//           Highest bid: <span className="text-gold-highlight">${auction?.highestBid ?? 0}</span>
//           {auction?.highestBidderId && <> by {game.players[auction.highestBidderId]?.username}</>}
//         </p>
//         <p className="mt-1 text-xs text-cream/40">
//           {isMyAuctionTurn ? "Your turn to bid or pass." : `Waiting on ${auction ? game.players[auction.currentTurnPlayerId]?.username : ""}…`}
//         </p>
//         {isMyAuctionTurn && auction && (
//           <div className="mt-4 flex gap-2">
//             <input
//               type="number"
//               value={auctionBidInput || auction.highestBid + auction.minIncrement}
//               onChange={(e) => setAuctionBidInput(Number(e.target.value))}
//               className="w-full rounded-lg border border-white/10 bg-base px-3 py-2 text-sm text-cream"
//             />
//             <button onClick={() => auctionBid(auctionBidInput || auction.highestBid + auction.minIncrement)} className="shrink-0 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-base hover:bg-gold-highlight">
//               Bid
//             </button>
//           </div>
//         )}
//         {isMyAuctionTurn && (
//           <button onClick={auctionPass} className="mt-3 w-full rounded-full border border-cream/25 py-2.5 text-sm text-cream hover:border-cream/50">
//             Pass
//           </button>
//         )}
//       </Modal>

//       <Modal open={showCardModal} onClose={() => latestCard && setDismissedCardId(latestCard.id)} title={latestCard?.deck === "chance" ? "Chance" : "Community"}>
//         <p className="text-lg text-gold-highlight">{latestCard?.text}</p>
//         <button onClick={() => latestCard && setDismissedCardId(latestCard.id)} className="mt-6 w-full rounded-full bg-gold py-2.5 text-sm font-semibold text-base hover:bg-gold-highlight">
//           Got it
//         </button>
//       </Modal>

//       <Modal open={showEventModal} onClose={() => latestEvent && setDismissedEventId(latestEvent.id)} title="Market event">
//         <p className="text-lg text-gold-highlight">{latestEvent?.description}</p>
//         <button onClick={() => latestEvent && setDismissedEventId(latestEvent.id)} className="mt-6 w-full rounded-full bg-gold py-2.5 text-sm font-semibold text-base hover:bg-gold-highlight">
//           Got it
//         </button>
//       </Modal>

//       <Modal open={chatOpen} onClose={() => setChatOpen(false)} title="Chat">
//         <div className="h-72">
//           <Chat
//             messages={chatMessages}
//             players={game.playerOrder.map((pid) => ({ id: pid, username: game.players[pid].username }))}
//             myPlayerId={myPlayerId}
//             onSend={sendChat}
//           />
//         </div>
//       </Modal>

//       {myPlayerId && (
//         <TradePanel
//           open={tradeOpen}
//           onClose={() => setTradeOpen(false)}
//           game={game}
//           myPlayerId={myPlayerId}
//           myAssets={myAssets}
//           onPropose={proposeTrade}
//           onRespond={respondTrade}
//         />
//       )}
//     </main>
//   );
// }




