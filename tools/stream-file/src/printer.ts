import type { ServerMessage } from "@recap/core";

const CLEAR_LINE = "\r\x1b[K";
const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;
const CHANNEL_LABEL = ["Tôi   ", "Khác  "] as const;

export function formatTime(ms: number): string {
  const total = ms / MS_PER_SECOND;
  const minutes = Math.floor(total / SECONDS_PER_MINUTE);
  const seconds = (total % SECONDS_PER_MINUTE).toFixed(1).padStart(4, "0");
  return `${String(minutes).padStart(2, "0")}:${seconds}`;
}

/** Console renderer: interim overwrites one line, finals and translations are appended. */
export function createPrinter(
  write: (text: string) => void = (t) => process.stdout.write(t),
  showInterim = process.stdout.isTTY === true,
) {
  let interimShown = false;
  const clearInterim = () => {
    if (interimShown) write(CLEAR_LINE);
    interimShown = false;
  };
  const line = (text: string) => {
    clearInterim();
    write(`${text}\n`);
  };
  return function print(message: ServerMessage): void {
    switch (message.type) {
      case "interim":
        if (!showInterim) return;
        write(`${CLEAR_LINE}  ... ${message.text}`);
        interimShown = true;
        return;
      case "segment": {
        const { segment } = message;
        const lang = segment.lang ? ` (${segment.lang})` : "";
        line(
          `[${formatTime(segment.startMs)}] #${segment.seq} ${CHANNEL_LABEL[segment.channel]}${lang} ${segment.text}`,
        );
        return;
      }
      case "translation":
        line(
          `      -> #${message.seq} [${message.lang}] ${message.text}  (${message.provider}, ${message.latencyMs} ms)`,
        );
        return;
      case "error":
        line(
          `  !! ${message.code}: ${message.message}${message.segmentId ? ` [${message.segmentId}]` : ""}`,
        );
        return;
      case "mark":
        line(`  ** mark ${message.mark.kind} @ ${formatTime(message.mark.atMs)}`);
        return;
      default:
    }
  };
}
