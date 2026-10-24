import { ArrowsClockwise, Info, WarningCircle } from "@phosphor-icons/react";
import type { MinutesLang } from "@recap/core";
import type { StaleReason } from "@recap/db";
import { ActionGroup, Banner, Button } from "@recap/admin-ui";
import { translatingNotice } from "./minutes-langs";
import { staleBannerText } from "./stale-copy";

interface FailureBannerProps {
  message: string;
  /** Present for a failed generation or translation: runs it again. */
  onRetry?: () => void;
  onDismiss: () => void;
}

export function FailureBanner({ message, onRetry, onDismiss }: FailureBannerProps) {
  return (
    <Banner
      tone="error"
      icon={<WarningCircle />}
      className="mt-3"
      action={
        <ActionGroup>
          {onRetry && (
            <Button size="sm" onClick={onRetry}>
              Thử lại
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onDismiss}>
            Đóng
          </Button>
        </ActionGroup>
      }
    >
      {message}
    </Banner>
  );
}

interface StaleBannerProps {
  reasons: StaleReason[];
  /** A translation offers "Dịch lại"; source minutes offer "Tạo lại". */
  derived: boolean;
  onAct: () => void;
}

export function StaleBanner({ reasons, derived, onAct }: StaleBannerProps) {
  return (
    <Banner
      tone="warn"
      icon={<Info />}
      className="mt-3"
      action={
        <Button size="sm" variant="outline" onClick={onAct}>
          {derived ? "Dịch lại" : "Tạo lại"}
        </Button>
      }
    >
      {staleBannerText(reasons)}
    </Banner>
  );
}

/** Source minutes are usable while the other language is still being translated. */
export function TranslatingBanner({ into }: { into: MinutesLang }) {
  return (
    <Banner tone="info" icon={<ArrowsClockwise />} className="mt-3">
      {translatingNotice(into)}
    </Banner>
  );
}
