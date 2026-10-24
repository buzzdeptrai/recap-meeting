import type { MinutesLang } from "@recap/core";
import { SegmentedControl, type SegmentOption } from "@recap/admin-ui";
import { MINUTES_LANG_ORDER, langTitle } from "./minutes-langs";

const OPTIONS: ReadonlyArray<SegmentOption<MinutesLang>> = MINUTES_LANG_ORDER.map((lang) => ({
  value: lang,
  label: langTitle(lang),
}));

interface SourceLangPickerProps {
  value: MinutesLang;
  onChange: (lang: MinutesLang) => void;
}

/** Which language the minutes are written in first; the other language is translated from it. */
export function SourceLangPicker({ value, onChange }: SourceLangPickerProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[13px] font-semibold">Viết biên bản bằng</span>
      <SegmentedControl
        ariaLabel="Ngôn ngữ gốc của biên bản"
        options={OPTIONS}
        value={value}
        onValueChange={onChange}
        size="sm"
      />
      <span className="text-center text-xs text-soft-muted">
        Ngôn ngữ còn lại sẽ được dịch tự động.
      </span>
    </div>
  );
}
