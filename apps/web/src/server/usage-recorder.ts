import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pricingSchema, type Pricing, type UsageSink } from "@recap/core";
import { createUsageRecorder } from "@recap/db";
import { getRepositories } from "./db";
import { findRepoRoot } from "./repo-root";

const EMPTY_PRICING: Pricing = { version: 1, currency: "USD", entries: [] };
const globalForUsage = globalThis as typeof globalThis & {
  __recapPricing?: Pricing;
  __recapUsageSink?: UsageSink;
};

/** Carries the meeting id from a service call down to the LLM usage hook (no signature changes). */
export const usageContext = new AsyncLocalStorage<{ meetingId: string }>();

/** Pricing from `<repo>/config/pricing.json`, cached; an unreadable file means "no prices". */
export function getPricing(): Pricing {
  if (globalForUsage.__recapPricing) return globalForUsage.__recapPricing;
  try {
    const file = join(findRepoRoot(process.cwd()), "config", "pricing.json");
    globalForUsage.__recapPricing = pricingSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  } catch (error) {
    console.error("[usage] pricing unavailable:", error instanceof Error ? error.message : "error");
    globalForUsage.__recapPricing = EMPTY_PRICING;
  }
  return globalForUsage.__recapPricing;
}

/** Fire-and-forget sink over the shared repositories. */
export function getUsageSink(): UsageSink {
  globalForUsage.__recapUsageSink ??= createUsageRecorder(getRepositories().usage, getPricing());
  return globalForUsage.__recapUsageSink;
}
