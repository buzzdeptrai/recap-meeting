import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  Banner,
  Bubble,
  Button,
  Chip,
  FloatCard,
  FloatingActionBar,
  IconBadge,
  LevelMeter,
  PillTabs,
  SegmentedControl,
  StatTile,
  bubbleClasses,
  buttonVariants,
  chipVariants,
  cn,
  pillTabId,
  pillTabPanelId,
} from "../src";

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("cn knows the v2 theme names", () => {
  it("lets later v2 utilities win", () => {
    expect(cn("rounded-soft", "rounded-soft-card")).toBe("rounded-soft-card");
    expect(cn("shadow-soft", "shadow-soft-float")).toBe("shadow-soft-float");
    expect(cn("bg-soft-inset", "bg-soft-tone-a-bg")).toBe("bg-soft-tone-a-bg");
    expect(cn("text-soft-muted", "text-soft-tone-b-ink")).toBe("text-soft-tone-b-ink");
  });
});

describe("FloatCard", () => {
  it("renders header, body and footer with the card radius", () => {
    const out = html(
      <FloatCard header={<h2>Đầu</h2>} footer={<p>Chân</p>} padding="sm" as="section">
        Thân
      </FloatCard>,
    );
    expect(out).toContain("rounded-soft-card");
    expect(out).toContain("shadow-soft-card");
    expect(out.indexOf("Đầu")).toBeLessThan(out.indexOf("Thân"));
    expect(out.indexOf("Thân")).toBeLessThan(out.indexOf("Chân"));
    expect(out.startsWith("<section")).toBe(true);
    expect(out).toContain("p-3");
  });

  it("omits empty slots and can clip", () => {
    const out = html(<FloatCard clip>x</FloatCard>);
    expect(out).toContain("overflow-hidden");
    expect(out).not.toContain("pt-4");
  });
});

