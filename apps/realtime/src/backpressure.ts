import { encodeServerMessage, type ServerMessage } from "@recap/core";
import type { WebSocket } from "ws";
import {
  CLOSE_SLOW_CONSUMER,
  HARD_BUFFER_BYTES,
  SLOW_CLOSE_GRACE_MS,
  SOFT_BUFFER_BYTES,
} from "./limits";

export interface BufferLimits {
  soft: number;
  hard: number;
}

export const DEFAULT_BUFFER_LIMITS: BufferLimits = {
  soft: SOFT_BUFFER_BYTES,
  hard: HARD_BUFFER_BYTES,
};

/** Interim text is superseded by the next one, so it is the only thing safe to drop. */
const isDroppable = (message: ServerMessage): boolean => message.type === "interim";

function closeSlowConsumer(socket: WebSocket): void {
  console.error(`[ws] closing slow client (buffered ${socket.bufferedAmount} bytes)`);
  socket.close(CLOSE_SLOW_CONSUMER, "Client too slow");
  // A stalled peer never completes the close handshake; do not hold its buffer for ws's 30 s.
  setTimeout(() => socket.terminate(), SLOW_CLOSE_GRACE_MS).unref();
}

/**
 * Sends one server message unless the client is falling behind: past the soft limit interim
 * messages are skipped, past the hard limit the socket is closed (code CLOSE_SLOW_CONSUMER).
 * Returns whether the message was handed to the socket.
 */
export function sendWithBackpressure(
  socket: WebSocket,
  message: ServerMessage,
  limits: BufferLimits = DEFAULT_BUFFER_LIMITS,
): boolean {
  if (socket.readyState !== socket.OPEN) return false;
  const buffered = socket.bufferedAmount;
  if (buffered > limits.hard) {
    closeSlowConsumer(socket);
    return false;
  }
  if (buffered > limits.soft && isDroppable(message)) return false;
  socket.send(encodeServerMessage(message));
  return true;
}
