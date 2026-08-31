"use client";

import { io, type Socket } from "socket.io-client";
import { createSupabaseBrowserClient } from "./supabase/client";

let socket: Socket | null = null;

/** Lazily creates (and reuses) the client's connection to the game server. Now that Next.js and Socket.IO share one process/port, this connects to the same origin the page was loaded from by default — no separate URL needed. Set NEXT_PUBLIC_WS_URL only if the game server is genuinely hosted elsewhere. */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL || undefined, {
      autoConnect: false,
      transports: ["websocket"],
      auth: (cb) => {
        createSupabaseBrowserClient()
          .auth.getSession()
          .then(({ data }) => cb({ token: data.session?.access_token ?? null }));
      },
    });
  }
  return socket;
}