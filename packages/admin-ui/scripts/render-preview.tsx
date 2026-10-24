/**
 * Renders the kit's showcase pages to static HTML with compiled Tailwind CSS (no JS, so overlays are closed).
 *   npx tsx packages/admin-ui/scripts/render-preview.tsx [outDir]
 * Default outDir: <repo>/data/admin-ui-preview. Fonts load from Google Fonts when online.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwind from "@tailwindcss/postcss";
import postcss from "postcss";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ChartBar,
  FileText,
  House,
  Question,
  Sliders,
  Calendar,
  Book,
} from "@phosphor-icons/react/dist/ssr";
import { AppShell, HelpCardAction, LoginForm, SidebarHelpCard, type NavGroup } from "../src";
import { DashboardPage } from "./preview-dashboard";
import { KitPage } from "./preview-kit";
import { UsagePage } from "./preview-usage";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.argv[2] ?? resolve(here, "../../../data/admin-ui-preview"));

const NAV: NavGroup[] = [
  { items: [{ label: "Tổng quan", href: "index.html", icon: <House /> }] },
  {
    label: "Làm việc",
    items: [
      { label: "Cuộc họp", href: "#meetings", icon: <Calendar />, disabled: true },
      { label: "Biên bản", href: "#minutes", icon: <FileText />, disabled: true },
      { label: "Thuật ngữ", href: "#glossary", icon: <Book />, disabled: true },
    ],
  },
  {
    label: "Quản trị",
    items: [
      { label: "Mức sử dụng", href: "usage.html", icon: <ChartBar /> },
      { label: "Bộ thành phần", href: "kit.html", icon: <Sliders /> },
    ],
  },
];

function Shell({
  path,
  children,
  drawer,
}: {
  path: string;
  children: ReactNode;
  drawer?: boolean;
}) {
  return (
    <AppShell
      brand={{ name: "Biên bản", subtitle: "Quản trị", icon: <FileText /> }}
      nav={NAV}
      currentPath={path}
      defaultDrawerOpen={drawer}
      sidebarFooter={
        <SidebarHelpCard
          icon={<Question />}
          title="Cần trợ giúp?"
          description="Xem tài liệu hoặc liên hệ đội hỗ trợ."
          action={<HelpCardAction href="#">Xem tài liệu</HelpCardAction>}
        />
      }
    >
      {children}
    </AppShell>
  );
}

function Login() {
  return (
    <div
      className="font-soft grid min-h-screen place-items-center bg-soft-bg p-4 text-soft-ink"
      data-soft-root=""
    >
      <LoginForm
        onSubmit={() => {}}
        title="Đăng nhập"
        description="Dùng tài khoản quản trị do bạn được cấp."
        logo={
          <span className="grid size-10 place-items-center rounded-xl bg-soft-main text-white shadow-[0_4px_7px_rgba(121,40,202,0.3)]">
            <FileText width={20} height={20} />
          </span>
        }
        error="Email hoặc mật khẩu không đúng."
        defaultEmail="admin@example.com"
        footer="Quên mật khẩu? Liên hệ quản trị viên."
      />
    </div>
  );
}

const page = (name: string, node: ReactNode) => ({ name, body: renderToStaticMarkup(<>{node}</>) });

async function compileCss(): Promise<string> {
  const from = resolve(here, "preview.css");
  const result = await postcss([tailwind()]).process(readFileSync(from, "utf8"), { from });
  return result.css;
}

function document(title: string, css: string, body: string): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap&subset=vietnamese" rel="stylesheet">
<style>${css}</style></head><body>${body}</body></html>`;
}

async function main() {
  const css = await compileCss();
  mkdirSync(outDir, { recursive: true });
  const desktop = { line: 576, bar: 420 };
  const mobile = { line: 428, bar: 392 };
  const pages = [
    page(
      "index",
      <Shell path="index.html">
        <DashboardPage widths={desktop} />
      </Shell>,
    ),
    page(
      "index-mobile",
      <Shell path="index.html">
        <DashboardPage widths={mobile} />
      </Shell>,
    ),
    page(
      "usage",
      <Shell path="usage.html">
        <UsagePage chartWidth={620} />
      </Shell>,
    ),
    page(
      "usage-mobile",
      <Shell path="usage.html">
        <UsagePage chartWidth={428} />
      </Shell>,
    ),
    page(
      "kit",
      <Shell path="kit.html">
        <KitPage />
      </Shell>,
    ),
    page(
      "drawer-open",
      <Shell path="index.html" drawer>
        <DashboardPage widths={mobile} />
      </Shell>,
    ),
    page("login", <Login />),
  ];
  for (const p of pages)
    writeFileSync(resolve(outDir, `${p.name}.html`), document(`Preview ${p.name}`, css, p.body));
  console.log(`wrote ${pages.length} pages to ${outDir}`);
}

void main();
