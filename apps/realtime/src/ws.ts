import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WS_PATH, type ServerMessage } from "@recap/core";
import { WebSocketServer, type WebSocket } from "ws";
import { sendWithBackpressure } from "./backpressure";
import { ClientConnection } from "./connection";
import type { RealtimeDeps } from "./deps";
import { startHeartbeat, trackHeartbeat } from "./heartbeat";
import {
  CLOSE_TRY_AGAIN_LATER,
  DEFAULT_MAX_CONNECTIONS,
  HEARTBEAT_INTERVAL_MS,
  MAX_PAYLOAD_BYTES,
} from "./limits";
import type { UpgradeAuthenticator } from "@recap/auth";
import { DEFAULT_ALLOWED_ORIGINS, isOriginAllowed } from "./origin";

/** Close code sent to clients when the server shuts down ("going away"). */
export const CLOSE_GOING_AWAY = 1001;

export function send(socket: WebSocket, message: ServerMessage): void {
  sendWithBackpressure(socket, message);
}

export interface WebSocketOptions {
  /** See `isOriginAllowed`; defaults to loopback hostnames. */
  allowedOrigins?: readonly string[];
  /**
   * Login check on upgrade (signed session cookie or service token). Production always passes
   * one (see server.ts); omitted only by protocol-level tests that have no user database.
   */
  authenticator?: UpgradeAuthenticator;
  /** Simultaneous clients allowed (default DEFAULT_MAX_CONNECTIONS, env REALTIME_MAX_CONNECTIONS). */
  maxConnections?: number;
  /** Ping cadence in ms (default HEARTBEAT_INTERVAL_MS; tests shorten it). */
  heartbeatIntervalMs?: number;
}

function rejectUpgrade(socket: Duplex, status = "404 Not Found"): void {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

/**
 * Clients other than `self` that are really connected. `wss.clients` already holds the new socket
 * and keeps closing ones until their handshake ends, so its raw size would over-count.
 */
function countOtherOpenClients(wss: WebSocketServer, self: WebSocket): number {
  let count = 0;
  for (const client of wss.clients) {
    if (client !== self && client.readyState === client.OPEN) count += 1;
  }
  return count;
}

/** Attaches the meeting WebSocket endpoint to `server` at WS_PATH. */
export function attachWebSocketServer(
  server: Server,
  deps?: RealtimeDeps,
  options: WebSocketOptions = {},
): WebSocketServer {
  const allowedOrigins = options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  const maxConnections = options.maxConnections ?? DEFAULT_MAX_CONNECTIONS;
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });
  /** Authenticated user per upgrade request (absent for service-token tools and unauthenticated tests). */
  const userIds = new WeakMap<IncomingMessage, string>();
  startHeartbeat(wss, options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS);

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path !== WS_PATH) return rejectUpgrade(socket);
    if (!isOriginAllowed(req.headers.origin, allowedOrigins)) {
      return rejectUpgrade(socket, "403 Forbidden");
    }
    const auth = options.authenticator?.authenticate(req.headers);
    if (auth && !auth.ok) return rejectUpgrade(socket, "401 Unauthorized");
    if (auth?.ok && auth.kind === "user") userIds.set(req, auth.user.id);
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", (socket, req) => {
    if (countOtherOpenClients(wss, socket) >= maxConnections) {
      socket.close(CLOSE_TRY_AGAIN_LATER, "Too many connections");
      return;
    }
    trackHeartbeat(socket);
    const connection = new ClientConnection(socket, deps, userIds.get(req) ?? null);
    socket.on("message", (data, isBinary) => connection.handleMessage(data, isBinary));
    socket.on("close", () => connection.handleClose());
    socket.on("error", (error) => {
      console.error("[ws] socket error:", error.message);
    });
  });
  return wss;
}
