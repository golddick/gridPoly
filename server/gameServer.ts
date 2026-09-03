import type { Server as SocketIOServer, Socket } from "socket.io";
import Redis from "ioredis";
import { prisma } from "./db";
import { verifySupabaseToken } from "./supabase";
import {
  createInitialGameState,
  applyRoll,
  resolveBuy,
  resolveOutbid,
  resolveInvestOrFee,
  resolveBetOrFee,
  resolveRenewOrRelease,
  takeLoan,
  endTurn,
  endByTimeout,
  payBail,
  useJailCard,
  attemptJailRoll,
  buildHouse,
  auctionBid,
  auctionPass,
  mortgageTile,
  unmortgageTile,
  listForSale,
  cancelListing,
  buyListed,
  proposeTrade,
  respondTrade,
  whoMustAct,
  stepBot,
  currentPlayerId,
  endByHost,
  refreshWinCondition,
  type GameState,
  type RoomSettings,
  type BetType,
  type BotDifficulty,
  type ChatMessage,
} from "../lib/game";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  // Redis is only used for ephemeral presence — never worth blocking or
  // retrying forever if it's unreachable. Fail fast, log once, keep serving.
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 2000)),
  lazyConnect: true,
});
let redisWarned = false;
redis.on("error", (err) => {
  if (!redisWarned) {
    console.warn(`Redis unavailable (${err.message}) — presence tracking disabled, everything else still works.`);
    redisWarned = true;
  }
});
redis.connect().catch(() => {
  /* already logged via the 'error' handler above */
});

interface WaitingPlayer {
  id: string; // RoomPlayer id (Postgres) for humans; synthetic `bot_…` id for bots
  userId: string;
  username: string;
  pieceId: string;
  isBot?: boolean; // in-memory bot — no Supabase user, no RoomPlayer/DB row
  botDifficulty?: BotDifficulty;
  isSpectator?: boolean; // human who watches instead of playing (e.g. a host running an all-bot table)
}

interface RoomRuntime {
  hostUserId: string;
  settings: RoomSettings;
  waitingPlayers: WaitingPlayer[];
  state: GameState | null;
  durationTimer: NodeJS.Timeout | null;
  chatHistory: ChatMessage[];
  actionTimer: NodeJS.Timeout | null;
  actionDeadline: number | null; // epoch ms — when the current actor's turnTimerSeconds runs out
}

const rooms = new Map<string, RoomRuntime>();
const PIECE_IDS = ["cone-gold", "cone-emerald", "cone-purple", "cone-red", "cone-teal", "cone-pink", "cone-blue", "cone-orange"];
const MAX_BOTS = 4; // per room, set by the host before the game starts
// A bot's turn opens with a long, spectator-friendly beat (so a watcher can see
// "now it's this bot's turn"), then every follow-on step within that same turn is
// quick so a single turn doesn't drag out.
const BOT_STEP_MS = 1000; // between a bot's own steps inside its turn
const BOT_TURN_START_MS = 3_000; // opening beat of a fresh bot turn — long enough to register whose turn it is, short enough to watch

async function loadRoomSettings(roomId: string): Promise<{ hostUserId: string; settings: RoomSettings } | null> {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) return null;
  return { hostUserId: room.hostId, settings: room.settings as unknown as RoomSettings };
}

async function getOrCreateRuntime(roomId: string): Promise<RoomRuntime | null> {
  const existing = rooms.get(roomId);
  if (existing) return existing;

  const loaded = await loadRoomSettings(roomId);
  if (!loaded) return null;

  const runtime: RoomRuntime = {
    hostUserId: loaded.hostUserId,
    settings: loaded.settings,
    waitingPlayers: [],
    state: null,
    durationTimer: null,
    actionTimer: null,
    actionDeadline: null,
    chatHistory: [],
  };
  rooms.set(roomId, runtime);
  return runtime;
}

async function persistAction(roomId: string, roomPlayerId: string, turnNumber: number, actionType: string, payload: unknown) {
  try {
    await prisma.gameAction.create({
      data: { roomId, roomPlayerId, turnNumber, actionType, payload: payload as object },
    });
  } catch (err) {
    console.error("Failed to persist GameAction", err);
  }
}

