import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Badge,
  Banner,
  Button,
  Field,
  IconButton,
  Input,
  Kbd,
  LevelMeter,
  SegmentedControl,
  Textarea,
  buttonVariants,
  confirmErrorMessage,
  iconButtonVariants,
} from "../src";

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("Button", () => {
  it("shows the leading icon, and swaps it for a spinner while loading", () => {
    expect(html(<Button icon={<i data-testid="ic" />}>Lưu</Button>)).toContain('data-testid="ic"');
    const loading = html(
      <Button loading icon={<i data-testid="ic" />}>
        Lưu
      </Button>,
    );
    expect(loading).not.toContain('data-testid="ic"');
    expect(loading).toContain("<svg");
  });

  it("danger and primary keep white text on a dark enough gradient", () => {
    expect(buttonVariants({ variant: "danger" })).toContain("text-white");
    expect(buttonVariants({ variant: "danger" })).not.toContain("bg-soft-red");
    expect(buttonVariants({ size: "icon-sm" })).toContain("size-8");
  });
});

describe("IconButton", () => {
  it("is named by its label and carries the focus ring", () => {
    const out = html(<IconButton label="Xóa ý chính 1" icon={<i />} tooltip={false} />);
    expect(out).toContain('aria-label="Xóa ý chính 1"');
    expect(out).toContain("soft-focus");
    expect(out).toContain('type="button"');
  });

  it("exposes the same classes for links", () => {
    expect(iconButtonVariants({ size: "md" })).toContain("size-10");
  });
});

describe("Banner", () => {
  it("announces errors and warnings as alerts, info as status", () => {
    expect(html(<Banner tone="error">Lỗi</Banner>)).toContain('role="alert"');
    expect(html(<Banner tone="warn">Cẩn thận</Banner>)).toContain('role="alert"');
    expect(html(<Banner tone="info">Ghi chú</Banner>)).toContain('role="status"');
    expect(html(<Banner tone="success">Xong</Banner>)).toContain('role="status"');
  });

  it("renders icon and action around the message", () => {
    const out = html(
      <Banner
        tone="warn"
        layout="bar"
        icon={<i data-testid="ic" />}
        action={<button>Thử lại</button>}
      >
        Mất kết nối
      </Banner>,
    );
    expect(out).toContain('data-testid="ic"');
    expect(out).toContain("Thử lại");
    expect(out).toContain("Mất kết nối");
  });
});

describe("LevelMeter", () => {
  it("lights bars up to the value, clamps, and goes dark when disabled", () => {
    const lit = (out: string) => (out.match(/bg-soft-ok|bg-soft-warn/g) ?? []).length;
    expect(lit(html(<LevelMeter label="Mic" value={3} />))).toBe(3);
    expect(lit(html(<LevelMeter label="Mic" value={99} />))).toBe(8);
    expect(html(<LevelMeter label="Mic" value={8} />)).toContain("bg-soft-warn");
    const off = html(<LevelMeter label="Mic" value={5} disabled />);
    expect(lit(off)).toBe(0);
    expect(off).toContain('aria-valuenow="0"');
  });
});

describe("Badge and Kbd", () => {
  it("draws an optional decorative dot", () => {
    expect(html(<Badge dot>Nháp</Badge>)).toContain('aria-hidden="true"');
    expect(html(<Badge>Nháp</Badge>)).not.toContain("rounded-full bg-current");
  });

  it("has an amber conclusion tone that other tones do not share", () => {
    expect(html(<Badge variant="conclusion">Đã chốt</Badge>)).toContain("text-soft-conclusion");
    expect(html(<Badge variant="warn">Có lỗi</Badge>)).not.toContain("soft-conclusion");
  });

  it("renders a key hint", () => {
    expect(html(<Kbd>K</Kbd>)).toContain("<kbd");
  });
});

describe("SegmentedControl", () => {
  it("supports sm size and fill", () => {
    const out = html(
      <SegmentedControl
        ariaLabel="Ngôn ngữ"
        size="sm"
        fill
        value="a"
        onValueChange={() => {}}
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
      />,
    );
    expect(out).toContain("flex w-full");
    expect(out).toContain("py-1");
    expect(out).toContain("flex-1");
  });
});

describe("Field", () => {
  it("marks optional fields and wires a textarea to its label", () => {
    const out = html(
      <Field label="Agenda" optional hint="Gợi ý">
        <Textarea />
      </Field>,
    );
    expect(out).toContain("Không bắt buộc");
    expect(out).toMatch(/<textarea[^>]*aria-describedby/);
    expect(html(<Input />)).toContain("<input");
  });
});

describe("confirmErrorMessage", () => {
  it("prefers the error message, with a Vietnamese fallback", () => {
    expect(confirmErrorMessage(new Error("Máy chủ từ chối"))).toBe("Máy chủ từ chối");
    expect(confirmErrorMessage("x")).toBe("Không thực hiện được. Hãy thử lại.");
  });
});
