import Link from "next/link";
import type { ReactNode } from "react";
import { FileText } from "@phosphor-icons/react/dist/ssr";
import { Card, IconTile } from "@recap/admin-ui";

/** Soft-styled page for failures outside the app shell (unknown URL, crash before the shell mounts). */
export function StandalonePage({ children }: { children: ReactNode }) {
  return (
    <div className="font-soft min-h-dvh bg-soft-bg px-4 py-6 text-soft-ink">
      <Link
        href="/"
        aria-label="Biên bản, trang chủ"
        className="soft-focus mb-10 inline-flex items-center gap-3 rounded-xl"
      >
        <IconTile tone="main" size="sm">
          <FileText weight="regular" />
        </IconTile>
        <span className="text-[15px] font-bold">Biên bản</span>
      </Link>
      <main className="mx-auto max-w-xl">
        <Card>{children}</Card>
      </main>
    </div>
  );
}
