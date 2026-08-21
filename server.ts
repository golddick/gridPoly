


import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { attachGameServer } from "./server/gameServer";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "localhost";
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // IMPORTANT: this request listener must be registered first — Socket.IO's
  // engine (attached below) takes over routing for its own path prefix and
  // transparently forwards every other request to this Next.js handler, but
  // only if this listener already exists on the server when Socket.IO attaches.
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN ?? `http://${hostname}:${port}` },
  });

  attachGameServer(io);

  httpServer.listen(port, () => {
    console.log(`> Gridpoly ready on http://${hostname}:${port} — Next.js + the game server, one process.`);
  });
});