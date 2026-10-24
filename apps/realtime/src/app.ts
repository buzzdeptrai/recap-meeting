import { createServer, type Server } from "node:http";
import type { WebSocketServer } from "ws";
import type { RealtimeDeps } from "./deps";
import { handleHttpRequest } from "./http";
import { CLOSE_GOING_AWAY, attachWebSocketServer, type WebSocketOptions } from "./ws";

export interface RealtimeServer {
  http: Server;
  wss: WebSocketServer;
  /** Starts listening; resolves with the bound port (useful with port 0 in tests). */
  listen: (port: number) => Promise<number>;
  /** Closes all sockets and the HTTP server. */
  close: () => Promise<void>;
}

/** `deps` is optional so protocol-level tests can run without a database / STT. */
export function createRealtimeServer(
  deps?: RealtimeDeps,
  options?: WebSocketOptions,
): RealtimeServer {
  const http = createServer(handleHttpRequest);
  const wss = attachWebSocketServer(http, deps, options);

  function listen(port: number): Promise<number> {
    return new Promise((resolvePort, reject) => {
      http.once("error", reject);
      http.listen(port, () => {
        http.off("error", reject);
        const address = http.address();
        resolvePort(typeof address === "object" && address ? address.port : port);
      });
    });
  }

  async function close(): Promise<void> {
    await deps?.registry.stopAll();
    await shutdownTransport();
  }

  function shutdownTransport(): Promise<void> {
    for (const client of wss.clients) client.close(CLOSE_GOING_AWAY, "Server shutting down");
    return new Promise((resolveClose, reject) => {
      wss.close();
      http.closeAllConnections();
      http.close((error) => (error ? reject(error) : resolveClose()));
    });
  }

  return { http, wss, listen, close };
}