describe("PillTabs", () => {
  const tabs = [
    { id: "topics", label: "Chủ đề", count: 2 },
    { id: "marks", label: "Kết luận", count: 3, countTone: "decision" as const },
    { id: "notes", label: "Ghi chú", disabled: true, disabledReason: "Chưa có" },
  ];

  it("renders an accessible tablist with roving tabindex", () => {
    const out = html(<PillTabs tabs={tabs} ariaLabel="Bảng bên" idBase="t" defaultValue="marks" />);
    expect(out).toContain('role="tablist"');
    expect(out).toContain('aria-label="Bảng bên"');
    expect(out.match(/role="tab"/g)).toHaveLength(3);
    expect(out).toContain(`id="${pillTabId("t", "marks")}"`);
    expect(out).toContain(`aria-controls="${pillTabPanelId("t", "marks")}"`);
    expect(out.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(out.match(/tabindex="0"/g)).toHaveLength(1);
    expect(out).toContain("bg-soft-conclusion-bg");
  });

  it("controlled value wins; disabled tab carries aria-disabled and its reason", () => {
    const out = html(<PillTabs tabs={tabs} ariaLabel="x" idBase="t" value="topics" />);
    const topics = out.match(/<button[^>]*id="t-tab-topics"[^>]*>/)?.[0] ?? "";
    expect(topics).toContain('aria-selected="true"');
    const notes = out.match(/<button[^>]*id="t-tab-notes"[^>]*>/)?.[0] ?? "";
    expect(notes).toContain('aria-disabled="true"');
    expect(notes).toContain('title="Chưa có"');
    expect(notes).toContain('aria-selected="false"');
  });

  it("falls back to the first enabled tab", () => {
    const out = html(<PillTabs tabs={tabs} ariaLabel="x" idBase="t" />);
    expect(out.match(/<button[^>]*id="t-tab-topics"[^>]*>/)?.[0] ?? "").toContain(
      'aria-selected="true"',
    );
  });
});

describe("Chip", () => {
  it("maps every tone to its own classes; amber only on decision", () => {
    const tones = ["neutral", "outline", "info", "ok", "warn", "decision", "danger"] as const;
    const classes = tones.map((tone) => chipVariants({ tone }));
    expect(new Set(classes).size).toBe(tones.length);
    for (const tone of tones) {
      const c = chipVariants({ tone });
      expect(c.includes("conclusion")).toBe(tone === "decision");
    }
    expect(chipVariants({ tone: "warn" })).toContain("olive");
  });

  it("sizes and leading icon", () => {
    expect(chipVariants({ size: "sm" })).toContain("h-[18px]");
    expect(chipVariants({ size: "lg" })).toContain("h-[30px]");
    const out = html(<Chip icon={<i data-testid="ic" />}>VI</Chip>);
    expect(out).toContain('data-testid="ic"');
    expect(out).toContain("VI");
  });
});

describe("IconBadge and Bubble", () => {
  it("IconBadge tones are decorative and tinted", () => {
    expect(html(<IconBadge tone="tone-a">i</IconBadge>)).toContain("bg-soft-tone-a-chip");
    expect(html(<IconBadge tone="tone-b">i</IconBadge>)).toContain("bg-soft-tone-b-chip");
    const neutral = html(<IconBadge>i</IconBadge>);
    expect(neutral).toContain("bg-soft-inset-2");
    expect(neutral).toContain('aria-hidden="true"');
  });

  it("bubbleClasses maps tone, dashed, tail and decision ring", () => {
    expect(bubbleClasses("tone-a")).toContain("bg-soft-tone-a-bg");
    expect(bubbleClasses("tone-b")).toContain("bg-soft-tone-b-bg");
    expect(bubbleClasses("neutral")).toContain("bg-soft-inset");
    const dashed = bubbleClasses("dashed");
    expect(dashed).toContain("border-dashed");
    expect(dashed).toContain("bg-transparent");
    expect(bubbleClasses("tone-a")).toContain("rounded-[8px_");
    expect(bubbleClasses("tone-a", undefined, false)).toContain("rounded-soft-inner");
    expect(bubbleClasses("tone-a")).not.toContain("conclusion-line");
    expect(bubbleClasses("tone-a", "decision")).toContain("conclusion-line");
    expect(html(<Bubble tone="tone-b">Hi</Bubble>)).toContain("Hi");
  });
});

describe("FloatingActionBar", () => {
  it("is a labelled toolbar; the wrapper ignores pointer events", () => {
    const out = html(
      <FloatingActionBar ariaLabel="Đánh dấu" hint="Chỉ khi đang ghi">
        <Button variant="outline" shape="pill">
          A
        </Button>
      </FloatingActionBar>,
    );
    expect(out).toContain('role="toolbar"');
    expect(out).toContain('aria-label="Đánh dấu"');
    expect(out).toContain("pointer-events-none");
    expect(out).toContain("absolute");
    expect(out).toContain("Chỉ khi đang ghi");
  });

  it("position and bottom props change classes", () => {
    const out = html(
      <FloatingActionBar ariaLabel="x" position="sticky" bottom="lg" align="end">
        x
      </FloatingActionBar>,
    );
    expect(out).toContain("sticky");
    expect(out).toContain("bottom-8");
    expect(out).toContain("items-end");
    expect(out).not.toContain("<p");
  });
});

describe("Button shape", () => {
  it("pill is fully round at every size; default keeps the old radii", () => {
    for (const size of ["sm", "md", "lg", "icon", "icon-sm"] as const) {
      expect(buttonVariants({ size, shape: "pill" })).toContain("rounded-full");
      expect(buttonVariants({ size, shape: "pill" })).not.toContain("rounded-xl");
    }
    expect(buttonVariants({ size: "sm" })).toContain("rounded-[10px]");
    expect(buttonVariants({ size: "md" })).toContain("rounded-xl");
    expect(buttonVariants({})).toContain("rounded-xl");
  });
});

describe("Banner v2", () => {
  it("warn is olive and no longer amber-ish", () => {
    const out = html(<Banner tone="warn">Cảnh báo</Banner>);
    expect(out).toContain("bg-soft-olive-bg");
    expect(out).toContain('role="alert"');
  });

  it("dismiss button only when onDismiss is given, with a label", () => {
    expect(html(<Banner>Tin</Banner>)).not.toContain("<button");
    const out = html(
      <Banner onDismiss={() => {}} dismissLabel="Ẩn thông báo">
        Tin
      </Banner>,
    );
    expect(out).toContain('aria-label="Ẩn thông báo"');
    expect(html(<Banner onDismiss={() => {}}>Tin</Banner>)).toContain('aria-label="Đóng"');
  });

  it("radius lg only changes the card layout; existing defaults unchanged", () => {
    expect(html(<Banner>x</Banner>)).toContain("rounded-xl");
    expect(html(<Banner radius="lg">x</Banner>)).toContain("rounded-soft-inner");
    expect(
      html(
        <Banner layout="bar" radius="lg">
          x
        </Banner>,
      ),
    ).not.toContain("rounded");
  });
});

describe("SegmentedControl soft", () => {
  it("uses the inset pill track", () => {
    const out = html(
      <SegmentedControl
        variant="soft"
        ariaLabel="Chế độ"
        value="a"
        onValueChange={() => {}}
        options={[
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ]}
      />,
    );
    expect(out).toContain("bg-soft-inset");
    expect(out).toContain("rounded-soft-pill");
  });
});

describe("LevelMeter compact", () => {
  it("shows label, status and a meter with value text", () => {
    const out = html(
      <LevelMeter
        variant="compact"
        label="Micro"
        value={3}
        bars={10}
        statusText="ổn"
        statusTone="ok"
        tone="tone-b"
        icon={<i data-testid="mic" />}
      />,
    );
    expect(out).toContain('role="meter"');
    expect(out).toContain('aria-valuenow="3"');
    expect(out).toContain('aria-valuetext="ổn"');
    expect(out).toContain("width:30%");
    expect(out).toContain("bg-soft-tone-b-bar");
    expect(out).toContain("text-soft-ok-ink");
    expect(out).toContain('data-testid="mic"');
  });

  it("disabled compact meter is empty and neutral; default variant is unchanged", () => {
    const out = html(
      <LevelMeter variant="compact" label="Tab" value={5} bars={10} disabled tone="tone-a" />,
    );
    expect(out).toContain("width:0%");
    expect(out).not.toContain("bg-soft-tone-a-bar");
    expect(html(<LevelMeter label="x" value={2} />)).toContain("h-4");
  });
});

describe("StatTile", () => {
  it("renders label, mono value and unit", () => {
    const out = html(<StatTile label="Độ trễ" value="0,9" unit="giây" />);
    expect(out).toContain("Độ trễ");
    expect(out).toContain("font-soft-mono");
    expect(out).toContain("giây");
  });
});
