import { describe, expect, it, vi } from "vitest";
import { describeHttpStatus, testProvider } from "./provider-test";

const KEY = "sk-secret-value";
const env = { OPENAI_API_KEY: KEY };

describe("testProvider", () => {
  it("reports a missing key without calling out", async () => {
    const fetchMock = vi.fn();
    const result = await testProvider("deepgram", { env: {}, fetch: fetchMock });
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("succeeds on 2xx with latency and sends the key only as a header to the vendor", async () => {
    let t = 1000;
    const fetchMock = vi.fn(async () => {
      t += 120;
      return new Response("{}", { status: 200 });
    });
    const result = await testProvider("openai", { env, fetch: fetchMock as never, now: () => t });
    expect(result).toEqual({ ok: true, latencyMs: 120, message: "Kết nối thành công." });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/models?limit=1");
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    expect(init.method).toBe("GET");
  });

  it("maps HTTP failures and never echoes the key or body", async () => {
    const fetchMock = vi.fn(async () => new Response(`bad ${KEY}`, { status: 401 }));
    const result = await testProvider("openai", { env, fetch: fetchMock as never });
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Khóa API bị từ chối (HTTP 401).");
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it("maps timeouts and network errors", async () => {
    const timeout = vi.fn(async () => {
      throw new DOMException("t", "TimeoutError");
    });
    expect((await testProvider("openai", { env, fetch: timeout as never })).message).toBe(
      "Quá thời gian chờ 5 giây.",
    );
    const down = vi.fn(async () => {
      throw new TypeError(`fetch failed ${KEY}`);
    });
    const result = await testProvider("openai", { env, fetch: down as never });
    expect(result.message).toBe("Không kết nối được tới nhà cung cấp.");
  });

  it("describes status classes", () => {
    expect(describeHttpStatus(429)).toContain("429");
    expect(describeHttpStatus(503)).toContain("503");
  });
});
