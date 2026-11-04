"use client";

import { EXTRA_INSTRUCTIONS_MAX } from "@recap/core";
import { Field, Textarea } from "@recap/admin-ui";

export const INSTRUCTIONS_HINT =
  "Chỉ thêm điểm nhấn hoặc cách trình bày, không thay đổi cấu trúc biên bản.";

interface InstructionsFieldProps {
  value: string;
  onChange: (text: string) => void;
  rows?: number;
}

/** "Hướng dẫn thêm" textarea with a live character counter. */
export function InstructionsField({ value, onChange, rows }: InstructionsFieldProps) {
  return (
    <Field
      label="Hướng dẫn thêm"
      optional
      hint={
        <>
          {INSTRUCTIONS_HINT}{" "}
          <span className="tabular-nums" aria-live="polite">
            {value.length}/{EXTRA_INSTRUCTIONS_MAX}
          </span>
        </>
      }
    >
      <Textarea
        value={value}
        rows={rows}
        maxLength={EXTRA_INSTRUCTIONS_MAX}
        placeholder="Ví dụ: Nhấn mạnh ngân sách và các mốc thời gian."
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
