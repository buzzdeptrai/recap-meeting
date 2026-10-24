import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AppShell,
  Card,
  FloatCard,
  PillTabs,
  SegmentedControl,
  Tabs,
  TabsList,
  TabsTrigger,
  buttonVariants,
  iconButtonVariants,
} from "../src";

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("button variants (0.2.2 tonal)", () => {
  it("outline and tonal share the blue tint with brand ink", () => {
    for (const variant of ["outline", "tonal"] as const) {
      const cls = buttonVariants({ variant });
      expect(cls).toContain("bg-soft-tonal-bg");
      expect(cls).toContain("text-soft-tonal-ink");
      expect(cls).toContain("hover:bg-soft-tonal-hover");
      expect(cls).not.toContain("bg-soft-surface");
    }
  });
  it("plain keeps the white hairline look; ghost has no fill", () => {
    expect(buttonVariants({ variant: "plain" })).toContain("bg-soft-surface");
    const ghost = buttonVariants({ variant: "ghost" });
    expect(ghost).toContain("hover:bg-soft-tonal-bg");
    expect(ghost).not.toMatch(/(^| )bg-/);
  });
  it("keeps primary gradient, danger and the focus ring; disabled stays readable", () => {
    expect(buttonVariants({ variant: "primary" })).toContain("bg-soft-main");
    expect(buttonVariants({ variant: "danger" })).toContain("text-white");
    expect(buttonVariants()).toContain("soft-focus");
    expect(buttonVariants()).toContain("disabled:opacity-60");
  });
  it("icon buttons tint on hover", () => {
    expect(iconButtonVariants()).toContain("hover:bg-soft-tonal-bg");
  });
});

const tabs = [
  { id: "a", label: "A", count: 2 },
  { id: "b", label: "B", count: 1 },
];

describe("selected states", () => {
  it("PillTabs: active is solid brand with white text, inactive is transparent on an inset track", () => {
    const out = html(<PillTabs tabs={tabs} ariaLabel="x" idBase="t" defaultValue="a" />);
    expect(out).toContain("bg-soft-inset");
    expect(out).toContain("bg-soft-solid");
    expect(out).toContain("text-white");
    expect(out).not.toContain("bg-soft-surface font-semibold text-soft-ink");
  });
  it("SegmentedControl soft/tabs: active solid brand + white", () => {
    for (const variant of ["soft", "tabs"] as const) {
      const out = html(
        <SegmentedControl
          variant={variant}
          ariaLabel="x"
          value="a"
          onValueChange={() => {}}
          options={[
            { value: "a", label: "A" },
            { value: "b", label: "B" },
          ]}
        />,
      );
      expect(out).toContain("data-[state=on]:bg-soft-solid");
      expect(out).toContain("data-[state=on]:text-white");
      expect(out).toContain("bg-soft-inset");
    }
  });
  it("Tabs trigger: active solid brand", () => {
    const out = html(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    expect(out).toContain("data-[state=active]:bg-soft-solid");
    expect(out).toContain("data-[state=active]:text-white");
  });
  it("sidebar active item: brand tint, bold ink, left accent bar; inactive hovers to tint", () => {
    const out = html(
      <AppShell
        brand={{ name: "B", subtitle: "S" }}
        nav={[
          {
            items: [
              { label: "Một", href: "/1", icon: null },
              { label: "Hai", href: "/2", icon: null },
            ],
          },
        ]}
        currentPath="/2"
      >
        x
      </AppShell>,
    );
    expect(out).toContain("bg-soft-tonal-bg font-bold text-soft-tonal-ink");
    expect(out).toContain("before:w-[3px]");
    expect(out).toContain("hover:bg-soft-tonal-bg hover:text-soft-ink");
  });
  it("cards get a hairline border", () => {
    expect(html(<FloatCard>x</FloatCard>)).toContain("border-soft-line-strong");
    expect(html(<Card>x</Card>)).toContain("border-soft-line-strong");
  });
});

describe("theme tokens", () => {
  const css = readFileSync(new URL("../src/theme.css", import.meta.url), "utf8");
  it("declares the 0.2.2 tokens for light and dark", () => {
    for (const token of [
      "--soft-solid",
      "--soft-tonal-bg",
      "--soft-tonal-hover",
      "--soft-tonal-ink",
    ]) {
      expect(css.match(new RegExp(`${token}:`, "g"))?.length).toBe(2);
    }
    expect(css).toContain("--color-soft-solid");
  });
});
