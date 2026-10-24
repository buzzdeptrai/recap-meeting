import { describe, expect, it } from "vitest";
import { selectSttBanner } from "./stt-banner";

describe("selectSttBanner", () => {
  const base = { recording: true, connection: "ready" as const };

  it("shows nothing while the provider is healthy or unknown", () => {
    expect(selectSttBanner({ ...base, stt: null })).toBeNull();
    expect(selectSttBanner({ ...base, stt: "connecting" })).toBeNull();
    expect(selectSttBanner({ ...base, stt: "open" })).toBeNull();
  });

  it("warns while the provider reconnects and clears once it is open again", () => {
    expect(selectSttBanner({ ...base, stt: "reconnecting" })).toBe("reconnecting");
    expect(selectSttBanner({ ...base, stt: "open" })).toBeNull();
  });

  it("reports a provider that gave up", () => {
    expect(selectSttBanner({ ...base, stt: "closed" })).toBe("failed");
  });

  it("stays quiet when not recording", () => {
    expect(selectSttBanner({ ...base, recording: false, stt: "reconnecting" })).toBeNull();
    expect(selectSttBanner({ ...base, recording: false, stt: "closed" })).toBeNull();
  });

  it("lets the browser-server disconnect banner take precedence", () => {
    expect(
      selectSttBanner({ ...base, connection: "reconnecting", stt: "reconnecting" }),
    ).toBeNull();
    expect(selectSttBanner({ ...base, connection: "reconnecting", stt: "closed" })).toBeNull();
  });
});
