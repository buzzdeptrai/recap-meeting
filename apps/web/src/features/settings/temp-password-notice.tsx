"use client";

import { Key } from "@phosphor-icons/react";
import { Banner, Button } from "@recap/admin-ui";

/** One-time password display. The API returns it once; nothing here persists it. */
export function TempPasswordNotice(props: {
  email: string;
  password: string;
  onClose: () => void;
}) {
  return (
    <Banner tone="warn" icon={<Key />} className="mb-4 items-start">
      <p className="font-bold">Mật khẩu tạm cho {props.email} (chỉ hiện một lần)</p>
      <p className="my-2 font-soft-mono text-base font-bold select-all">{props.password}</p>
      <p className="mb-3 text-xs font-normal">
        Gửi cho người dùng qua kênh riêng. Họ nên đổi mật khẩu sau khi đăng nhập.
      </p>
      <Button size="sm" variant="outline" onClick={props.onClose}>
        Đã sao chép, đóng
      </Button>
    </Banner>
  );
}
