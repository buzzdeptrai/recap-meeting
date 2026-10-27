export * from "./types";
export { SttEmitter } from "./emitter";
export { createSttProvider, type SttProviderConfig } from "./factory";
export { FakeSttProvider, fakeResult, type FakeSttOptions } from "./fake/provider";
export {
  DeepgramProvider,
  type DeepgramDeps,
  type SocketFactory,
  type SttSocket,
} from "./deepgram/provider";
export { DEEPGRAM_DEFAULTS, DEFAULT_RECONNECT, type DeepgramConfig } from "./deepgram/config";
export { buildListenUrl, capKeyterms } from "./deepgram/url";
export { parseDeepgramMessage, type ParsedMessage } from "./deepgram/parse";
export { computeBackoffMs } from "./deepgram/backoff";
export * from "./segmenter";
export { AssemblyAiProvider, type AssemblyAiDeps } from "./assemblyai/provider";
export {
  ASSEMBLYAI_DEFAULTS,
  DEFAULT_ASSEMBLYAI_MODEL,
  type AssemblyAiConfig,
} from "./assemblyai/config";
export { buildStreamUrl, capKeyterms as capAssemblyAiKeyterms } from "./assemblyai/url";
export { parseAssemblyAiMessage } from "./assemblyai/parse";
export { splitStereo } from "./assemblyai/split-stereo";
export { SilenceGate, PRE_ROLL_MS, SLEEP_LEVEL, WAKE_LEVEL } from "./silence-gate";
export type {
  GateFrame,
  GateOutput,
  GateState,
  GateTransition,
  SilenceGateConfig,
} from "./silence-gate";
export { rmsLevel } from "./audio-level";
export { GhostLineFilter, type GhostFilterOptions } from "./ghost-filter";
