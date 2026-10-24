import type { ErrorCode, ServerMessage } from "@recap/core";
import { log } from "./safe";

/**
 * Runs a mark edit and reports the outcome to the client.
 * `null` = unknown mark (BAD_MESSAGE), a throw = persistence failure (INTERNAL).
 */
export function runMarkAction(
  send: (message: ServerMessage) => void,
  failure: string,
  action: () => ServerMessage | null,
): void {
  const error = (code: ErrorCode, message: string) => send({ type: "error", code, message });
  try {
    const event = action();
    if (event) send(event);
    else error("BAD_MESSAGE", "Unknown mark");
  } catch (cause) {
    log(`failed to ${failure}`, cause);
    error("INTERNAL", `Could not ${failure}`);
  }
}
