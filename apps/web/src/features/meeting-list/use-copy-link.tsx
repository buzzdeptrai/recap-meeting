"use client";

import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { Banner } from "@recap/admin-ui";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { roomHref } from "./meeting-format";

const NOTICE_MS = 2_500;

interface Notice {
  tone: "success" | "error";
  text: string;
}

/** Copies a meeting's absolute link and shows a short polite confirmation. */
export function useCopyLink(): { copy: (id: string) => void; notice: ReactNode } {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const copy = useCallback((id: string) => {
    const url = `${window.location.origin}${roomHref(id)}`;
    const show = (next: Notice) => {
      clearTimeout(timer.current);
      setNotice(next);
      timer.current = setTimeout(() => setNotice(null), NOTICE_MS);
    };
    navigator.clipboard.writeText(url).then(
      () => show({ tone: "success", text: "Đã sao chép liên kết cuộc họp" }),
      () =>
        show({
          tone: "error",
          text: "Không sao chép được liên kết. Hãy sao chép từ thanh địa chỉ.",
        }),
    );
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const view = notice ? (
    <div role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-sm">
      <Banner
        tone={notice.tone}
        icon={notice.tone === "success" ? <CheckCircle /> : <WarningCircle />}
        className="shadow-soft-pop"
      >
        {notice.text}
      </Banner>
    </div>
  ) : null;
  return { copy, notice: view };
}
