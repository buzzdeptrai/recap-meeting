import { AssemblyAiProvider } from "./assemblyai/provider";
import type { AssemblyAiConfig } from "./assemblyai/config";
import { DeepgramProvider, type DeepgramDeps } from "./deepgram/provider";
import type { DeepgramConfig } from "./deepgram/config";
import { FakeSttProvider, type FakeSttOptions } from "./fake/provider";
import type { SttProvider } from "./types";

export type SttProviderConfig =
  | ({ provider: "deepgram" } & DeepgramConfig)
  | ({ provider: "assemblyai" } & AssemblyAiConfig)
  | ({ provider: "fake" } & FakeSttOptions);

/** Single place that maps configuration to a concrete provider. */
export function createSttProvider(config: SttProviderConfig, deps: DeepgramDeps = {}): SttProvider {
  switch (config.provider) {
    case "deepgram":
      return new DeepgramProvider(config, deps);
    case "assemblyai":
      return new AssemblyAiProvider(config, deps);
    case "fake":
      return new FakeSttProvider(config);
  }
}
