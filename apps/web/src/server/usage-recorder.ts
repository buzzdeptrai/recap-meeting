import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pricingSchema, type Pricing } from "@recap/core";
import { findRepoRoot } from "./repo-root";

const EMPTY_PRICING: Pricing = { version: 1, currency: "USD", entries: [] };
const globalForUsage = globalThis as typeof globalThis & { __recapPricing?: Pricing };

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
