import type { WebSocket, WebSocketServer } from "ws";

/** Sockets that answered the last ping. */
const alive = new WeakSet<WebSocket>();

/** Call for every new socket: it counts as alive until the first missed pong. */
export function trackHeartbeat(socket: WebSocket): void {
  alive.add(socket);
  socket.on("pong", () => alive.add(socket));
}

/**
 * Pings every client each `intervalMs`; a client that did not answer the previous ping is
 * terminated (its `close` event then stops its session). Dead TCP connections (laptop lid, Wi-Fi
 * switch) otherwise keep a meeting "active" for minutes and block a resume. Returns a stopper.
 */
export function startHeartbeat(wss: WebSocketServer, intervalMs: number): () => void {
  const timer = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.has(socket)) {
        socket.terminate();
        continue;
      }
      alive.delete(socket);
      socket.ping();
    }
  }, intervalMs);
  timer.unref();
  const stop = () => clearInterval(timer);
  wss.once("close", stop);
  return stop;
}
