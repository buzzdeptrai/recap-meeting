"use client";

import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { defaultLabels } from "../labels";

interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Ids / aria wiring provided by the surrounding `<Field>` (null outside one). */
export function useFieldControl(): FieldContextValue | null {
  return useContext(FieldContext);
}

export function Label({ className, ...rest }: ComponentProps<"label">) {
  return (
    <label
      className={cn("mb-1.5 block text-[13px] font-semibold text-soft-ink", className)}
      {...rest}
    />
  );
}

export interface FieldProps {
  label: ReactNode;
  /** Appends a muted "Không bắt buộc" to the label. */
  optional?: boolean;
  hint?: ReactNode;
  /** Error message; marks the control `aria-invalid` and is announced with it. */
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Label + control + hint/error, wired with ids. Children: `<Input>` (or anything calling `useFieldControl`). */
export function Field({ label, optional, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={className}>
        <Label htmlFor={id}>
          {label}
          {optional ? (
            <span className="font-normal text-soft-muted"> · {defaultLabels.optional}</span>
          ) : null}
        </Label>
        {children}
        {hint ? (
          <p id={hintId} className="mt-1.5 text-xs text-soft-muted">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} className="mt-1.5 text-xs font-semibold text-soft-bad">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

export type InputProps = ComponentProps<"input">;

export function Input({ className, id, "aria-describedby": describedBy, ...rest }: InputProps) {
  const field = useFieldControl();
  return (
    <input
      id={id ?? field?.id}
      aria-describedby={describedBy ?? field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(
        "soft-focus h-11 w-full rounded-xl border border-soft-line bg-soft-surface px-4 text-sm text-soft-ink shadow-soft-sm outline-none placeholder:text-soft-muted/70 focus-visible:border-soft-brand disabled:opacity-60 aria-[invalid=true]:border-soft-bad",
        className,
      )}
      {...rest}
    />
  );
}

export type TextareaProps = ComponentProps<"textarea">;

export function Textarea({
  className,
  id,
  "aria-describedby": describedBy,
  ...rest
}: TextareaProps) {
  const field = useFieldControl();
  return (
    <textarea
      id={id ?? field?.id}
      aria-describedby={describedBy ?? field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(
        "soft-focus min-h-24 w-full resize-y rounded-xl border border-soft-line bg-soft-surface px-4 py-3 text-sm leading-relaxed text-soft-ink shadow-soft-sm outline-none placeholder:text-soft-muted/70 focus-visible:border-soft-brand disabled:opacity-60 aria-[invalid=true]:border-soft-bad",
        className,
      )}
      {...rest}
    />
  );
}
