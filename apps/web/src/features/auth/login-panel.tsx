"use client";

import { LoginForm, type LoginValues } from "@recap/admin-ui";
import { useState } from "react";
import { safeNextPath } from "@/lib/safe-redirect";

const INVALID = "Email hoặc mật khẩu không đúng.";
const LOCKED = "Bạn đã thử quá nhiều lần nên tài khoản tạm khóa. Vui lòng thử lại sau 15 phút.";
const SERVER_ERROR = "Lỗi máy chủ, chưa đăng nhập được. Vui lòng thử lại sau ít phút.";

const HTTP_UNAUTHORIZED = 401;
const HTTP_TOO_MANY = 429;

const errorFor = (status: number): string => {
  if (status === HTTP_UNAUTHORIZED) return INVALID;
  if (status === HTTP_TOO_MANY) return LOCKED;
  return SERVER_ERROR;
};

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="grid size-9 place-items-center rounded-xl bg-soft-main text-base font-bold text-white"
      >
        B
      </span>
      <span className="text-lg font-bold tracking-[-0.01em] text-soft-ink">Biên bản</span>
    </div>
  );
}

/** Posts to `/api/auth/login`, then does a full navigation so the new cookie applies everywhere. */
export function LoginPanel({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: LoginValues) {
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) return setError(errorFor(response.status));
      window.location.assign(safeNextPath(next));
    } catch {
      setError(SERVER_ERROR);
    }
  }

  return (
    <LoginForm
      onSubmit={handleSubmit}
      error={error}
      logo={<Brand />}
      title="Đăng nhập"
      description="Dùng tài khoản do quản trị viên cấp."
      footer="Quên mật khẩu? Liên hệ quản trị viên để được đặt lại."
      autoFocus
    />
  );
}
