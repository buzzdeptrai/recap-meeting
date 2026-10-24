/* eslint-disable max-lines-per-function -- QA tooling, linear scenarios */
/**
 * Scenarios for scripts/qa-cdp.mjs: the virtualized transcript on the 6 h synthetic meeting.
 * Env: LONG6 = meeting id (from scripts/seed-long-meeting.mjs).
 */
const id = process.env.LONG6;
const MID = `(() => { const el = document.querySelector('[role=log]'); el.scrollTop = el.scrollHeight * 0.4; return el.scrollTop; })()`;
const STATS = `(() => ({ rows: document.querySelectorAll('[id^=seg-]').length, nodes: document.getElementsByTagName('*').length }))()`;

const set = (width, height, tag) => [
  {
    name: `top-${tag}`,
    width,
    height,
    steps: [["goto", `/meetings/${id}`], ["wait", 800], ["eval", STATS], ["shot"]],
  },
  {
    name: `middle-${tag}`,
    width,
    height,
    steps: [["goto", `/meetings/${id}`], ["eval", MID], ["wait", 1200], ["eval", STATS], ["shot"]],
  },
  {
    name: `end-${tag}`,
    width,
    height,
    steps: [
      ["goto", `/meetings/${id}`],
      ["click", "text=Về cuối"],
      ["wait", 1500],
      ["eval", STATS],
      ["shot"],
    ],
  },
  {
    name: `deeplink-${tag}`,
    width,
    height,
    steps: [["goto", `/meetings/${id}?t=10800000`], ["wait", 800], ["eval", STATS], ["shot"]],
  },
  {
    name: `search-${tag}`,
    width,
    height,
    steps: [
      ["goto", `/meetings/${id}`],
      ["key", "Control+f"],
      ["type", "[role=searchbox]", "ngan sach"],
      ["wait", 1200],
      ["shot", `search-list-${tag}`],
      ["key", "Enter"],
      ["wait", 1500],
      ["eval", STATS],
      ["shot", `search-hit-${tag}`],
    ],
  },
  {
    name: `topic-${tag}`,
    width,
    height,
    steps: [
      ["goto", `/meetings/${id}`],
      ["click", "section[aria-labelledby=topics-heading] li:nth-child(3) button"],
      ["wait", 1500],
      ["eval", STATS],
      ["shot"],
    ],
  },
];

export default [...set(1440, 900, "1440"), ...set(500, 900, "500")];
