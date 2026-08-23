"use client";

import { create } from "zustand";
import { getSocket } from "./socket";
import type { BetType, ChatMessage, GameState, RoomSettings } from "./game/types";

export interface WaitingPlayer {
  id: string;
  userId: string;
  username: string;
  pieceId: string;
}

export interface RoomSnapshot {
  status: "waiting" | "in_progress" | "ended";
  waitingPlayers: WaitingPlayer[];
  hostUserId: string;
  settings: RoomSettings;
  game: GameState | null;
  actionDeadline: number | null;
}

interface GameStore {
  roomId: string | null;
  userId: string | null;
  myPlayerId: string | null;
  connected: boolean;
  snapshot: RoomSnapshot | null;
  error: string | null;
  chatMessages: ChatMessage[];

  join: (roomId: string, userId: string, pieceId?: string) => void;
  leave: () => void;
  choosePiece: (pieceId: string) => void;
  start: () => void;
  endGame: () => void;
  roll: () => void;
  buyDecision: (accept: boolean) => void;
  outbidDecision: (accept: boolean) => void;
  investDecision: (invest: boolean) => void;
  betDecision: (choice: "bet" | "fee", betType?: BetType, stakeAmount?: number) => void;
  renewDecision: (renew: boolean) => void;
  takeLoan: (amount: number) => void;
  endTurn: () => void;
  payBail: () => void;
  useJailCard: () => void;
  attemptJailRoll: () => void;
  build: (tileId: string) => void;
  mortgage: (tileId: string) => void;
  unmortgage: (tileId: string) => void;
  listForSale: (tileId: string, price: number) => void;
  cancelListing: (tileId: string) => void;
  buyListed: (tileId: string) => void;
  auctionBid: (amount: number) => void;
  auctionPass: () => void;
  proposeTrade: (
    toPlayerId: string,
    offerCash: number,
    offerTileIds: string[],
    requestCash: number,
    requestTileIds: string[]
  ) => void;
  respondTrade: (tradeId: string, accept: boolean) => void;
  sendChat: (message: string, toPlayerId?: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  roomId: null,
  userId: null,
  myPlayerId: null,
  connected: false,
  snapshot: null,
  error: null,
  chatMessages: [],

  join: (roomId, userId, pieceId) => {
    const socket = getSocket();
    set({ roomId, userId, chatMessages: [], error: null });

    if (!socket.connected) socket.connect();

    socket.off("game:state");
    socket.off("room:error");
    socket.off("connect");
    socket.off("connect_error");
    socket.off("disconnect");
    socket.off("chat:message");
    socket.off("chat:history");

    socket.on("connect", () => {
      set({ connected: true, error: null });
      socket.emit("room:join", { roomId, pieceId });
    });

    socket.on("connect_error", (err: Error) => {
      set({
        connected: false,
        error:
          err.message === "unauthorized"
            ? "Couldn't verify your sign-in with the game server — try refreshing."
            : `Can't reach the game server (${process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000"}). Is it running?`,
      });
    });

    socket.on("disconnect", (reason: string) => {
      set({ connected: false });
      if (reason === "io server disconnect" || reason === "transport close") {
        set({ error: "Lost connection to the game server." });
      }
    });

    socket.on("game:state", (snapshot: RoomSnapshot) => {
      const me =
        snapshot.waitingPlayers.find((p) => p.userId === userId)?.id ??
        (snapshot.game ? Object.values(snapshot.game.players).find((p) => p.userId === userId)?.id : null) ??
        null;
      set({ snapshot, myPlayerId: me });
    });

    socket.on("room:error", ({ message }: { message: string }) => set({ error: message }));
    socket.on("chat:message", (msg: ChatMessage) => set((s) => ({ chatMessages: [...s.chatMessages, msg].slice(-200) })));
    socket.on("chat:history", (history: ChatMessage[]) => set({ chatMessages: history }));

    if (socket.connected) socket.emit("room:join", { roomId, pieceId });
  },

  leave: () => {
    const { roomId } = get();
    const socket = getSocket();
    if (roomId) socket.emit("room:leave", { roomId });
    socket.disconnect();
    set({ roomId: null, userId: null, myPlayerId: null, connected: false, snapshot: null, chatMessages: [] });
  },

  choosePiece: (pieceId) => {
    const { roomId } = get();
    if (!roomId) return;
    getSocket().emit("room:choosePiece", { roomId, pieceId });
  },

  start: () => {
    const { roomId } = get();
    if (!roomId) return;
    getSocket().emit("room:start", { roomId });
  },

  endGame: () => {
    const { roomId } = get();
    if (!roomId) return;
    getSocket().emit("game:endGame", { roomId });
  },

  roll: () => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:roll", { roomId, playerId: myPlayerId });
  },

