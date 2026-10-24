export type ProviderErrorCode =
  "TIMEOUT" | "RATE_LIMIT" | "QUOTA" | "AUTH" | "SERVER" | "EMPTY_OUTPUT" | "ABORTED";

const HTTP_UNAUTHORIZED = 401;
const HTTP_PAYMENT_REQUIRED = 402;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY_REQUESTS = 429;

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: ProviderErrorCode,
    readonly provider: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface ProviderAttempt {
  provider: string;
  code: ProviderErrorCode | "BREAKER_OPEN";
  message: string;
}

export class AllProvidersFailedError extends Error {
  constructor(readonly attempts: readonly ProviderAttempt[]) {
    super(
      `All translation providers failed: ${attempts.map((a) => `${a.provider}=${a.code}`).join(", ") || "none available"}`,
    );
    this.name = "AllProvidersFailedError";
  }
}

export class TranslateInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TranslateInputError";
  }
}

function statusToCode(status: unknown): ProviderErrorCode {
  if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN) return "AUTH";
  if (status === HTTP_TOO_MANY_REQUESTS) return "RATE_LIMIT";
  if (status === HTTP_PAYMENT_REQUIRED) return "QUOTA";
  return "SERVER";
}

/** Maps any thrown value (SDK error, fetch error, ProviderError) to a ProviderError. */
export function classifyError(err: unknown, provider: string): ProviderError {
  if (err instanceof ProviderError) return err;
  const message = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: unknown } | null)?.status;
  return new ProviderError(message, statusToCode(status), provider);
}
