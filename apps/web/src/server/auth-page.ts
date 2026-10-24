import { COOKIE_NAME, type AuthUser } from "@recap/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthService } from "./auth";
import { loginUrl } from "@/lib/safe-redirect";

/** Server components / layouts: the signed-in user, or null. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  return getAuthService().getSessionUser(store.get(COOKIE_NAME)?.value);
}

/** Redirects to `/login?next=` when nobody is signed in. `nextPath` must be a relative path. */
export async function requirePageUser(nextPath = "/"): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl(nextPath));
  return user;
}

/** Admin-only pages: members go back to the home page. */
export async function requirePageAdmin(nextPath = "/"): Promise<AuthUser> {
  const user = await requirePageUser(nextPath);
  if (user.role !== "admin") redirect("/");
  return user;
}
