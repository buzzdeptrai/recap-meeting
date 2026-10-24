import { UserCircle } from "@phosphor-icons/react/dist/ssr";
import type { ShellUser } from "@/server/current-user";
import { LogoutButton } from "./logout-button";

const ROLE_LABEL: Record<ShellUser["role"], string> = {
  admin: "Quản trị viên",
  member: "Thành viên",
};

/** Bottom of the sidebar. `null` (no session system yet) renders a quiet placeholder. */
export function UserSlot({ user }: { user: ShellUser | null }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-soft-bg px-3 py-2">
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-full bg-soft-fill text-soft-muted"
      >
        <UserCircle size={20} />
      </span>
      <span className="min-w-0 leading-tight">
        <b className="block truncate text-[13px]">{user?.name ?? "Tài khoản"}</b>
        <small className="block truncate text-[11px] text-soft-muted">
          {user ? ROLE_LABEL[user.role] : "Chưa đăng nhập"}
        </small>
      </span>
      {user ? (
        <span className="ml-auto">
          <LogoutButton />
        </span>
      ) : null}
    </div>
  );
}
