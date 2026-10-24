export type MinutesErrorCode =
  "MEETING_NOT_FOUND" | "EMPTY_TRANSCRIPT" | "INVALID_OUTPUT" | "LLM_FAILED" | "CONFIG";

export class MinutesError extends Error {
  constructor(
    message: string,
    readonly code: MinutesErrorCode,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "MinutesError";
  }
}
