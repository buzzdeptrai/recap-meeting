import type { ReactNode } from "react";
import { AppFrame } from "@/features/shell/app-frame";
import { UserSlot } from "@/features/shell/user-slot";
import { getCurrentUserForShell } from "@/server/current-user";

export const dynamic = "force-dynamic";

/** Shared Soft shell for every signed-in page (`/login` lives outside this group). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUserForShell();
  return <AppFrame userMenu={<UserSlot user={user} />}>{children}</AppFrame>;
}
