/* eslint-disable max-lines-per-function -- QA tooling */
/** Scenarios for scripts/qa-cdp.mjs: dashboard, meetings (table + cards) and usage without cost leaks. */
const sizes = [
  [1440, "1440", 1000],
  [1920, "1920", 1100],
  [500, "500", 900],
];
export default sizes.flatMap(([width, tag, height]) => [
  {
    name: `home-${tag}`,
    width,
    height,
    fullPage: true,
    steps: [["goto", "/"], ["wait", 1200], ["shot"]],
  },
  {
    name: `meetings-table-${tag}`,
    width,
    height,
    fullPage: true,
    steps: [
      ["eval", "localStorage.clear()"],
      ["goto", "/meetings?status=ended"],
      ["wait", 600],
      ["shot"],
    ],
  },
  {
    name: `meetings-cards-${tag}`,
    width,
    height,
    fullPage: true,
    steps: [
      ["goto", "/meetings"],
      ["eval", "localStorage.setItem('recap.meetings.view','cards')"],
      ["goto", "/meetings?status=ended"],
      ["wait", 600],
      ["shot"],
    ],
  },
  {
    name: `usage-${tag}`,
    width,
    height,
    fullPage: true,
    steps: [["goto", "/usage"], ["wait", 1200], ["shot"]],
  },
]);
