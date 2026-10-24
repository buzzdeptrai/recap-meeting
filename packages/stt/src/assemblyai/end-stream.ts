import type { SttSocket } from "../deepgram/provider";

const TERMINATE_MESSAGE = JSON.stringify({ type: "Terminate" });

/** Sends Terminate and resolves when the server closes the socket (or `timeoutMs` passes, then terminates it). */
export function endStream(socket: SttSocket, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      socket.terminate();
      resolve();
    }, timeoutMs);
    socket.on("close", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.send(TERMINATE_MESSAGE);
  });
}
