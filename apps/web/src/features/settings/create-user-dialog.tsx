"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button, Dialog, Field, Input, Select } from "@recap/admin-ui";
import { createUser } from "./users-api";

const FORM_ID = "create-user-form";

interface Props {
  trigger: ReactNode;
  onCreated: (email: string, tempPassword: string | undefined) => void;
}

function UserFields(props: { role: "admin" | "member"; onRole: (r: "admin" | "member") => void }) {
  return (
    <>
      <Field label="Họ tên">
        <Input name="name" required maxLength={120} autoComplete="off" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" required autoComplete="off" />
      </Field>
      <Field label="Mật khẩu" optional hint="Để trống để hệ thống tạo mật khẩu tạm dùng một lần.">
        <Input name="password" type="password" autoComplete="new-password" />
      </Field>
      <Select
        ariaLabel="Vai trò"
        prefix="Vai trò:"
        value={props.role}
        onValueChange={(v) => props.onRole(v as "admin" | "member")}
        options={[
          { value: "member", label: "Thành viên" },
          { value: "admin", label: "Quản trị viên" },
        ]}
      />
    </>
  );
}

function useCreateUser(onCreated: Props["onCreated"]) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const change = (next: boolean) => {
    if (busy) return;
    setOpen(next);
    if (!next) {
      setError(null);
      setRole("member");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "");
    setBusy(true);
    setError(null);
    try {
      const result = await createUser({ email, name, role, ...(password ? { password } : {}) });
      setOpen(false);
      setRole("member");
      onCreated(email, result.tempPassword);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tạo được người dùng.");
    } finally {
      setBusy(false);
    }
  };

  return { open, role, setRole, error, busy, change, submit };
}

/** Add-user dialog: the form lives in the body, its buttons in the shared dialog footer. */
export function CreateUserDialog({ trigger, onCreated }: Props) {
  const f = useCreateUser(onCreated);
  return (
    <Dialog
      open={f.open}
      onOpenChange={f.change}
      trigger={trigger}
      title="Thêm người dùng"
      description="Tài khoản mới đăng nhập được ngay sau khi tạo."
      error={f.error}
      busy={f.busy}
      footer={
        <>
          <Button variant="ghost" disabled={f.busy} onClick={() => f.change(false)}>
            Hủy
          </Button>
          <Button type="submit" form={FORM_ID} loading={f.busy}>
            Tạo người dùng
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={f.submit} className="flex flex-col gap-4">
        <UserFields role={f.role} onRole={f.setRole} />
      </form>
    </Dialog>
  );
}
