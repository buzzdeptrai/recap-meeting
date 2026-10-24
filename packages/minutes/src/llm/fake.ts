import type { LlmRequest, MinutesLlm } from "../types";

export type FakeReply = string | object;
export type FakeResponder = (request: LlmRequest, call: number) => FakeReply | Promise<FakeReply>;

const EMPTY_REPLY = { summary: "Fake summary.", topics: [], actionItems: [], openIssues: [] };

/** Scriptable LLM for tests: a fixed reply, a list (last one repeats) or a function. */
export class FakeMinutesLlm implements MinutesLlm {
  readonly calls: LlmRequest[] = [];

  constructor(
    private readonly script: FakeReply | FakeReply[] | FakeResponder = EMPTY_REPLY,
    readonly model = "fake-model",
  ) {}

  async generate(request: LlmRequest): Promise<string> {
    const call = this.calls.push(request) - 1;
    const reply = await this.replyFor(request, call);
    return typeof reply === "string" ? reply : JSON.stringify(reply);
  }

  private replyFor(request: LlmRequest, call: number): FakeReply | Promise<FakeReply> {
    if (typeof this.script === "function") return this.script(request, call);
    if (!Array.isArray(this.script)) return this.script;
    return this.script[Math.min(call, this.script.length - 1)] ?? EMPTY_REPLY;
  }
}
