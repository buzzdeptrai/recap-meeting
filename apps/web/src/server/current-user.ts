import { getCurrentUser } from "./auth-page";

/** Account shown in the shell's user slot. */
export interface ShellUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
}

/** The signed-in user for the shell, or null (the shell then shows a generic "Tài khoản"). */
export async function getCurrentUserForShell(): Promise<ShellUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id, name, email, role } = user;
  return { id, name, email, role };
}
