// "use client";

// import { io, type Socket } from "socket.io-client";
// import { createSupabaseBrowserClient } from "./supabase/client";

// let socket: Socket | null = null;

// /** Lazily creates (and reuses) the client's connection to the room server, attaching the current Supabase access token so the server can verify identity instead of trusting a client-sent userId. */
// export function getSocket(): Socket {
//   if (!socket) {
//     socket = io(process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000", {
//       autoConnect: false,
//       transports: ["websocket"],
//       auth: (cb) => {
//         createSupabaseBrowserClient()
//           .auth.getSession()
//           .then(({ data }) => cb({ token: data.session?.access_token ?? null }));
//       },
//     });
//   }
//   return socket;
// }




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