import { Check, Info } from "@phosphor-icons/react";
import type { GuideNote } from "./guide-content";

/** Hand-drawn stand-in for the native browser share dialog row (it cannot be screenshotted). */
function ShareTabAudioIllustration() {
  return (
    <figure
      className="mt-3 w-fit max-w-full"
      aria-label="Hình minh họa ô tích Chia sẻ âm thanh tab"
    >
      <div className="flex items-center gap-3 rounded-xl border border-soft-line bg-soft-surface px-4 py-3">
        <span
          aria-hidden="true"
          className="grid size-5 shrink-0 place-items-center rounded-md bg-soft-brand text-white"
        >
          <Check size={14} weight="bold" />
        </span>
        <span className="text-sm font-bold text-soft-ink">Chia sẻ âm thanh tab</span>
      </div>
      <figcaption className="mt-1.5 text-xs text-soft-muted">
        Hình minh họa, không phải ảnh chụp hộp thoại thật của trình duyệt.
      </figcaption>
    </figure>
  );
}

/** "Lưu ý" block for the easy-to-miss part of a step. */
export function GuideCallout({ note }: { note: GuideNote }) {
  return (
    <aside
      aria-label="Lưu ý"
      className="mt-3 rounded-xl border-l-4 border-soft-brand bg-soft-accent-soft px-4 py-3"
    >
      <p className="flex items-start gap-2 text-sm text-soft-ink">
        <Info
          aria-hidden="true"
          size={18}
          weight="fill"
          className="mt-0.5 shrink-0 text-soft-brand"
        />
        <span>
          <strong className="font-bold text-soft-accent-ink">Lưu ý: </strong>
          {note.text}
        </span>
      </p>
      {note.illustration === "share-tab-audio" ? <ShareTabAudioIllustration /> : null}
    </aside>
  );
}
