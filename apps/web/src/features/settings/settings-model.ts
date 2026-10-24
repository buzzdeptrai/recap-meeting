import type { Pricing } from "@recap/core";
import { getProviderStatuses, type ProviderStatusDto } from "@/server/provider-status";
import { SERVICE_LABEL, VENDOR_LABEL } from "@/features/usage/usage-model";
import { formatUsd } from "@recap/admin-ui";

/** Plain, serialisable data for `/settings`. Built on the server; contains no secrets. */
export interface PricingRow {
  id: string;
  vendor: string;
  service: string;
  model: string;
  price: string;
  verified: boolean;
  sourceUrl: string;
  sourceHost: string;
  updatedAt: string;
  notes: string | null;
}

export interface BudgetSetting {
  monthlyUsd: number;
  /** True when `USAGE_MONTHLY_BUDGET_USD` is set to a usable value (otherwise the default applies). */
  fromEnv: boolean;
  alertUsd: number;
}

export interface SettingsModel {
  providers: ProviderStatusDto[];
  pricing: PricingRow[];
  budget: BudgetSetting;
}

export const DEFAULT_BUDGET_USD = 60;
const ALERT_RATIO = 0.8;

export function priceText(e: Pricing["entries"][number]): string {
  if (e.audioPerMinute !== undefined) return `${formatUsd(e.audioPerMinute, 4)} / phút kênh`;
  if (e.inputPer1M !== undefined || e.outputPer1M !== undefined) {
    const input = e.inputPer1M === undefined ? "–" : formatUsd(e.inputPer1M);
    const output = e.outputPer1M === undefined ? "–" : formatUsd(e.outputPer1M);
    return `vào ${input} · ra ${output} / 1 triệu token`;
  }
  return "–";
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function pricingRows(pricing: Pricing): PricingRow[] {
  return pricing.entries.map((e) => ({
    id: `${e.vendor}/${e.service}/${e.model}`,
    vendor: VENDOR_LABEL[e.vendor] ?? e.vendor,
    service: SERVICE_LABEL[e.service] ?? e.service,
    model: e.model,
    price: priceText(e),
    verified: e.verified,
    sourceUrl: e.source_url,
    sourceHost: hostOf(e.source_url),
    updatedAt: e.updated_at,
    notes: e.notes ?? null,
  }));
}

export function budgetSetting(env: Record<string, string | undefined>): BudgetSetting {
  const raw = Number(env.USAGE_MONTHLY_BUDGET_USD);
  const fromEnv = Number.isFinite(raw) && raw > 0;
  const monthlyUsd = fromEnv ? raw : DEFAULT_BUDGET_USD;
  return { monthlyUsd, fromEnv, alertUsd: monthlyUsd * ALERT_RATIO };
}

export function buildSettingsModel(
  pricing: Pricing,
  env: Record<string, string | undefined> = process.env,
): SettingsModel {
  return {
    providers: getProviderStatuses(env),
    pricing: pricingRows(pricing),
    budget: budgetSetting(env),
  };
}
