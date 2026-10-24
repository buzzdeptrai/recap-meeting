"use client";

import { Key, Lock, LockOpen } from "@phosphor-icons/react";
import { ActionGroup, IconButton, Select, type DataColumn } from "@recap/admin-ui";
import { StatusBadge } from "@/components/status-badge";
import { USER_STATUS } from "@/lib/status";
import { formatDateTime } from "@/lib/format";
import type { UserPatch } from "./use-users";
import type { UserRow } from "./users-api";

const ROLE_OPTIONS = [
  { value: "admin", label: "Quản trị viên" },
  { value: "member", label: "Thành viên" },
];

type Mutate = (user: UserRow, patch: UserPatch) => Promise<void>;

/** Destructive account actions ask for confirmation first. */
export type UserAction = "toggle" | "reset";
export type RequestAction = (user: UserRow, action: UserAction) => void;

function actionsColumn(request: RequestAction): DataColumn<UserRow> {
  return {
    key: "actions",
    header: "",
    align: "right",
    cell: (u) => (
      <ActionGroup className="justify-end">
        <IconButton
          label={`${u.disabled ? "Mở khóa" : "Khóa"} tài khoản ${u.name}`}
          icon={u.disabled ? <LockOpen size={16} /> : <Lock size={16} />}
          size="sm"
          onClick={() => request(u, "toggle")}
        />
        <IconButton
          label={`Đặt lại mật khẩu của ${u.name}`}
          icon={<Key size={16} />}
          size="sm"
          onClick={() => request(u, "reset")}
        />
      </ActionGroup>
    ),
  };
}

export function userColumns(mutate: Mutate, request: RequestAction): DataColumn<UserRow>[] {
  return [
    {
      key: "name",
      header: "Người dùng",
      sortable: true,
      cell: (u) => (
        <span className="font-semibold">
          {u.name}
          <small className="block text-[11px] font-normal text-soft-muted">{u.email}</small>
        </span>
      ),
    },
    {
      key: "role",
      header: "Vai trò",
      cell: (u) => (
        <Select
          ariaLabel={`Vai trò của ${u.name}`}
          value={u.role}
          options={ROLE_OPTIONS}
          onValueChange={(role) => void mutate(u, { role: role as UserRow["role"] })}
        />
      ),
    },
    {
      key: "disabled",
      header: "Trạng thái",
      cell: (u) => <StatusBadge status={USER_STATUS[u.disabled ? "disabled" : "active"]} />,
    },
    {
      key: "lastLoginAt",
      header: "Đăng nhập gần nhất",
      cell: (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Chưa bao giờ"),
    },
    actionsColumn(request),
  ];
}