  buyDecision: (accept) => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:buyDecision", { roomId, playerId: myPlayerId, accept });
  },

  outbidDecision: (accept) => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:outbidDecision", { roomId, playerId: myPlayerId, accept });
  },

  investDecision: (invest) => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:investDecision", { roomId, playerId: myPlayerId, invest });
  },

  betDecision: (choice, betType, stakeAmount) => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:betDecision", { roomId, playerId: myPlayerId, choice, betType, stakeAmount });
  },

  renewDecision: (renew) => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:renewDecision", { roomId, playerId: myPlayerId, renew });
  },

  takeLoan: (amount) => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:takeLoan", { roomId, playerId: myPlayerId, amount });
  },

  endTurn: () => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:endTurn", { roomId, playerId: myPlayerId });
  },

  payBail: () => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:payBail", { roomId, playerId: myPlayerId });
  },

  useJailCard: () => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:useJailCard", { roomId, playerId: myPlayerId });
  },

  attemptJailRoll: () => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:attemptJailRoll", { roomId, playerId: myPlayerId });
  },

  build: (tileId) => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:build", { roomId, playerId: myPlayerId, tileId });
  },

  mortgage: (tileId) => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:mortgage", { roomId, playerId: myPlayerId, tileId });
  },

  unmortgage: (tileId) => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:unmortgage", { roomId, playerId: myPlayerId, tileId });
  },

  listForSale: (tileId, price) => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:listForSale", { roomId, playerId: myPlayerId, tileId, price });
  },

  cancelListing: (tileId) => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:cancelListing", { roomId, playerId: myPlayerId, tileId });
  },

  buyListed: (tileId) => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:buyListed", { roomId, playerId: myPlayerId, tileId });
  },

  auctionBid: (amount) => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:auctionBid", { roomId, playerId: myPlayerId, amount });
  },

  auctionPass: () => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:auctionPass", { roomId, playerId: myPlayerId });
  },

  proposeTrade: (toPlayerId, offerCash, offerTileIds, requestCash, requestTileIds) => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:proposeTrade", {
      roomId,
      playerId: myPlayerId,
      toPlayerId,
      offerCash,
      offerTileIds,
      requestCash,
      requestTileIds,
    });
  },

  respondTrade: (tradeId, accept) => {
    const { roomId, myPlayerId } = get();
    if (!roomId || !myPlayerId) return;
    getSocket().emit("game:respondTrade", { roomId, playerId: myPlayerId, tradeId, accept });
  },

  sendChat: (message, toPlayerId) => {
    const { roomId } = get();
    if (!roomId) return;
    getSocket().emit("chat:send", { roomId, toPlayerId, message });
  },
}));









// "use client";

// import { create } from "zustand";
// import { getSocket } from "./socket";
// import type { BetType, ChatMessage, GameState, RoomSettings } from "./game/types";

// export interface WaitingPlayer {
//   id: string;
//   userId: string;
//   username: string;
//   pieceId: string;
// }

// export interface RoomSnapshot {
//   status: "waiting" | "in_progress" | "ended";
//   waitingPlayers: WaitingPlayer[];
//   hostUserId: string;
//   settings: RoomSettings;
//   game: GameState | null;
//   actionDeadline: number | null;
// }

// interface GameStore {
//   roomId: string | null;
//   userId: string | null;
//   myPlayerId: string | null;
//   connected: boolean;
//   snapshot: RoomSnapshot | null;
//   error: string | null;
//   chatMessages: ChatMessage[];

//   join: (roomId: string, userId: string, pieceId?: string) => void;
//   leave: () => void;
//   choosePiece: (pieceId: string) => void;
//   start: () => void;
//   roll: () => void;
//   buyDecision: (accept: boolean) => void;
//   outbidDecision: (accept: boolean) => void;
//   investDecision: (invest: boolean) => void;
//   betDecision: (choice: "bet" | "fee", betType?: BetType, stakeAmount?: number) => void;
//   renewDecision: (renew: boolean) => void;
//   takeLoan: (amount: number) => void;
//   endTurn: () => void;
//   payBail: () => void;
//   useJailCard: () => void;
//   attemptJailRoll: () => void;
//   build: (tileId: string) => void;
//   mortgage: (tileId: string) => void;
//   unmortgage: (tileId: string) => void;
//   listForSale: (tileId: string, price: number) => void;
//   cancelListing: (tileId: string) => void;
//   buyListed: (tileId: string) => void;
//   auctionBid: (amount: number) => void;
//   auctionPass: () => void;
//   proposeTrade: (
//     toPlayerId: string,
//     offerCash: number,
//     offerTileIds: string[],
//     requestCash: number,
//     requestTileIds: string[]
//   ) => void;
//   respondTrade: (tradeId: string, accept: boolean) => void;
//   sendChat: (message: string, toPlayerId?: string) => void;
// }

// export const useGameStore = create<GameStore>((set, get) => ({
//   roomId: null,
//   userId: null,
//   myPlayerId: null,
//   connected: false,
//   snapshot: null,
//   error: null,
//   chatMessages: [],

//   join: (roomId, userId, pieceId) => {
//     const socket = getSocket();
//     set({ roomId, userId, chatMessages: [], error: null });

//     if (!socket.connected) socket.connect();

//     socket.off("game:state");
//     socket.off("room:error");
//     socket.off("connect");
//     socket.off("connect_error");
//     socket.off("disconnect");
//     socket.off("chat:message");
//     socket.off("chat:history");

