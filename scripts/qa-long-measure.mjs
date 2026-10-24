#!/usr/bin/env node
/* eslint-disable max-lines-per-function, @typescript-eslint/no-unused-expressions -- QA tooling, linear script */
/**
 * Measures the meeting room on a long meeting through headless Chrome (CDP).
 *
 * Usage:
 *   source <env with QA_EMAIL / QA_PASSWORD>; node scripts/qa-long-measure.mjs \
 *     --base http://localhost:3102 --chrome-port 9337 --meeting <id> --deep-ms <ms> [--label before]
 * Prints one JSON object: html bytes, DOM nodes, load/FCP, heap, scroll frame times, deep link latency.
 * Credentials come from the environment and are never printed.
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
const deepMs = Number(args["deep-ms"] ?? 3_600_000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login() {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ email: process.env.QA_EMAIL, password: process.env.QA_PASSWORD }),
  });
  if (!response.ok) throw new Error(`login failed (${response.status})`);
  const cookie = response.headers.getSetCookie().find((c) => c.startsWith("recap_session="));
  return cookie.split(";")[0].slice("recap_session=".length);
}

async function connect() {
  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })
  ).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok) => ws.once("open", ok));
  let id = 0;
  const pending = new Map();
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) {
      const { ok, fail } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      pending.set(++id, { ok, fail });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { send, close: () => ws.close(), targetId: target.id };
}

const FRAMES = `(async () => {
  const el = document.querySelector('[role=log]');
  const total = el.scrollHeight - el.clientHeight;
  const times = []; let last = performance.now(); const t0 = last;
  const longTasks = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => longTasks.push(e.duration))).observe({ entryTypes: ["longtask"] }); } catch {}
  await new Promise((done) => {
    const tick = (now) => {
      times.push(now - last); last = now;
      const p = Math.min(1, (now - t0) / 3000);
      el.scrollTop = p * (el.scrollHeight - el.clientHeight);
      p < 1 ? requestAnimationFrame(tick) : done();
    };
    requestAnimationFrame(tick);
  });
  times.shift();
  times.sort((a, b) => a - b);
  const q = (f) => times[Math.min(times.length - 1, Math.floor(times.length * f))];
  return { frames: times.length, p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), max: +times[times.length - 1].toFixed(1), over50: times.filter((t) => t > 50).length, longTasks: longTasks.length, longTaskMs: Math.round(longTasks.reduce((a, b) => a + b, 0)) };
})()`;

async function main() {
  const token = await login();
  const result = { label: args.label ?? "run", meeting };
  const htmlResponse = await fetch(`${base}/meetings/${meeting}`, {
    headers: { cookie: `recap_session=${token}` },
  });
  result.htmlBytes = (await htmlResponse.arrayBuffer()).byteLength;
  const deepHtml = await fetch(`${base}/meetings/${meeting}?t=${deepMs}`, {
    headers: { cookie: `recap_session=${token}` },
  });
  result.htmlBytesDeepLink = (await deepHtml.arrayBuffer()).byteLength;

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
  await send("Page.enable");
  await send("Performance.enable");
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

  const heap = async () => {
    await send("HeapProfiler.collectGarbage");
    const { metrics } = await send("Performance.getMetrics");
    return Math.round(metrics.find((m) => m.name === "JSHeapUsedSize").value / 1048576);
  };
  const nodes = () => ev("document.getElementsByTagName('*').length");

  // 1. plain load
  const start = Date.now();
  await send("Page.navigate", { url: `${base}/meetings/${meeting}` });
  await ev(
    `new Promise((r) => document.readyState === "complete" ? r() : addEventListener("load", r))`,
  ).catch(() => {});
  await sleep(300);
  result.loadWallMs = Date.now() - start;
  result.nav = await ev(
    `(() => { const n = performance.getEntriesByType("navigation")[0]; const f = performance.getEntriesByName("first-contentful-paint")[0]; return { loadEventMs: Math.round(n.loadEventEnd), domContentLoadedMs: Math.round(n.domContentLoadedEventEnd), fcpMs: f ? Math.round(f.startTime) : null }; })()`,
  );
  await sleep(1200);
  result.domNodes = await nodes();
  result.segRowsInDom = await ev(`document.querySelectorAll('[id^=seg-]').length`);
  result.heapMbAfterLoad = await heap();

  // 2. scroll smoothness + end
  result.scroll = await ev(FRAMES);
  await sleep(800);
  // Jump to the very end of the meeting (End key where the list handles it, else scrollTop).
  await ev(`document.querySelector('[role=log]').focus()`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "End", code: "End" });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "End", code: "End" });
  await sleep(1500);
  await ev(
    `(() => { const el = document.querySelector('[role=log]'); el.scrollTop = el.scrollHeight; })()`,
  );
  await sleep(600);
  result.lastRowText = await ev(
    `(() => { const r = [...document.querySelectorAll('[id^=seg-]')]; return r.length ? r[r.length - 1].querySelector('p')?.textContent : null; })()`,
  );
  result.domNodesAtEnd = await nodes();
  result.segRowsAtEnd = await ev(`document.querySelectorAll('[id^=seg-]').length`);
  result.heapMbAfterScroll = await heap();
  result.scrollHeightPx = await ev(`document.querySelector('[role=log]').scrollHeight`);

  // 3. deep link latency: navigate with ?t= until a highlighted row is inside the viewport
  const t0 = Date.now();
  await send("Page.navigate", { url: `${base}/meetings/${meeting}?t=${deepMs}` });
  let ok = false;
  for (let i = 0; i < 400 && !ok; i++) {
    await sleep(25);
    ok = await ev(
      `(() => { const log = document.querySelector('[role=log]'); const h = log && log.querySelector('[id^=seg-].bg-surface-2'); if (!h) return false; const r = h.getBoundingClientRect(), v = log.getBoundingClientRect(); return r.top >= v.top - 2 && r.bottom <= v.bottom + 2; })()`,
    ).catch(() => false);
  }
  result.deepLinkMs = ok ? Date.now() - t0 : null;
  await sleep(1200);
  result.deepLinkDomNodes = await nodes();
  if (args.search) {
    const q = encodeURIComponent(args.search);
    const times = [];
    for (let i = 0; i < 5; i++) {
      const s = performance.now();
      const r = await fetch(`${base}/api/meetings/${meeting}/search?q=${q}&limit=200`, {
        headers: { cookie: `recap_session=${token}` },
      });
      const body = await r.json();
      times.push({
        ms: Math.round(performance.now() - s),
        hits: body.hits?.length,
        status: r.status,
      });
    }
    result.searchApi = times;
  }
  await fetch(`http://127.0.0.1:${port}/json/close/${chrome.targetId}`);
  chrome.close();
  console.log(JSON.stringify(result, null, 1));
}

main().catch((error) => {
  console.error("qa-long-measure:", error.message);
  process.exit(1);
});
