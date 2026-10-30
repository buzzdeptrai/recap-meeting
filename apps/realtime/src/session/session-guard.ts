import type { SttChannelActivity, SttError, SttProvider, SttResult, SttStatus } from "@recap/stt";

/** Wraps a callback so a throw is routed to `onFail(label, error)` instead of escaping. */
export type Guard = <A extends unknown[]>(
  label: string,
  fn: (...args: A) => void,
) => (...args: A) => void;

export function makeGuard(onFail: (label: string, error: unknown) => void): Guard {
  return (label, fn) =>
    (...args) => {
      try {
        fn(...args);
      } catch (error) {
        onFail(label, error);
      }
    };
}

export interface ProviderHandlers {
  interim(result: SttResult): void;
  final(result: SttResult): void;
  status(status: SttStatus): void;
  activity(activity: SttChannelActivity): void;
  error(error: SttError): void;
}

/**
 * Subscribes to every STT event with a guard: a handler that throws would otherwise propagate out
 * of the provider's socket callback and become a process-level uncaught exception that kills
 * every other live meeting.
 */
export function attachProviderEvents(
  stt: SttProvider,
  handlers: ProviderHandlers,
  guard: Guard,
): void {
  stt.on("interim", guard("stt interim", handlers.interim));
  stt.on("final", guard("stt final", handlers.final));
  stt.on("status", guard("stt status", handlers.status));
  stt.on("activity", guard("stt activity", handlers.activity));
  stt.on("error", guard("stt error", handlers.error));
}
