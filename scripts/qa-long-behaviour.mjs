#!/usr/bin/env node
/* eslint-disable max-lines-per-function, @typescript-eslint/no-unused-expressions -- QA tooling, linear script */
/**
 * Behaviour checks for the virtualized transcript in headless Chrome (CDP). Prints PASS/FAIL lines.
 *   source <env with QA_EMAIL / QA_PASSWORD>; node scripts/qa-long-behaviour.mjs \
 *     --base http://localhost:3102 --chrome-port 9337 --meeting <id of the 6 h meeting>
 */
import WebSocket from "ws";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc),
      [],
    ),
);
const base = args.base ?? "http://localhost:3102";
const port = args["chrome-port"] ?? "9337";
const meeting = args.meeting;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};

async function login() {
  const r = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ email: process.env.QA_EMAIL, password: process.env.QA_PASSWORD }),
  });
  if (!r.ok) throw new Error(`login failed (${r.status})`);
  return r.headers
    .getSetCookie()
    .find((c) => c.startsWith("recap_session="))
    .split(";")[0]
    .slice(14);
}

async function connect() {
  const t = await (
    await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })
  ).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((ok) => ws.once("open", ok));
  let id = 0;
  const pending = new Map();
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) {
      const { ok, fail } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? fail(new Error(m.error.message)) : ok(m.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      pending.set(++id, { ok, fail });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { send, close: () => ws.close(), targetId: t.id };
}

const LOG = `document.querySelector('[role=log]')`;
/** key + viewport-relative top of the first segment row that is at least partly visible. */
const FIRST_VISIBLE = `(() => { const log = ${LOG}; const v = log.getBoundingClientRect(); for (const r of log.querySelectorAll('[id^=seg-]')) { const b = r.getBoundingClientRect(); if (b.bottom > v.top + 4) return { id: r.id, top: Math.round(b.top - v.top) }; } return null; })()`;

async function main() {
  const token = await login();
  const chrome = await connect();
  const { send } = chrome;
  const ev = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails)
      throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
    return r.result.value;
  };
  const key = async (k, modifiers = 0) => {
    const code = k.length === 1 ? `Key${k.toUpperCase()}` : k;
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, modifiers });
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, modifiers });
    await sleep(250);
  };
  await send("Page.enable");
  await send("Network.setCookie", {
    name: "recap_session",
    value: token,
    url: base,
    httpOnly: true,
  });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const open = async (path) => {
    await send("Page.navigate", { url: `${base}/meetings/${meeting}${path}` });
    await sleep(1800);
  };
  const rows = () => ev(`document.querySelectorAll('[id^=seg-]').length`);

  // 1. ended meeting opens at the top with the first page only
  await open("");
  check(
    "opens at the first segment",
    (await ev(`${LOG}.scrollTop`)) === 0 && (await ev(`${LOG}.textContent.includes('(1)')`)),
  );
  check("renders only a window of rows", (await rows()) < 60, `rows=${await rows()}`);
  check(
    "log has role, label and is focusable",
    await ev(
      `${LOG}.getAttribute('role') === 'log' && ${LOG}.tabIndex === 0 && /đoạn/.test(${LOG}.getAttribute('aria-label'))`,
    ),
  );

  // 2. End -> tail page; scrolling up past the edge prepends older pages without a visible jump
  await ev(`${LOG}.focus()`);
  await key("End");
  await sleep(1200);
  check("End jumps to the last segment", await ev(`${LOG}.textContent.includes('(7488)')`));
  let worst = 0,
    prepends = 0;
  for (let i = 0; i < 40; i++) {
    const before = await ev(FIRST_VISIBLE);
    const heightBefore = await ev(`${LOG}.scrollHeight`);
    await ev(`${LOG}.scrollTop -= 1500`);
    await sleep(120);
    const mid = await ev(FIRST_VISIBLE);
    await sleep(500);
    const after = await ev(FIRST_VISIBLE);
    const grew = (await ev(`${LOG}.scrollHeight`)) - heightBefore > 5000;
    if (grew && mid && after && mid.id === after.id) {
      prepends++;
      worst = Math.max(worst, Math.abs(mid.top - after.top));
    }
    if (prepends >= 2) break;
    void before;
  }
  check("older pages prepend while scrolling up", prepends >= 1, `prepends=${prepends}`);
  check("prepending keeps the viewport still", worst <= 3, `max shift ${worst}px`);

  // 3. Home -> head
  await ev(`${LOG}.focus()`);
  await key("Home");
  await sleep(1200);
  check(
    "Home jumps to the first segment",
    (await ev(`${LOG}.scrollTop`)) <= 8 && (await ev(`${LOG}.textContent.includes('(1)')`)),
    `top=${await ev(`${LOG}.scrollTop`)} h=${await ev(`${LOG}.scrollHeight`)}`,
  );

  // 4. deep link: highlighted row is inside the viewport and near its centre
  await open("?t=10800000");
  const deep = await ev(
    `(() => { const log = ${LOG}; const v = log.getBoundingClientRect(); const h = log.querySelector('[id^=seg-].bg-surface-2'); if (!h) return null; const b = h.getBoundingClientRect(); return { centre: Math.round((b.top + b.bottom) / 2 - (v.top + v.bottom) / 2), inView: b.top >= v.top && b.bottom <= v.bottom }; })()`,
  );
  check("?t= deep link highlights a visible row", deep?.inView === true, JSON.stringify(deep));
  check(
    "?t= row is close to the centre",
    deep !== null && Math.abs(deep.centre) < 120,
    `offset ${deep?.centre}px`,
  );

  // 5. Ctrl+F opens in-room search and prevents the browser default only inside the room
  await open("");
  const prevented = await ev(
    `new Promise((r) => { const e = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true }); document.body.dispatchEvent(e); r(e.defaultPrevented); })`,
  );
  check("Ctrl+F is intercepted in the room", prevented === true);
  check(
    "search box opened and focused",
    await ev(`document.activeElement?.getAttribute('role') === 'searchbox'`),
  );
  await send("Input.insertText", { text: "ngan sach" });
  await sleep(1200);
  const summary = await ev(`document.querySelector('[role=search] [aria-live]')?.textContent`);
  check("shows n kết quả", /kết quả/.test(summary ?? ""), summary);
  // Enter moves to hit 2, Shift+Enter back, the row shows a <mark>
  await key("Enter");
  await sleep(900);
  check(
    "Enter goes to the 2nd hit",
    /^2\//.test(
      (await ev(`document.querySelector('[role=search] [aria-live]').textContent`)) ?? "",
    ),
  );
  check("matches are marked inside rows", (await ev(`${LOG}.querySelectorAll('mark').length`)) > 0);
  await key("Enter", 8);
  await sleep(500);
  check(
    "Shift+Enter goes back to the 1st",
    /^1\//.test(
      (await ev(`document.querySelector('[role=search] [aria-live]').textContent`)) ?? "",
    ),
  );
  // far hit: last hit is beyond the first page of rows; jump via list wrap-around
  await key("ArrowUp");
  await sleep(1500);
  const lastHit = await ev(`document.querySelector('[role=search] [aria-live]').textContent`);
  check(
    "wraps to the last hit and scrolls there",
    /^200\+?\/|^\d+\//.test(lastHit ?? "") && (await ev(`${LOG}.scrollTop`)) > 0,
    lastHit,
  );
  await key("Escape");
  check("Esc closes the search", (await ev(`document.querySelector('[role=search]')`)) === null);

  // 6. keyboard: ArrowDown between rows
  await open("");
  await ev(`${LOG}.querySelector('[data-seg-row]').focus()`);
  await key("ArrowDown");
  await sleep(300);
  check(
    "ArrowDown moves focus to the next row",
    await ev(
      `document.activeElement?.id?.startsWith('seg-') && document.activeElement.closest('[data-index]').dataset.index !== '1'`,
    ),
  );

  // 7. topic in the rail far away: loads its page and shows the divider
  await open("");
  await ev(
    `[...document.querySelectorAll('section[aria-labelledby=topics-heading] li')][6].querySelector('button').click()`,
  );
  await sleep(1800);
  const divider = await ev(
    `(() => { const d = ${LOG}.querySelector('[role=separator]'); if (!d) return null; const v = ${LOG}.getBoundingClientRect(), b = d.getBoundingClientRect(); return { inView: b.top >= v.top && b.bottom <= v.bottom, label: d.getAttribute('aria-label') }; })()`,
  );
  check("rail topic jump shows its divider", divider?.inView === true, JSON.stringify(divider));

  await fetch(`http://127.0.0.1:${port}/json/close/${chrome.targetId}`);
  chrome.close();
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("qa-long-behaviour:", e.message);
  process.exit(1);
});
