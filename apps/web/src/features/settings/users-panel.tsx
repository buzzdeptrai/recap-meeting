"use client";

import { useState } from "react";
import { Plus, WarningCircle } from "@phosphor-icons/react";
import { Banner, Button, Card, CardHeader, ConfirmDialog, DataTable } from "@recap/admin-ui";
import { CreateUserDialog } from "./create-user-dialog";
import { TempPasswordNotice } from "./temp-password-notice";
import { useUsers } from "./use-users";
import { userColumns, type UserAction } from "./users-columns";
import type { UserRow } from "./users-api";
import type { UserPatch } from "./use-users";

interface Pending {
  user: UserRow;
  action: UserAction;
}

function confirmCopy({ user, action }: Pending) {
  if (action === "reset") {
    return {
      title: "Đặt lại mật khẩu?",
      description: `Mật khẩu hiện tại của ${user.name} sẽ không dùng được nữa. Hệ thống tạo mật khẩu tạm để bạn gửi cho họ.`,
      confirmLabel: "Đặt lại mật khẩu",
      destructive: false,
    };
  }
  return user.disabled
    ? {
        title: "Mở khóa tài khoản?",
        description: `${user.name} sẽ đăng nhập lại được.`,
        confirmLabel: "Mở khóa",
        destructive: false,
      }
    : {
        title: "Khóa tài khoản?",
        description: `${user.name} sẽ bị đăng xuất và không đăng nhập được cho đến khi bạn mở khóa.`,
        confirmLabel: "Khóa tài khoản",
        destructive: true,
      };
}

interface UserConfirmProps {
  pending: Pending | null;
  onClose: () => void;
  apply: (user: UserRow, patch: UserPatch) => Promise<void>;
}

/** Confirmation for lock / unlock / reset. Keeps the last copy while the dialog fades out. */
function UserConfirm({ pending, onClose, apply }: UserConfirmProps) {
  const [shown, setShown] = useState<Pending | null>(pending);
  if (pending && pending !== shown) setShown(pending);
  const copy = shown ? confirmCopy(shown) : null;
  return (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => !open && onClose()}
      title={copy?.title ?? ""}
      description={copy?.description}
      confirmLabel={copy?.confirmLabel ?? ""}
      destructive={copy?.destructive ?? false}
      onConfirm={async () => {
        if (!pending) return;
        const { user, action } = pending;
        await apply(
          user,
          action === "reset" ? { resetPassword: true } : { disabled: !user.disabled },
        );
      }}
    />
  );
}

export function UsersPanel() {
  const { users, error, secret, setSecret, reload, mutate, apply } = useUsers();
  const [pending, setPending] = useState<Pending | null>(null);
  const request = (user: UserRow, action: UserAction) => setPending({ user, action });
  return (
    <Card as="section" aria-labelledby="h-users">
      <CardHeader
        titleId="h-users"
        title="Người dùng"
        description="Tài khoản đăng nhập vào Biên bản. Chỉ quản trị viên thấy mục này."
        action={
          <CreateUserDialog
            onCreated={(email, password) => {
              if (password) setSecret({ email, password });
              reload();
            }}
            trigger={
              <Button size="sm" icon={<Plus size={14} weight="bold" />}>
                Thêm người dùng
              </Button>
            }
          />
        }
      />
      {secret ? <TempPasswordNotice {...secret} onClose={() => setSecret(null)} /> : null}
      {error ? (
        <Banner tone="error" icon={<WarningCircle />} className="mb-3">
          {error}
        </Banner>
      ) : null}
      {users === null && !error ? (
        <p className="py-6 text-center text-[13px] text-soft-muted">Đang tải…</p>
      ) : (
        <DataTable
          caption="Danh sách người dùng"
          columns={userColumns(mutate, request)}
          rows={users ?? []}
          rowKey={(u) => u.id}
          minWidth={760}
          empty="Chưa có người dùng nào."
        />
      )}
      <UserConfirm pending={pending} onClose={() => setPending(null)} apply={apply} />
    </Card>
  );
}
