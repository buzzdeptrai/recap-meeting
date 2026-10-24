import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginPanel } from "@/features/auth/login-panel";
import { safeNextPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/auth-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Đăng nhập · Biên bản" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNextPath(first((await searchParams).next));
  if (await getCurrentUser()) redirect(next);
  return (
    <main className="font-soft grid min-h-dvh place-items-center bg-soft-bg px-4 py-10">
      <LoginPanel next={next} />
    </main>
  );
}
