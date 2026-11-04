"use client";

import type { ReactNode } from "react";
import { Lock, WarningCircle, WifiSlash } from "@phosphor-icons/react";
import { Banner, Button } from "@recap/admin-ui";
import type { WakeLockState } from "@/audio/wake-lock";
import {
  CONNECTION_LOST,
  CONNECTION_RETRY_LABEL,
  INTERRUPTED_BODY,
  INTERRUPTED_TITLE,
  LOCK_WARNING,
  RESUME_LABEL,
  STT_FAILED,
  STT_RECONNECTING,
  WAKE_LOCK_MISSING_NOTE,
} from "./mobile-copy";
import { wakeLockNeedsManualCare, type MobileBannerKind } from "./mobile-logic";

interface MobileBannersProps {
  kinds: MobileBannerKind[];
  wakeLock: WakeLockState;
  /** Start / capture error shown on the idle screen as well. */
  error: string | null;
  onResume: () => void;
  onRetryConnection: () => void;
  onRetryStt: () => void;
}

/** Stacked notices under the header; each one says what happened and offers the one action that helps. */
export function MobileBanners(props: MobileBannersProps) {
  const { kinds, wakeLock, error, onResume, onRetryConnection, onRetryStt } = props;
  return (
    <div className="flex shrink-0 flex-col gap-2 px-3 pt-2 empty:hidden">
      {error && (
        <Banner tone="error" icon={<WarningCircle />}>
          {error}
        </Banner>
      )}
      {kinds.map((kind) => (
        <BannerFor key={kind} kind={kind} wakeLock={wakeLock}>
          {{ onResume, onRetryConnection, onRetryStt }}
        </BannerFor>
      ))}
    </div>
  );
}

interface Actions {
  onResume: () => void;
  onRetryConnection: () => void;
  onRetryStt: () => void;
}

function BannerFor({
  kind,
  wakeLock,
  children: actions,
}: {
  kind: MobileBannerKind;
  wakeLock: WakeLockState;
  children: Actions;
}) {
  switch (kind) {
    case "interrupted":
      return <InterruptedBanner onResume={actions.onResume} />;
    case "connection-lost":
      return (
        <RetryBanner
          text={CONNECTION_LOST}
          icon={<WifiSlash />}
          onRetry={actions.onRetryConnection}
        />
      );
    case "stt-failed":
      return (
        <RetryBanner text={STT_FAILED} icon={<WarningCircle />} onRetry={actions.onRetryStt} />
      );
    case "stt-reconnecting":
      return (
        <Banner tone="warn" icon={<WarningCircle />}>
          {STT_RECONNECTING}
        </Banner>
      );
    case "lock-warning":
      return <LockBanner wakeLock={wakeLock} />;
  }
}

function InterruptedBanner({ onResume }: { onResume: () => void }) {
  return (
    <Banner
      tone="error"
      icon={<WarningCircle />}
      action={
        <Button size="lg" onClick={onResume}>
          {RESUME_LABEL}
        </Button>
      }
    >
      <span>
        <strong className="block">{INTERRUPTED_TITLE}</strong>
        {INTERRUPTED_BODY}
      </span>
    </Banner>
  );
}

interface RetryBannerProps {
  text: string;
  icon: ReactNode;
  onRetry: () => void;
}

function RetryBanner({ text, icon, onRetry }: RetryBannerProps) {
  return (
    <Banner
      tone="warn"
      icon={icon}
      action={
        <Button size="sm" variant="outline" onClick={onRetry}>
          {CONNECTION_RETRY_LABEL}
        </Button>
      }
    >
      {text}
    </Banner>
  );
}

function LockBanner({ wakeLock }: { wakeLock: WakeLockState }) {
  return (
    <Banner tone="info" icon={<Lock />}>
      <span>
        <strong className="block">{LOCK_WARNING}</strong>
        {wakeLockNeedsManualCare(wakeLock) && WAKE_LOCK_MISSING_NOTE}
      </span>
    </Banner>
  );
}