/** Updates each player's global best-net-worth / games-played / games-won record — independent of any single room. */
async function updateLeaderboard(state: GameState) {
  for (const pid of state.playerOrder) {
    const player = state.players[pid];
    if (player.isBot) continue; // bots have no user account to credit
    try {
      await prisma.user.update({
        where: { id: player.userId },
        data: {
          gamesPlayed: { increment: 1 },
          gamesWon: state.winnerId === pid ? { increment: 1 } : undefined,
        },
      });
      const current = await prisma.user.findUnique({ where: { id: player.userId }, select: { bestNetWorth: true } });
      if (current && player.netWorth > current.bestNetWorth) {
        await prisma.user.update({
          where: { id: player.userId },
          data: { bestNetWorth: player.netWorth, bestNetWorthAt: new Date() },
        });
      }
    } catch (err) {
      console.error("Failed to update leaderboard for user", player.userId, err);
    }
  }
}

async function trackPresence(roomId: string, userId: string, status: "connected" | "disconnected") {
  try {
    await redis.hset(`room:${roomId}:presence`, userId, status);
  } catch (err) {
    // Presence is a nice-to-have, ephemeral signal — never let a down/misconfigured
    // Redis silently break the actual room join/leave flow.
    console.error("Redis presence update failed (continuing anyway)", err);
  }
}

