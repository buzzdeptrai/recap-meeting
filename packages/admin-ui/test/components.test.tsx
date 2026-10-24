import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AppShell,
  Badge,
  Button,
  DataTable,
  EmptyState,
  Field,
  Input,
  LineAreaChart,
  LoginForm,
  NavyBarCard,
  ProgressBar,
  Sparkline,
  StackedBarChart,
  StatCard,
  StatusDot,
  cn,
  type DataColumn,
} from "../src";

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("cn", () => {
  it("merges conflicting utilities including Soft theme names", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-soft-ink", "text-white")).toBe("text-white");
    expect(cn("bg-soft-main", "bg-soft-dark")).toBe("bg-soft-dark");
    expect(cn("shadow-soft", "shadow-soft-sm")).toBe("shadow-soft-sm");
  });
});

describe("primitives", () => {
  it("StatCard shows value, delta colour and an accessible progress bar", () => {
    const out = html(
      <StatCard
        label="Cuộc họp"
        value="38"
        delta={{ text: "+18,8%", direction: "up" }}
        deltaLabel="so với T9"
        progress={{ value: 70, label: "70% ngân sách" }}
      />,
    );
    expect(out).toContain("+18,8%");
    expect(out).toContain("text-soft-ok");
    expect(out).toContain('role="progressbar"');
    expect(out).toContain('aria-valuenow="70"');
  });

  it("ProgressBar clamps and exposes a marker", () => {
    const out = html(<ProgressBar value={150} label="x" marker={98} markerLabel="Dự kiến" />);
    expect(out).toContain('aria-valuenow="100"');
    expect(out).toContain("left:98%");
  });

  it("Button renders loading as disabled + aria-busy and defaults to type=button", () => {
    const out = html(<Button loading>Lưu</Button>);
    expect(out).toContain("disabled");
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('type="button"');
  });

  it("StatusDot is decorative without a label and an image with one", () => {
    expect(html(<StatusDot />)).toContain('aria-hidden="true"');
    expect(html(<StatusDot label="Hoạt động" status="ok" />)).toContain('role="img"');
  });

  it("Badge variants", () => {
    expect(html(<Badge variant="ok">Hoàn tất</Badge>)).toContain("text-[#117a28]");
  });

  it("Field wires label, hint and error to the input", () => {
    const out = html(
      <Field label="Email" error="Sai định dạng" hint="Dùng email công ty">
        <Input type="email" />
      </Field>,
    );
    expect(out).toMatch(/<label[^>]*for="([^"]+)"/);
    const id = /for="([^"]+)"/.exec(out)![1]!;
    expect(out).toContain(`id="${id}"`);
    expect(out).toContain('aria-invalid="true"');
    expect(out).toContain(`aria-describedby="${id}-hint ${id}-error"`);
  });

  it("EmptyState", () => {
    expect(html(<EmptyState title="Chưa có dữ liệu" description="Thử lại sau" />)).toContain(
      "Chưa có dữ liệu",
    );
  });
});

describe("LoginForm", () => {
  it("renders fields, an alert for errors and a disabled loading button", () => {
    const out = html(
      <LoginForm onSubmit={() => {}} error="Sai mật khẩu" loading title="Đăng nhập" />,
    );
    expect(out).toContain('role="alert"');
    expect(out).toContain("Sai mật khẩu");
    expect(out).toMatch(/autocomplete="current-password"/i);
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain("Đang đăng nhập");
  });
  it("hides the remember checkbox on request", () => {
    expect(html(<LoginForm onSubmit={() => {}} showRemember={false} />)).not.toContain(
      'name="remember"',
    );
  });
});

interface Row {
  id: string;
  name: string;
  cost: number;
}
const rows: Row[] = [
  { id: "1", name: "Deepgram", cost: 36.59 },
  { id: "2", name: "OpenAI", cost: 4.65 },
];
const columns: DataColumn<Row>[] = [
  { key: "name", header: "Nhà cung cấp", sortable: true },
  {
    key: "cost",
    header: "Chi phí",
    numeric: true,
    sortable: true,
    highlight: true,
    cell: (r) => `$${r.cost}`,
  },
];