//     socket.on("connect", () => {
//       set({ connected: true, error: null });
//       socket.emit("room:join", { roomId, pieceId });
//     });

//     socket.on("connect_error", (err: Error) => {
//       set({
//         connected: false,
//         error:
//           err.message === "unauthorized"
//             ? "Couldn't verify your sign-in with the game server — try refreshing."
//             : `Can't reach the game server (${process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000"}). Is it running?`,
//       });
//     });

//     socket.on("disconnect", (reason: string) => {
//       set({ connected: false });
//       if (reason === "io server disconnect" || reason === "transport close") {
//         set({ error: "Lost connection to the game server." });
//       }
//     });

//     socket.on("game:state", (snapshot: RoomSnapshot) => {
//       const me =
//         snapshot.waitingPlayers.find((p) => p.userId === userId)?.id ??
//         (snapshot.game ? Object.values(snapshot.game.players).find((p) => p.userId === userId)?.id : null) ??
//         null;
//       set({ snapshot, myPlayerId: me });
//     });

//     socket.on("room:error", ({ message }: { message: string }) => set({ error: message }));
//     socket.on("chat:message", (msg: ChatMessage) => set((s) => ({ chatMessages: [...s.chatMessages, msg].slice(-200) })));
//     socket.on("chat:history", (history: ChatMessage[]) => set({ chatMessages: history }));

//     if (socket.connected) socket.emit("room:join", { roomId, pieceId });
//   },

//   leave: () => {
//     const { roomId } = get();
//     const socket = getSocket();
//     if (roomId) socket.emit("room:leave", { roomId });
//     socket.disconnect();
//     set({ roomId: null, userId: null, myPlayerId: null, connected: false, snapshot: null, chatMessages: [] });
//   },

//   choosePiece: (pieceId) => {
//     const { roomId } = get();
//     if (!roomId) return;
//     getSocket().emit("room:choosePiece", { roomId, pieceId });
//   },

//   start: () => {
//     const { roomId } = get();
//     if (!roomId) return;
//     getSocket().emit("room:start", { roomId });
//   },

//   roll: () => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:roll", { roomId, playerId: myPlayerId });
//   },

//   buyDecision: (accept) => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:buyDecision", { roomId, playerId: myPlayerId, accept });
//   },

//   outbidDecision: (accept) => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:outbidDecision", { roomId, playerId: myPlayerId, accept });
//   },

//   investDecision: (invest) => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:investDecision", { roomId, playerId: myPlayerId, invest });
//   },

//   betDecision: (choice, betType, stakeAmount) => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:betDecision", { roomId, playerId: myPlayerId, choice, betType, stakeAmount });
//   },

//   renewDecision: (renew) => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:renewDecision", { roomId, playerId: myPlayerId, renew });
//   },

//   takeLoan: (amount) => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:takeLoan", { roomId, playerId: myPlayerId, amount });
//   },

//   endTurn: () => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:endTurn", { roomId, playerId: myPlayerId });
//   },

//   payBail: () => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:payBail", { roomId, playerId: myPlayerId });
//   },

//   useJailCard: () => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:useJailCard", { roomId, playerId: myPlayerId });
//   },

//   attemptJailRoll: () => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:attemptJailRoll", { roomId, playerId: myPlayerId });
//   },

//   build: (tileId) => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:build", { roomId, playerId: myPlayerId, tileId });
//   },

//   mortgage: (tileId) => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:mortgage", { roomId, playerId: myPlayerId, tileId });
//   },

//   unmortgage: (tileId) => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:unmortgage", { roomId, playerId: myPlayerId, tileId });
//   },

//   listForSale: (tileId, price) => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:listForSale", { roomId, playerId: myPlayerId, tileId, price });
//   },

//   cancelListing: (tileId) => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:cancelListing", { roomId, playerId: myPlayerId, tileId });
//   },

//   buyListed: (tileId) => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:buyListed", { roomId, playerId: myPlayerId, tileId });
//   },

//   auctionBid: (amount) => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:auctionBid", { roomId, playerId: myPlayerId, amount });
//   },

//   auctionPass: () => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:auctionPass", { roomId, playerId: myPlayerId });
//   },

//   proposeTrade: (toPlayerId, offerCash, offerTileIds, requestCash, requestTileIds) => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:proposeTrade", {
//       roomId,
//       playerId: myPlayerId,
//       toPlayerId,
//       offerCash,
//       offerTileIds,
//       requestCash,
//       requestTileIds,
//     });
//   },

//   respondTrade: (tradeId, accept) => {
//     const { roomId, myPlayerId } = get();
//     if (!roomId || !myPlayerId) return;
//     getSocket().emit("game:respondTrade", { roomId, playerId: myPlayerId, tradeId, accept });
//   },

//   sendChat: (message, toPlayerId) => {
//     const { roomId } = get();
//     if (!roomId) return;
//     getSocket().emit("chat:send", { roomId, toPlayerId, message });
//   },
// }));




