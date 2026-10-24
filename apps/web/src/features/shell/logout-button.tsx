"use client";

import { SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

/** Clears the session cookie, then goes to `/login`. */
export function LogoutButton() {
  const router = useRouter();
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };
  return (
    <button
      type="button"
      onClick={() => void logout()}
      aria-label="Đăng xuất"
      title="Đăng xuất"
      className="soft-focus grid size-8 shrink-0 place-items-center rounded-[10px] text-soft-muted hover:bg-soft-surface hover:text-soft-ink"
    >
      <SignOut size={16} />
    </button>
  );
}
