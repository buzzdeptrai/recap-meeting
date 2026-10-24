import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WS_PATH, encodeServerMessage, type ServerMessage } from "@recap/core";
import { WebSocketServer, type WebSocket } from "ws";
import { ClientConnection } from "./connection";
import type { RealtimeDeps } from "./deps";
import { CLOSE_TRY_AGAIN_LATER, MAX_CONNECTIONS, MAX_PAYLOAD_BYTES } from "./limits";
import type { UpgradeAuthenticator } from "@recap/auth";
import { DEFAULT_ALLOWED_ORIGINS, isOriginAllowed } from "./origin";

/** Close code sent to clients when the server shuts down ("going away"). */
export const CLOSE_GOING_AWAY = 1001;

export function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(encodeServerMessage(message));
}

export interface WebSocketOptions {
  /** See `isOriginAllowed`; defaults to loopback hostnames. */
  allowedOrigins?: readonly string[];
  /**
   * Login check on upgrade (signed session cookie or service token). Production always passes
   * one (see server.ts); omitted only by protocol-level tests that have no user database.
   */
  authenticator?: UpgradeAuthenticator;
}

function rejectUpgrade(socket: Duplex, status = "404 Not Found"): void {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

/** Attaches the meeting WebSocket endpoint to `server` at WS_PATH. */
export function attachWebSocketServer(
  server: Server,
  deps?: RealtimeDeps,
  options: WebSocketOptions = {},
): WebSocketServer {
  const allowedOrigins = options.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path !== WS_PATH) return rejectUpgrade(socket);
    if (!isOriginAllowed(req.headers.origin, allowedOrigins)) {
      return rejectUpgrade(socket, "403 Forbidden");
    }
    if (options.authenticator && !options.authenticator.authenticate(req.headers).ok) {
      return rejectUpgrade(socket, "401 Unauthorized");
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", (socket) => {
    if (wss.clients.size > MAX_CONNECTIONS) {
      socket.close(CLOSE_TRY_AGAIN_LATER, "Too many connections");
      return;
    }
    const connection = new ClientConnection(socket, deps);
    socket.on("message", (data, isBinary) => connection.handleMessage(data, isBinary));
    socket.on("close", () => connection.handleClose());
    socket.on("error", (error) => {
      console.error("[ws] socket error:", error.message);
    });
  });
  return wss;
}
