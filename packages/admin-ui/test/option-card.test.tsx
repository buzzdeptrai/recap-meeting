import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OptionCardGroup, nextOptionIndex } from "../src";

const items = [
  { value: "a", title: "Loại A", description: "Mô tả A", children: <b>Chi tiết A</b> },
  { value: "b", title: "Loại B", description: "Mô tả B", children: <b>Chi tiết B</b> },
  { value: "c", title: "Loại C" },
] as const;

const html = (props: { value: "a" | "b" | "c"; disabled?: boolean; compact?: boolean }) =>
  renderToStaticMarkup(
    <OptionCardGroup ariaLabel="Chọn loại" items={items} onValueChange={() => {}} {...props} />,
  );

describe("OptionCardGroup", () => {
  it("is a radiogroup with one aria-checked radio", () => {
    const out = html({ value: "b" });
    expect(out).toContain('role="radiogroup"');
    expect(out).toContain('aria-label="Chọn loại"');
    expect(out.match(/role="radio"/g)).toHaveLength(3);
    expect(out.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(out.match(/aria-checked="false"/g)).toHaveLength(2);
  });

  it("shows the details of the selected card only and uses a roving tabindex", () => {
    const out = html({ value: "b" });
    expect(out).toContain("Chi tiết B");
    expect(out).not.toContain("Chi tiết A");
    expect(out.match(/tabindex="0"/g)).toHaveLength(1);
    expect(out.match(/tabindex="-1"/g)).toHaveLength(2);
  });

  it("disables every card and drops to one column when compact", () => {
    const off = html({ value: "a", disabled: true });
    expect(off.match(/disabled=""/g)).toHaveLength(3);
    expect(off).toContain('aria-disabled="true"');
    expect(html({ value: "a", compact: true })).not.toContain("sm:grid-cols-2");
  });

  it("maps arrow keys with wrap-around", () => {
    expect(nextOptionIndex("ArrowRight", 2, 3)).toBe(0);
    expect(nextOptionIndex("ArrowUp", 0, 3)).toBe(2);
    expect(nextOptionIndex("Home", 2, 3)).toBe(0);
    expect(nextOptionIndex("End", 0, 3)).toBe(2);
    expect(nextOptionIndex("x", 0, 3)).toBeNull();
  });
});
