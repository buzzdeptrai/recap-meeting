import { dbPathFromEnv, loadRootEnv } from "@recap/core/node";
import { alignmentRows, formatAlignment } from "./alignment";
import { audioDurationMs, decodeToMono16k, toStereoFrames } from "./audio";
import { framesToSeconds, streamMeeting } from "./client";
import { createMeeting } from "./meeting";
import { HELP, parseOptions } from "./options";
import { createPrinter } from "./printer";
import { summarize, type RunSummary } from "./summary";

function printSummary(summary: RunSummary, framesSent: number, interrupted: boolean): void {
  const latency = summary.avgTranslationLatencyMs;
  console.log("\n--- Summary ---");
  console.log(
    `audio sent:           ${framesToSeconds(framesSent).toFixed(1)} s${interrupted ? " (interrupted)" : ""}`,
  );
  console.log(`final segments:       ${summary.segments}`);
  console.log(`translations:         ${summary.translations} (failed: ${summary.translateErrors})`);
  console.log(`avg translation time: ${latency === null ? "n/a" : `${latency} ms`}`);
  console.log(`providers used:       ${summary.providers.join(", ") || "none"}`);
  console.log(`last status:          ${JSON.stringify(summary.lastStatus)}`);
  for (const error of summary.otherErrors) console.log(`error:                ${error}`);
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  if (!options) return void console.log(HELP);
  loadRootEnv();
  const others = await decodeToMono16k(options.file);
  const mic = options.micFile ? await decodeToMono16k(options.micFile) : null;
  const frames = toStereoFrames(mic, others);
  console.log(
    `audio: ${(audioDurationMs(others.length) / 1000).toFixed(1)} s, ${frames.length} frames, speed ${options.speed}`,
  );

  const meeting = options.meetingId
    ? { id: options.meetingId, via: "existing (resume)" }
    : await createMeeting(
        { title: options.title, sourceLang: options.sourceLang, targetLang: options.targetLang },
        { webUrl: options.webUrl, dbPath: dbPathFromEnv() },
      );
  console.log(
    `meeting ${meeting.id} ${options.meetingId ? "resumed" : "created"} via ${meeting.via}`,
  );

  const interrupt = new AbortController();
  process.once("SIGINT", () => {
    console.log("\nCtrl+C: stopping...");
    interrupt.abort();
  });
  const print = createPrinter();
  const result = await streamMeeting({
    url: options.url,
    token: options.token ?? process.env.RECAP_SERVICE_TOKEN,
    start: {
      type: "start",
      meetingId: meeting.id,
      sourceLang: options.sourceLang,
      targetLang: options.targetLang,
      ...(options.meetingId ? { resume: true } : {}),
    },
    marks: options.marks,
    markClock: options.markClock,
    frames,
    speed: options.speed,
    handlers: { onMessage: print },
    interruptSignal: interrupt.signal,
  });
  printSummary(summarize(result.messages), result.framesSent, result.interrupted);
  if (result.sentMarks.length > 0) {
    console.log(`\n--- Mark alignment (--mark-clock ${options.markClock}) ---`);
    formatAlignment(alignmentRows(result.sentMarks, result.messages)).forEach((l) =>
      console.log(l),
    );
  }
}

main().catch((error: unknown) => {
  console.error(`stream-file: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
