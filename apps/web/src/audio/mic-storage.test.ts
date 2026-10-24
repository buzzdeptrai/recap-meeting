import { afterEach, describe, expect, it, vi } from "vitest";
import { MIC_STORAGE_KEY, loadMicChoice, saveMicChoice, subscribeMicChoice } from "./mic-storage";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("mic storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("round-trips and clears the choice", () => {
    vi.stubGlobal("localStorage", fakeStorage());
    expect(loadMicChoice()).toBeNull();
    saveMicChoice("abc");
    expect(localStorage.getItem(MIC_STORAGE_KEY)).toBe("abc");
    expect(loadMicChoice()).toBe("abc");
    saveMicChoice(null);
    expect(loadMicChoice()).toBeNull();
  });

  it("works when storage is missing or throws", () => {
    expect(loadMicChoice()).toBeNull();
    expect(() => saveMicChoice("x")).not.toThrow();
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    vi.stubGlobal("localStorage", broken);
    expect(loadMicChoice()).toBeNull();
    expect(() => saveMicChoice("x")).not.toThrow();
    expect(() => saveMicChoice(null)).not.toThrow();
  });
});

describe("subscribeMicChoice", () => {
  it("notifies on save until unsubscribed", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMicChoice(listener);
    saveMicChoice("a");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    saveMicChoice("b");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
