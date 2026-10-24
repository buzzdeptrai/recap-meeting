import { z } from "zod";

export const USAGE_VENDORS = ["deepgram", "gemini", "openai", "assemblyai"] as const;
export const USAGE_SERVICES = ["stt_live", "translate", "minutes", "stt_batch"] as const;
export const USAGE_STATUSES = ["ok", "error", "fallback"] as const;

export type UsageVendor = (typeof USAGE_VENDORS)[number];
export type UsageService = (typeof USAGE_SERVICES)[number];
export type UsageStatus = (typeof USAGE_STATUSES)[number];

/** One metered vendor call (or one STT session slice), before cost is attached. */
export interface UsageEventInput {
  meetingId?: string | null;
  vendor: UsageVendor;
  service: UsageService;
  model: string;
  audioSeconds?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  requests?: number;
  latencyMs?: number | null;
  status: UsageStatus;
  meta?: Record<string, unknown> | null;
}

/** Fire-and-forget sink; implementations must never throw into the hot path. */
export type UsageSink = (event: UsageEventInput) => void;

const price = z.number().nonnegative();

export const pricingEntrySchema = z.object({
  vendor: z.enum(USAGE_VENDORS),
  service: z.enum(USAGE_SERVICES),
  model: z.string().min(1),
  /** USD per audio minute (STT). */
  audioPerMinute: price.optional(),
  /** USD per 1M tokens (LLM). */
  inputPer1M: price.optional(),
  outputPer1M: price.optional(),
  verified: z.boolean(),
  source_url: z.string().url(),
  updated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

export const pricingSchema = z.object({
  version: z.literal(1),
  currency: z.literal("USD"),
  entries: z.array(pricingEntrySchema),
});

export type PricingEntry = z.infer<typeof pricingEntrySchema>;
export type Pricing = z.infer<typeof pricingSchema>;

const SECONDS_PER_MINUTE = 60;
const TOKENS_PER_PRICE_UNIT = 1_000_000;
const MONO_SUFFIX = ":mono";

type CostFields = Pick<
  UsageEventInput,
  "vendor" | "service" | "model" | "audioSeconds" | "inputTokens" | "outputTokens" | "meta"
>;

/** Single-language Deepgram sessions use the `<model>:mono` price when one exists. */
export function findPricing(event: CostFields, pricing: Pricing): PricingEntry | undefined {
  const language = event.meta?.language;
  const mono = typeof language === "string" && language !== "multi" && language !== "detect";
  const keys = mono ? [event.model + MONO_SUFFIX, event.model] : [event.model];
  for (const model of keys) {
    const hit = pricing.entries.find(
      (e) => e.vendor === event.vendor && e.service === event.service && e.model === model,
    );
    if (hit) return hit;
  }
  return undefined;
}

/** Cost of `amount` units at `perUnit` per `unit`; null when either side is missing. */
function part(amount: number | null | undefined, perUnit: number | undefined, unit: number) {
  if (amount === undefined || amount === null || perUnit === undefined) return null;
  return (amount / unit) * perUnit;
}

/** USD cost of one event, or null when no price is configured for it (never guesses). */
export function computeCostUsd(event: CostFields, pricing: Pricing): number | null {
  const entry = findPricing(event, pricing);
  if (!entry) return null;
  const parts = [
    part(event.audioSeconds, entry.audioPerMinute, SECONDS_PER_MINUTE),
    part(event.inputTokens, entry.inputPer1M, TOKENS_PER_PRICE_UNIT),
    part(event.outputTokens, entry.outputPer1M, TOKENS_PER_PRICE_UNIT),
  ].filter((value): value is number => value !== null);
  return parts.length > 0 ? parts.reduce((a, b) => a + b, 0) : null;
}
