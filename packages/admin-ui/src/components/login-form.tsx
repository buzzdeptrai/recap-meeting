"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { defaultLabels, type Labels } from "../labels";
import { Button } from "./button";
import { Card } from "./card";
import { EyeIcon, EyeOffIcon } from "./icons";
import { Field, Input } from "./field";

export interface LoginValues {
  email: string;
  password: string;
  remember: boolean;
}

export interface LoginFormProps {
  /** May be async; the form shows the loading state until it settles. Throwing shows nothing: set `error` yourself. */
  onSubmit: (values: LoginValues) => void | Promise<void>;
  /** Externally controlled loading (e.g. a server action pending). */
  loading?: boolean;
  /** Error slot, rendered with `role="alert"` above the button. */
  error?: ReactNode;
  /** Brand block above the title (logo tile, name). */
  logo?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  defaultEmail?: string;
  showRemember?: boolean;
  /** Below the button: help link, SSO, ... */
  footer?: ReactNode;
  labels?: Partial<
    Pick<
      Labels,
      "email" | "password" | "remember" | "signIn" | "signingIn" | "showPassword" | "hidePassword"
    >
  >;
  /** Native autocomplete hints. */
  autoFocus?: boolean;
}

/** Email + password sign-in card. Presentation + local state only; authentication is the host's job. */
export function LoginForm({
  onSubmit,
  loading = false,
  error,
  logo,
  title,
  description,
  defaultEmail = "",
  showRemember = true,
  footer,
  labels,
  autoFocus,
}: LoginFormProps) {
  const t = { ...defaultLabels, ...labels };
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = loading || pending;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setPending(true);
    try {
      await onSubmit({ email: email.trim(), password, remember });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-sm p-6 sm:p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-busy={busy || undefined}>
        {logo ? <div className="mb-1">{logo}</div> : null}
        {title ? (
          <h1 className="text-2xl font-bold tracking-[-0.01em] text-soft-ink">{title}</h1>
        ) : null}
        {description ? <p className="-mt-2 text-[13px] text-soft-muted">{description}</p> : null}
        <Field label={t.email}>
          <Input
            type="email"
            name="email"
            autoComplete="username"
            required
            autoFocus={autoFocus}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label={t.password}>
          <div className="relative">
            <Input
              type={revealed ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              required
              className="pr-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              aria-label={revealed ? t.hidePassword : t.showPassword}
              aria-pressed={revealed}
              onClick={() => setRevealed((v) => !v)}
              className="soft-focus absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-soft-muted hover:text-soft-ink"
            >
              {revealed ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </Field>
        {showRemember ? (
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-soft-muted">
            <input
              type="checkbox"
              name="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="soft-focus size-4 cursor-pointer accent-soft-brand"
            />
            {t.remember}
          </label>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="rounded-xl bg-[#fde4e4] px-4 py-3 text-[13px] font-semibold text-[#a30606]"
          >
            {error}
          </div>
        ) : null}
        <Button type="submit" size="lg" loading={busy} className="w-full">
          {busy ? t.signingIn : t.signIn}
        </Button>
        {footer ? <div className="text-center text-xs text-soft-muted">{footer}</div> : null}
      </form>
    </Card>
  );
}
