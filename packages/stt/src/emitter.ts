import type { SttEvents, SttListener } from "./types";

type ListenerSets = { [E in keyof SttEvents]?: Set<SttListener<E>> };

/** Minimal typed emitter shared by STT providers. A throwing listener never breaks the emitter. */
export class SttEmitter {
  private readonly listeners: ListenerSets = {};

  on<E extends keyof SttEvents>(event: E, listener: SttListener<E>): () => void {
    const existing = this.listeners[event] as Set<SttListener<E>> | undefined;
    const set = existing ?? new Set<SttListener<E>>();
    (this.listeners as Record<string, unknown>)[event] = set;
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  protected emit<E extends keyof SttEvents>(event: E, payload: SttEvents[E]): void {
    const set = this.listeners[event] as Set<SttListener<E>> | undefined;
    if (!set) return;
    for (const listener of [...set]) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[stt] listener for "${event}" threw:`, error);
      }
    }
  }
}
