import { providerKey, type ProviderId } from "./provider-status";

/** Connectivity probes: one free "list" call per vendor. Responses are never echoed back. */
export const TEST_DEADLINE_MS = 5000;

export interface ProviderTestResult {
  ok: boolean;
  latencyMs: number | null;
  message: string;
}

interface Probe {
  url: string;
  headers: (key: string) => Record<string, string>;
}

const PROBES: Record<ProviderId, Probe> = {
  deepgram: {
    url: "https://api.deepgram.com/v1/projects",
    headers: (key) => ({ Authorization: `Token ${key}` }),
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
    headers: (key) => ({ "x-goog-api-key": key }),
  },
  openai: {
    url: "https://api.openai.com/v1/models?limit=1",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  assemblyai: {
    url: "https://api.assemblyai.com/v2/transcript?limit=1",
    headers: (key) => ({ authorization: key }),
  },
};

export interface ProbeDeps {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  now?: () => number;
  deadlineMs?: number;
}

export function describeHttpStatus(status: number): string {
  if (status === 401 || status === 403) return `Khóa API bị từ chối (HTTP ${status}).`;
  if (status === 429) return "Nhà cung cấp đang giới hạn tần suất (HTTP 429).";
  if (status >= 500) return `Nhà cung cấp đang lỗi (HTTP ${status}).`;
  return `Phản hồi không mong đợi (HTTP ${status}).`;
}

export async function testProvider(
  id: ProviderId,
  deps: ProbeDeps = {},
): Promise<ProviderTestResult> {
  const key = providerKey(id, deps.env ?? process.env);
  if (!key) return { ok: false, latencyMs: null, message: "Chưa cấu hình khóa API trong .env." };
  const probe = PROBES[id];
  const now = deps.now ?? Date.now;
  const deadline = deps.deadlineMs ?? TEST_DEADLINE_MS;
  const started = now();
  try {
    const response = await (deps.fetch ?? fetch)(probe.url, {
      method: "GET",
      headers: probe.headers(key),
      signal: AbortSignal.timeout(deadline),
      cache: "no-store",
    });
    const latencyMs = now() - started;
    if (response.ok) return { ok: true, latencyMs, message: "Kết nối thành công." };
    return { ok: false, latencyMs, message: describeHttpStatus(response.status) };
  } catch (error) {
    const timedOut =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return {
      ok: false,
      latencyMs: null,
      message: timedOut
        ? `Quá thời gian chờ ${deadline / 1000} giây.`
        : "Không kết nối được tới nhà cung cấp.",
    };
  }
}
