import type { ReactNode } from "react";

/** Uppercase mono label that heads each part of the record. */
export function SectionLabel({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-label font-bold uppercase tracking-[0.08em] text-fg-muted">
      {children}
    </h2>
  );
}
