/* eslint-disable max-lines-per-function -- QA/demo tooling, linear scripts */
/** Scenarios for scripts/qa-cdp.mjs: the meetings list at 1440 / 1920 / 500 px. */
const SLOW_FETCH = `(() => { const f = window.fetch; window.fetch = (u, o) => String(u).includes("/api/meetings") ? new Promise((r) => setTimeout(r, 60000)) : f(u, o); })()`;
const FAIL_FETCH = `(() => { const f = window.fetch; window.fetch = (u, o) => String(u).includes("/api/meetings?") ? Promise.reject(new TypeError("x")) : f(u, o); })()`;

const desktop = (width, tag, height = 1000) => [
  {
    name: `default-${tag}`,
    width,
    height,
    fullPage: true,
    steps: [["goto", "/meetings"], ["shot"]],
  },
  {
    name: `viewport-${tag}`,
    width,
    height,
    steps: [["goto", "/meetings"], ["hover", "ul li"], ["shot"]],
  },
  {
    name: `status-ended-${tag}`,
    width,
    height,
    steps: [["goto", "/meetings?status=ended&sort=duration"], ["shot"]],
  },
  {
    name: `minutes-none-${tag}`,
    width,
    height,
    steps: [["goto", "/meetings?minutes=none&lang=multi"], ["shot"]],
  },
  {
    name: `minutes-stale-${tag}`,
    width,
    height,
    steps: [["goto", "/meetings?minutes=stale&range=30d"], ["shot"]],
  },
  {
    name: `range-custom-${tag}`,
    width,
    height,
    steps: [["goto", "/meetings?range=custom&from=2026-10-10&to=2026-10-20"], ["shot"]],
  },
  {
    name: `search-${tag}`,
    width,
    height,
    steps: [["goto", "/meetings?q=ng%C3%A2n%20s%C3%A1ch"], ["shot"]],
  },
  {
    name: `empty-results-${tag}`,
    width,
    height,
    steps: [["goto", "/meetings?q=zzzkhongco"], ["shot"]],
  },
  {
    name: `cards-${tag}`,
    width,
    height,
    steps: [
      ["goto", "/meetings"],
      ["click", "text=Thẻ"],
      ["wait", 400],
      ["shot"],
      ["click", "text=Bảng"],
    ],
  },
];

export default [
  ...desktop(1440, "1440"),
  ...desktop(1920, "1920", 1080),
  {
    name: "dropdown-minutes-1440",
    width: 1440,
    height: 800,
    steps: [
      ["goto", "/meetings"],
      ["click", "text=Bộ lọc"],
      ["click", "[aria-label='Lọc theo biên bản']"],
      ["shot"],
      ["key", "Escape"],
      ["key", "Escape"],
    ],
  },
  {
    name: "dropdown-range-1440",
    width: 1440,
    height: 800,
    steps: [
      ["goto", "/meetings"],
      ["click", "text=Bộ lọc"],
      ["click", "[aria-label='Lọc theo thời gian']"],
      ["shot"],
      ["key", "Escape"],
      ["key", "Escape"],
    ],
  },
  {
    name: "dropdown-sort-1440",
    width: 1440,
    height: 800,
    steps: [
      ["goto", "/meetings"],
      ["click", "text=Bộ lọc"],
      ["click", "[aria-label='Sắp xếp danh sách']"],
      ["shot"],
      ["key", "Escape"],
      ["key", "Escape"],
    ],
  },
  {
    name: "row-menu-1440",
    width: 1440,
    height: 800,
    steps: [
      ["goto", "/meetings?minutes=vi"],
      ["hover", "ul li"],
      ["click", "ul li [aria-label='Thao tác khác']"],
      ["shot"],
      ["key", "Escape"],
    ],
  },
  {
    name: "row-menu-no-minutes-1440",
    width: 1440,
    height: 800,
    steps: [
      ["goto", "/meetings?minutes=none&status=ended"],
      ["hover", "ul li"],
      ["click", "ul li [aria-label='Thao tác khác']"],
      ["shot"],
      ["key", "Escape"],
    ],
  },
  {
    name: "loading-1440",
    width: 1440,
    height: 800,
    steps: [
      ["goto", "/meetings"],
      ["eval", SLOW_FETCH],
      ["click", "[aria-label='Lọc theo trạng thái'] button:nth-child(3)"],
      ["wait", 900],
      ["shot"],
    ],
  },
  {
    name: "error-1440",
    width: 1440,
    height: 800,
    steps: [
      ["goto", "/meetings"],
      ["eval", FAIL_FETCH],
      ["click", "[aria-label='Lọc theo trạng thái'] button:nth-child(4)"],
      ["wait", 800],
      ["shot"],
    ],
  },
  {
    name: "mobile-default-500",
    width: 500,
    height: 900,
    fullPage: true,
    steps: [["goto", "/meetings"], ["shot"]],
  },
  {
    name: "mobile-filtered-500",
    width: 500,
    height: 900,
    steps: [["goto", "/meetings?status=ended&minutes=need"], ["shot"]],
  },
  {
    name: "mobile-filter-dialog-500",
    width: 500,
    height: 900,
    steps: [
      ["goto", "/meetings?minutes=stale"],
      ["click", "text=Bộ lọc"],
      ["shot"],
      ["click", "[aria-label='Lọc theo thời gian']"],
      ["wait", 300],
      ["shot", "mobile-filter-dialog-select-500"],
      ["key", "Escape"],
      ["key", "Escape"],
    ],
  },
  {
    name: "mobile-menu-500",
    width: 500,
    height: 900,
    steps: [
      ["goto", "/meetings"],
      ["click", "[aria-label='Thao tác khác']"],
      ["shot"],
      ["key", "Escape"],
    ],
  },
  {
    name: "mobile-search-500",
    width: 500,
    height: 900,
    steps: [["goto", "/meetings?q=h%E1%BB%A3p%20%C4%91%E1%BB%93ng"], ["shot"]],
  },
];