/** Wires all Gride room/game logic onto an existing Socket.IO server instance — called once by the root custom server. */
export function attachGameServer(io: SocketIOServer) {
  function broadcastState(roomId: string) {
    const runtime = rooms.get(roomId);
    if (!runtime) return;
    scheduleActionTimer(roomId); // keeps the countdown in sync with whatever changed
    io.to(roomId).emit("game:state", {
      status: runtime.state ? runtime.state.status : "waiting",
      waitingPlayers: runtime.waitingPlayers,
      hostUserId: runtime.hostUserId,
      settings: runtime.settings,
      game: runtime.state,
      actionDeadline: runtime.actionDeadline,
    });
  }

  async function endGameAndPersist(roomId: string, runtime: RoomRuntime) {
    if (!runtime.state) return;
    try {
      await prisma.room.update({ where: { id: roomId }, data: { status: "ended", endsAt: new Date() } });
    } catch (err) {
      console.error("Failed to persist room end", err);
    }
    await updateLeaderboard(runtime.state);
    if (runtime.durationTimer) {
      clearTimeout(runtime.durationTimer);
      runtime.durationTimer = null;
    }
    if (runtime.actionTimer) {
      clearTimeout(runtime.actionTimer);
      runtime.actionTimer = null;
    }
  }

  /** (Re)schedules the per-actor countdown. Called on every broadcast, so it always reflects whoever must act right now — resets automatically when that changes. */
  function scheduleActionTimer(roomId: string) {
    const runtime = rooms.get(roomId);
    if (!runtime) return;

    if (runtime.actionTimer) {
      clearTimeout(runtime.actionTimer);
      runtime.actionTimer = null;
    }

    const actorId = runtime.state ? whoMustAct(runtime.state) : null;
    if (!actorId) {
      runtime.actionDeadline = null;
      return;
    }

    // A bot acts on its own after a delay. Because this runs on every broadcast,
    // and each bot step broadcasts again, it's also the engine that drives an
    // all-bot table forward — one step at a time until the game ends.
    if (runtime.state!.players[actorId]?.isBot) {
      runtime.actionDeadline = null; // no human countdown for a bot seat
      const state = runtime.state!;
      const player = state.players[actorId];
      // The first step of a bot's turn — it's the current player, hasn't rolled,
      // nothing pending — gets a long, spectator-friendly beat so a watcher can
      // register whose turn it is. Every follow-on step within the same turn
      // (the post-roll decision, a doubles re-roll, an auction bid) is quick.
      const isTurnStart =
        currentPlayerId(state) === actorId &&
        !player.hasRolledThisTurn &&
        !state.pendingDecision &&
        !state.auction;
      runtime.actionTimer = setTimeout(
        () => runBotTurn(roomId, actorId),
        isTurnStart ? BOT_TURN_START_MS : BOT_STEP_MS,
      );
      return;
    }

    const seconds = Math.max(10, runtime.settings.turnTimerSeconds || 45);
    runtime.actionDeadline = Date.now() + seconds * 1000;
    runtime.actionTimer = setTimeout(() => autoAdvance(roomId, actorId), seconds * 1000);
  }

  /** Safe-default action for a stalled player, per the design doc: auto-pass an auction bid, auto-decline a landing decision, or auto-end an untaken turn — never blocks the table indefinitely. */
  function autoAdvance(roomId: string, expectedActorId: string) {
    const runtime = rooms.get(roomId);
    if (!runtime?.state) return;
    if (whoMustAct(runtime.state) !== expectedActorId) return; // state moved on already (e.g. another event raced this timer)

    let state = runtime.state;
    if (state.auction) {
      state = auctionPass(state, expectedActorId);
    } else if (state.pendingDecision) {
      switch (state.pendingDecision.kind) {
        case "buy_or_skip":
          state = resolveBuy(state, expectedActorId, false);
          break;
        case "outbid_or_skip":
          state = resolveOutbid(state, expectedActorId, false);
          break;
        case "invest_or_fee":
          state = resolveInvestOrFee(state, expectedActorId, false);
          break;
        case "bet_or_fee":
          state = resolveBetOrFee(state, expectedActorId, "fee");
          break;
        case "renew_or_release":
          state = resolveRenewOrRelease(state, expectedActorId, false);
          break;
      }
    } else {
      state = endTurn(state, expectedActorId);
    }

    runtime.state = state;
    broadcastState(roomId); // also reschedules the timer for whoever must act next
    if (runtime.state.status === "ended") void endGameAndPersist(roomId, runtime);
  }

  /**
   * Runs exactly one autonomous bot step for `expectedActorId`, then rebroadcasts —
   * which reschedules the next step (usually this same bot mid-turn, then the next
   * player). stepBot guarantees forward progress, so this chain always terminates
   * at the end of the game with no human input required.
   */
  function runBotTurn(roomId: string, expectedActorId: string) {
    const runtime = rooms.get(roomId);
    if (!runtime?.state) return;
    if (whoMustAct(runtime.state) !== expectedActorId) return; // state raced ahead of this timer
    if (!runtime.state.players[expectedActorId]?.isBot) return; // never bot-drive a human seat

    runtime.state = stepBot(runtime.state, expectedActorId);
    runtime.state = refreshWinCondition(runtime.state);
    broadcastState(roomId);
    if (runtime.state.status === "ended") void endGameAndPersist(roomId, runtime);
  }

  // --- Auth middleware: verify the Supabase token, never trust a client-sent userId ---
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("unauthorized"));
    const user = await verifySupabaseToken(token);
    if (!user) return next(new Error("unauthorized"));
    socket.data.authUserId = user.id;
    socket.data.authUsername = (user.user_metadata?.username as string) ?? "Player";
    next();
  });

  io.on("connection", (socket: Socket) => {
    const authUserId = socket.data.authUserId as string;
    const authUsername = socket.data.authUsername as string;

    socket.on("room:join", async ({ roomId: rawRoomId, pieceId }: { roomId: string; pieceId?: string }) => {
      const roomId = rawRoomId?.toUpperCase().trim();
      const runtime = roomId ? await getOrCreateRuntime(roomId) : null;
      if (!runtime) {
        socket.emit("room:error", { message: "Room not found." });
        return;
      }

      socket.join(roomId);
      socket.join(`dm:${roomId}:${authUserId}`); // personal room for direct messages
      socket.data.roomId = roomId;
      socket.data.userId = authUserId;

      await trackPresence(roomId, authUserId, "connected");
      socket.emit(
        "chat:history",
        runtime.chatHistory.filter((m) => !m.toPlayerId || m.toPlayerId === authUserId || m.fromPlayerId === authUserId)
      );

      if (runtime.state) {
        const existingPlayer = Object.values(runtime.state.players).find((p) => p.userId === authUserId);
        if (existingPlayer && existingPlayer.status === "disconnected") existingPlayer.status = "active";
        broadcastState(roomId);
        return;
      }

      const alreadyWaiting = runtime.waitingPlayers.find((p) => p.userId === authUserId);
      if (!alreadyWaiting) {
        if (runtime.waitingPlayers.length >= runtime.settings.maxPlayers) {
          socket.emit("room:error", { message: "Room is full." });
          return;
        }
        const takenPieces = new Set(runtime.waitingPlayers.map((p) => p.pieceId));
        const assignedPiece = pieceId && !takenPieces.has(pieceId) ? pieceId : PIECE_IDS.find((p) => !takenPieces.has(p)) ?? PIECE_IDS[0];
        try {
          const roomPlayer = await prisma.roomPlayer.upsert({
            where: { roomId_userId: { roomId, userId: authUserId } },
            create: { roomId, userId: authUserId, inGameBalance: runtime.settings.startingCapital, pieceId: assignedPiece },
            update: { pieceId: assignedPiece },
          });
          runtime.waitingPlayers.push({ id: roomPlayer.id, userId: authUserId, username: authUsername, pieceId: assignedPiece });
        } catch (err) {
          console.error("Failed to create RoomPlayer", err);
          runtime.waitingPlayers.push({ id: `local_${authUserId}`, userId: authUserId, username: authUsername, pieceId: assignedPiece });
        }
      }

      broadcastState(roomId);
    });

    socket.on("room:choosePiece", ({ roomId, pieceId }: { roomId: string; pieceId: string }) => {
      const runtime = rooms.get(roomId);
      if (!runtime || runtime.state) return;
      const taken = new Set(runtime.waitingPlayers.filter((p) => p.userId !== authUserId).map((p) => p.pieceId));
      if (taken.has(pieceId)) return;
      const me = runtime.waitingPlayers.find((p) => p.userId === authUserId);
      if (me) me.pieceId = pieceId;
      broadcastState(roomId);
    });

    socket.on("room:addBot", ({ roomId, difficulty }: { roomId: string; difficulty?: BotDifficulty }) => {
      const runtime = rooms.get(roomId);
      if (!runtime || runtime.state) return; // bots can only be added before the game starts
      if (authUserId !== runtime.hostUserId) {
        socket.emit("room:error", { message: "Only the host can add bots." });
        return;
      }
      const botCount = runtime.waitingPlayers.filter((p) => p.isBot).length;
      if (botCount >= MAX_BOTS) {
        socket.emit("room:error", { message: `You can add at most ${MAX_BOTS} bots.` });
        return;
      }
      if (runtime.waitingPlayers.length >= runtime.settings.maxPlayers) {
        socket.emit("room:error", { message: "Room is full." });
        return;
      }

      const tier: BotDifficulty = difficulty === "easy" || difficulty === "hard" ? difficulty : "medium";
      const takenPieces = new Set(runtime.waitingPlayers.map((p) => p.pieceId));
      const pieceId = PIECE_IDS.find((p) => !takenPieces.has(p)) ?? PIECE_IDS[0];
      const id = `bot_${roomId}_${Math.random().toString(36).slice(2, 8)}`;

      runtime.waitingPlayers.push({
        id,
        userId: id, // synthetic: no Supabase user; unique so player-keyed state never collides with a human
        username: `Bot ${botCount + 1} · ${tier}`,
        pieceId,
        isBot: true,
        botDifficulty: tier,
      });
      broadcastState(roomId);
    });

    socket.on("room:removeBot", ({ roomId, botId }: { roomId: string; botId: string }) => {
      const runtime = rooms.get(roomId);
      if (!runtime || runtime.state) return;
      if (authUserId !== runtime.hostUserId) {
        socket.emit("room:error", { message: "Only the host can remove bots." });
        return;
      }
      const idx = runtime.waitingPlayers.findIndex((p) => p.id === botId && p.isBot);
      if (idx === -1) return;
      runtime.waitingPlayers.splice(idx, 1);
      broadcastState(roomId);
    });

    socket.on("room:setSpectator", ({ roomId, spectator }: { roomId: string; spectator: boolean }) => {
      const runtime = rooms.get(roomId);
      if (!runtime || runtime.state) return; // watch mode is chosen before the game starts
      if (authUserId !== runtime.hostUserId) {
        socket.emit("room:error", { message: "Only the host can change watch mode." });
        return;
      }
      const host = runtime.waitingPlayers.find((p) => p.userId === authUserId);
      if (host) host.isSpectator = !!spectator;
      broadcastState(roomId);
    });

    socket.on("room:start", async ({ roomId }: { roomId: string }) => {
      const runtime = rooms.get(roomId);
      if (!runtime || runtime.state) return;
      if (authUserId !== runtime.hostUserId) {
        socket.emit("room:error", { message: "Only the host can start the game." });
        return;
      }
      // Spectators (e.g. a host running an all-bot table) don't get a seat — only
      // real participants are seated and enter the turn order.
      const participants = runtime.waitingPlayers.filter((p) => !p.isSpectator);
      if (participants.length < 1) return;
      const hostSpectating = runtime.waitingPlayers.some((p) => p.userId === runtime.hostUserId && p.isSpectator);
      if (hostSpectating && participants.length < 2) {
        socket.emit("room:error", { message: "Add at least 2 bots before starting a watch-only table." });
        return;
      }

      runtime.state = createInitialGameState(roomId, runtime.settings, participants);

      try {
        await prisma.room.update({ where: { id: roomId }, data: { status: "in_progress", startedAt: new Date() } });
      } catch (err) {
        console.error("Failed to persist room start", err);
      }

      if (runtime.settings.durationMinutes && runtime.settings.winCondition === "timed") {
        runtime.durationTimer = setTimeout(() => {
          if (!runtime.state || runtime.state.status !== "in_progress") return;
          runtime.state = endByTimeout(runtime.state);
          broadcastState(roomId);
          void endGameAndPersist(roomId, runtime);
        }, runtime.settings.durationMinutes * 60 * 1000);
      }

      broadcastState(roomId);
    });

    socket.on("game:endGame", async ({ roomId }: { roomId: string }) => {
      const runtime = rooms.get(roomId);
      if (!runtime?.state || runtime.state.status !== "in_progress") return;
      if (authUserId !== runtime.hostUserId) {
        socket.emit("room:error", { message: "Only the host can end the game." });
        return;
      }
      runtime.state = endByHost(runtime.state);
      broadcastState(roomId);
      await endGameAndPersist(roomId, runtime);
    });

    // --- Generic wrapper: every game action follows the same shape ---
    function on<T extends { roomId: string; playerId: string }>(
      event: string,
      actionType: string,
      apply: (state: GameState, payload: T) => GameState
    ) {
      socket.on(event, async (payload: T) => {
        const runtime = rooms.get(payload.roomId);
        if (!runtime?.state) return;
        const turn = runtime.state.turnNumber;
        runtime.state = apply(runtime.state, payload);
        runtime.state = refreshWinCondition(runtime.state);
        await persistAction(payload.roomId, payload.playerId, turn, actionType, payload);
        broadcastState(payload.roomId);
        if (runtime.state.status === "ended") await endGameAndPersist(payload.roomId, runtime);
      });
    }

    on("game:roll", "roll", (s, p: { roomId: string; playerId: string }) => applyRoll(s, p.playerId));
    on("game:buyDecision", "buy", (s, p: { roomId: string; playerId: string; accept: boolean }) => resolveBuy(s, p.playerId, p.accept));
    on("game:outbidDecision", "outbid_contract", (s, p: { roomId: string; playerId: string; accept: boolean }) =>
      resolveOutbid(s, p.playerId, p.accept)
    );
    on("game:investDecision", "invest", (s, p: { roomId: string; playerId: string; invest: boolean }) =>
      resolveInvestOrFee(s, p.playerId, p.invest)
    );
    on("game:renewDecision", "renew_contract", (s, p: { roomId: string; playerId: string; renew: boolean }) =>
      resolveRenewOrRelease(s, p.playerId, p.renew)
    );
    on("game:payBail", "pay_bail", (s, p: { roomId: string; playerId: string }) => payBail(s, p.playerId));
    on("game:useJailCard", "use_jail_card", (s, p: { roomId: string; playerId: string }) => useJailCard(s, p.playerId));
    on("game:attemptJailRoll", "jail_roll", (s, p: { roomId: string; playerId: string }) => attemptJailRoll(s, p.playerId));
    on("game:build", "build", (s, p: { roomId: string; playerId: string; tileId: string }) => buildHouse(s, p.playerId, p.tileId));
    on("game:mortgage", "mortgage", (s, p: { roomId: string; playerId: string; tileId: string }) => mortgageTile(s, p.playerId, p.tileId));
    on("game:unmortgage", "unmortgage", (s, p: { roomId: string; playerId: string; tileId: string }) =>
      unmortgageTile(s, p.playerId, p.tileId)
    );
    on(
      "game:listForSale",
      "list_for_sale",
      (s, p: { roomId: string; playerId: string; tileId: string; price: number }) => listForSale(s, p.playerId, p.tileId, p.price)
    );
    on("game:cancelListing", "cancel_listing", (s, p: { roomId: string; playerId: string; tileId: string }) =>
      cancelListing(s, p.playerId, p.tileId)
    );
    on("game:buyListed", "buy_listed", (s, p: { roomId: string; playerId: string; tileId: string }) => buyListed(s, p.playerId, p.tileId));
    on("game:auctionBid", "auction_bid", (s, p: { roomId: string; playerId: string; amount: number }) => auctionBid(s, p.playerId, p.amount));
    on("game:auctionPass", "auction_pass", (s, p: { roomId: string; playerId: string }) => auctionPass(s, p.playerId));
    on("game:takeLoan", "take_loan", (s, p: { roomId: string; playerId: string; amount: number }) => takeLoan(s, p.playerId, p.amount));
    on("game:endTurn", "end_turn", (s, p: { roomId: string; playerId: string }) => endTurn(s, p.playerId));
    on(
      "game:betDecision",
      "bet",
      (s, p: { roomId: string; playerId: string; choice: "bet" | "fee"; betType?: BetType; selection?: string; stakeAmount?: number }) =>
        resolveBetOrFee(s, p.playerId, p.choice, p.betType, p.selection, p.stakeAmount)
    );
    on(
      "game:proposeTrade",
      "propose_trade",
      (
        s,
        p: {
          roomId: string;
          playerId: string;
          toPlayerId: string;
          offerCash: number;
          offerTileIds: string[];
          requestCash: number;
          requestTileIds: string[];
        }
      ) => proposeTrade(s, p.playerId, p.toPlayerId, p.offerCash, p.offerTileIds, p.requestCash, p.requestTileIds)
    );
    on("game:respondTrade", "respond_trade", (s, p: { roomId: string; playerId: string; tradeId: string; accept: boolean }) =>
      respondTrade(s, p.playerId, p.tradeId, p.accept)
    );

    // --- Chat: room-wide or a direct message only the recipient (and sender) can see ---
    socket.on("chat:send", ({ roomId, toPlayerId, message }: { roomId: string; toPlayerId?: string; message: string }) => {
      const runtime = rooms.get(roomId);
      if (!runtime || !message?.trim()) return;

      const chatMessage: ChatMessage = {
        id: `chat_${Math.random().toString(36).slice(2, 10)}`,
        fromPlayerId: authUserId,
        fromUsername: authUsername,
        toPlayerId,
        message: message.trim().slice(0, 500),
        timestamp: Date.now(),
      };

      runtime.chatHistory.push(chatMessage);
      if (runtime.chatHistory.length > 200) runtime.chatHistory.shift();

      if (toPlayerId) {
        io.to(`dm:${roomId}:${toPlayerId}`).emit("chat:message", chatMessage);
        io.to(`dm:${roomId}:${authUserId}`).emit("chat:message", chatMessage);
      } else {
        io.to(roomId).emit("chat:message", chatMessage);
      }
    });

    socket.on("room:leave", async ({ roomId }: { roomId: string }) => {
      socket.leave(roomId);
      await trackPresence(roomId, authUserId, "disconnected");
      const runtime = rooms.get(roomId);
      if (runtime?.state) {
        const player = Object.values(runtime.state.players).find((p) => p.userId === authUserId);
        if (player) player.status = "disconnected";
        broadcastState(roomId);
      }
    });

    socket.on("disconnecting", async () => {
      const roomId = socket.data.roomId as string | undefined;
      if (!roomId) return;
      await trackPresence(roomId, authUserId, "disconnected");
      const runtime = rooms.get(roomId);
      if (runtime?.state) {
        const player = Object.values(runtime.state.players).find((p) => p.userId === authUserId);
        if (player && player.status === "active") player.status = "disconnected";
        broadcastState(roomId);
      }
    });
  });

  console.log("GridPoly game server attached to the shared HTTP server.");
}