describe("DataTable", () => {
  it("sorts by the default sort, marks aria-sort and right-aligns numbers", () => {
    const out = html(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        defaultSort={{ key: "cost", direction: "asc" }}
        caption="Chi phí"
        footer={{ name: "Tổng", cost: "$41,24" }}
      />,
    );
    expect(out.indexOf("OpenAI")).toBeLessThan(out.indexOf("Deepgram"));
    expect(out).toContain('aria-sort="ascending"');
    expect(out).toContain("text-right");
    expect(out).toContain("<tfoot>");
    expect(out).toContain('<caption class="sr-only">Chi phí</caption>');
  });
  it("shows the empty slot", () => {
    expect(
      html(
        <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} empty={<span>Trống</span>} />,
      ),
    ).toContain("Trống");
  });
});

describe("charts", () => {
  const labels = ["1/10", "2/10", "3/10"];
  it("LineAreaChart is an image with a label, data table fallback and keyboard overlay", () => {
    const out = html(
      <LineAreaChart
        ariaLabel="Chi phí theo ngày"
        labels={labels}
        series={[
          { id: "a", label: "Cuộc họp", values: [1, 3, 2], color: "#3A416F" },
          {
            id: "b",
            label: "Chi phí",
            values: [1, 4, 3],
            color: "#FF0080",
            axis: "right",
            formatValue: (v) => `$${v}`,
          },
        ]}
      />,
    );
    expect(out).toContain('role="img"');
    expect(out).toContain('aria-label="Chi phí theo ngày"');
    expect(out).toContain("<caption>Chi phí theo ngày</caption>");
    expect(out).toContain('tabindex="0"');
    expect(out).toContain("$4");
  });
  it("StackedBarChart renders both variants with a legend", () => {
    const series = [
      { id: "dg", label: "Deepgram", values: [1, 2, 3], color: "#7928CA" },
      { id: "oa", label: "OpenAI", values: [0.5, 0, 1], color: "#FF0080" },
    ];
    for (const variant of ["bars", "area"] as const) {
      const out = html(
        <StackedBarChart ariaLabel="Chi phí" labels={labels} series={series} variant={variant} />,
      );
      expect(out).toContain("Deepgram");
      expect(out).toContain("<path");
    }
  });
  it("NavyBarCard and Sparkline", () => {
    expect(
      html(<NavyBarCard title="Giờ chép lời" ariaLabel="Cột" labels={labels} values={[1, 0, 3]} />),
    ).toContain("bg-soft-dark");
    expect(html(<Sparkline values={[1, 3, 2]} />)).toContain('aria-hidden="true"');
    expect(html(<Sparkline values={[1, 3, 2]} ariaLabel="Xu hướng" />)).toContain('role="img"');
  });
  it("charts survive empty data", () => {
    expect(() => html(<LineAreaChart ariaLabel="x" labels={[]} series={[]} />)).not.toThrow();
    expect(() => html(<StackedBarChart ariaLabel="x" labels={[]} series={[]} />)).not.toThrow();
    expect(() => html(<Sparkline values={[]} />)).not.toThrow();
  });
});

describe("AppShell", () => {
  const nav = [
    {
      items: [
        { label: "Tổng quan", href: "/", icon: null },
        { label: "Mức sử dụng", href: "/usage", icon: null, badge: 3 },
      ],
    },
  ];
  const shell = (extra: Partial<React.ComponentProps<typeof AppShell>> = {}) =>
    html(
      <AppShell
        brand={{ name: "Biên bản", subtitle: "Quản trị" }}
        nav={nav}
        currentPath="/usage"
        {...extra}
      >
        <p>Nội dung</p>
      </AppShell>,
    );
  it("marks the active page and wires the mobile toggle to the sidebar", () => {
    const out = shell();
    expect(out).toMatch(/aria-current="page"[^>]*>.*Mức sử dụng/s);
    const controls = /aria-controls="([^"]+)"/.exec(out)![1]!;
    expect(out).toContain(`id="${controls}"`);
    expect(out).toContain('aria-expanded="false"');
    expect(out).toContain('href="#main"');
    expect(out).toContain("Nội dung");
  });
  it("opens the drawer when asked and badges counts", () => {
    const out = shell({ defaultDrawerOpen: true });
    expect(out).toContain('aria-expanded="true"');
    expect(out).toContain('data-open="true"');
    expect(out).toContain(">3<");
  });
  it("hides labels visually when collapsed", () => {
    expect(shell({ defaultCollapsed: true })).toContain("sr-only");
  });
  it("renders an optional page header", () => {
    expect(
      shell({ header: { breadcrumb: ["Quản trị", "Mức sử dụng"], title: "Mức sử dụng" } }),
    ).toMatch(/<span aria-current="page"[^>]*>Mức sử dụng<\/span>/);
  });
});
