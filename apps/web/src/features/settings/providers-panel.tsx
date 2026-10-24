"use client";

import { useState } from "react";
import { ActionGroup, Banner, Card, CardHeader, Button, formatMs } from "@recap/admin-ui";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { StatusBadge } from "@/components/status-badge";
import { PROVIDER_STATUS, providerState } from "@/lib/status";
import type { ProviderStatusDto } from "@/server/provider-status";

interface TestState {
  pending: boolean;
  ok?: boolean;
  message?: string;
  latencyMs?: number | null;
}

async function runTest(vendor: string): Promise<TestState> {
  try {
    const response = await fetch("/api/settings/test-provider", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vendor }),
    });
    const body = (await response.json()) as {
      ok?: boolean;
      message?: string;
      latencyMs?: number | null;
      error?: { message?: string };
    };
    if (!response.ok) {
      return { pending: false, ok: false, message: body.error?.message ?? "Không kiểm tra được." };
    }
    return {
      pending: false,
      ok: Boolean(body.ok),
      message: body.message,
      latencyMs: body.latencyMs,
    };
  } catch {
    return { pending: false, ok: false, message: "Không gọi được máy chủ." };
  }
}

function TestResult({ state }: { state: TestState | undefined }) {
  if (!state || state.pending) return null;
  const latency = typeof state.latencyMs === "number" ? ` (${formatMs(state.latencyMs)})` : "";
  return (
    <Banner
      tone={state.ok ? "success" : "error"}
      icon={state.ok ? <CheckCircle /> : <WarningCircle />}
      className="py-2 text-xs"
    >
      {state.message}
      {latency}
    </Banner>
  );
}

interface TestRowProps {
  p: ProviderStatusDto;
  state: TestState | undefined;
  onTest: () => void;
}

/** Hint on the left, the outline test button on the right, result banner underneath. */
function TestRow({ p, state, onTest }: TestRowProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-soft-line pt-3">
      <div className="flex items-center justify-between gap-3">
        <p id={`hint-${p.id}`} className="min-w-0 text-xs text-soft-muted">
          {p.configured
            ? "Gọi một lệnh liệt kê miễn phí."
            : "Cần đặt khóa API trong tệp .env trước."}
        </p>
        <ActionGroup className="shrink-0 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onTest}
            loading={state?.pending}
            disabled={!p.configured}
            aria-describedby={`hint-${p.id}`}
          >
            Kiểm tra kết nối
          </Button>
        </ActionGroup>
      </div>
      <TestResult state={state} />
    </div>
  );
}

function ProviderCard({ p }: { p: ProviderStatusDto }) {
  const [state, setState] = useState<TestState>();
  const test = async () => {
    setState({ pending: true });
    setState(await runTest(p.id));
  };
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold">{p.label}</h3>
          <p className="text-[13px] text-soft-muted">{p.purpose}</p>
        </div>
        <StatusBadge status={PROVIDER_STATUS[providerState(p)]} />
      </div>
      <dl className="text-[13px]">
        <div className="flex justify-between gap-4 border-t border-soft-line py-2">
          <dt className="text-soft-muted">{p.keyEnv}</dt>
          <dd className="soft-tabular font-soft-mono font-bold">{p.maskedKey}</dd>
        </div>
        {p.models.map((m) => (
          <div key={m.env} className="flex justify-between gap-4 border-t border-soft-line py-2">
            <dt className="text-soft-muted">{m.env}</dt>
            <dd className="font-soft-mono font-bold">{m.set ? m.value : "mặc định"}</dd>
          </div>
        ))}
      </dl>
      <TestRow p={p} state={state} onTest={test} />
    </Card>
  );
}

export function ProvidersPanel({ providers }: { providers: ProviderStatusDto[] }) {
  return (
    <section aria-labelledby="h-providers">
      <CardHeader
        titleId="h-providers"
        title="Nhà cung cấp"
        description="Khóa API được đặt trong tệp .env ở thư mục gốc và không bao giờ gửi tới trình duyệt. “Kiểm tra kết nối” chỉ gọi một lệnh liệt kê miễn phí."
      />
      <div className="grid grid-cols-2 gap-6 max-[900px]:grid-cols-1">
        {providers.map((p) => (
          <ProviderCard key={p.id} p={p} />
        ))}
      </div>
    </section>
  );
}
