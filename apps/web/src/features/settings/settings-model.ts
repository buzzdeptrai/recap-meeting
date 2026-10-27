/** Plain, serialisable data for `/settings`. Built on the server; contains no secrets. */
export interface BudgetSetting {
  monthlyUsd: number;
  /** True when `USAGE_MONTHLY_BUDGET_USD` is set to a usable value (otherwise the default applies). */
  fromEnv: boolean;
  alertUsd: number;
}

export interface SettingsModel {
  budget: BudgetSetting;
}

export const DEFAULT_BUDGET_USD = 60;
const ALERT_RATIO = 0.8;

export function budgetSetting(env: Record<string, string | undefined>): BudgetSetting {
  const raw = Number(env.USAGE_MONTHLY_BUDGET_USD);
  const fromEnv = Number.isFinite(raw) && raw > 0;
  const monthlyUsd = fromEnv ? raw : DEFAULT_BUDGET_USD;
  return { monthlyUsd, fromEnv, alertUsd: monthlyUsd * ALERT_RATIO };
}

export function buildSettingsModel(
  env: Record<string, string | undefined> = process.env,
): SettingsModel {
  return { budget: budgetSetting(env) };
}
