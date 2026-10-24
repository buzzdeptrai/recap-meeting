#!/usr/bin/env node
/* eslint-disable max-lines-per-function -- QA tooling, linear script */
/**
 * Live-recording check of the virtualized transcript without audio or a realtime server: Chrome
 * gets a fake capture stream and a fake WebSocket that speaks the server protocol (ready, interim,
 * segment, translation). Clicks "Ghi tiếp" on an ended meeting and checks follow / append / pill.
 *   source <env with QA_EMAIL / QA_PASSWORD>; node scripts/qa-long-live.mjs --meeting <id> [--shot path]
 */
import { writeFileSync } from "node:fs";
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};

const FAKES = `(() => {
  const ctx = () => new AudioContext();
  const audioStream = () => { const c = ctx(); const d = c.createMediaStreamDestination(); const o = c.createOscillator(); const g = c.createGain(); g.gain.value = 0.001; o.connect(g).connect(d); o.start(); return d.stream; };
  window.__calls = []; window.addEventListener('unhandledrejection', (e) => window.__calls.push('rej:' + e.reason)); navigator.mediaDevices.getUserMedia = async () => { window.__calls.push('gum'); return audioStream(); };
  navigator.mediaDevices.getDisplayMedia = async () => { window.__calls.push('gdm'); const s = audioStream(); const cv = document.createElement('canvas'); cv.width = 16; cv.height = 16; cv.getContext('2d'); cv.captureStream(1).getVideoTracks().forEach((t) => s.addTrack(t)); return s; };
  window.__sent = 0;
  class FakeWS {
    constructor(url) { this.url = url; this.readyState = 0; this.bufferedAmount = 0; setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 20); }
    emit(msg) { this.onmessage && this.onmessage({ data: JSON.stringify(msg) }); }
    send(data) {
      if (typeof data !== 'string') return;
      const m = JSON.parse(data);
      if (m.type === 'start') {
        this.emit({ type: 'ready', meetingId: m.meetingId ?? 'x', startedAt: new Date().toISOString(), baseMs: window.__base ?? 0 });
        this.timer = setInterval(() => this.tick(), 350);
      }
    }
    tick() {
      const n = (window.__sent += 1);
      const seq = (window.__firstSeq ?? 0) + n - 1;
      const startMs = (window.__base ?? 0) + n * 3000;
      const id = 'live-' + n;
      this.emit({ type: 'interim', channel: 1, text: 'đang nói ' + n, startMs, endMs: startMs + 2500 });
      this.emit({ type: 'segment', segment: { id, seq, channel: 1, lang: 'vi', startMs, endMs: startMs + 2500, text: 'Đoạn trực tiếp số ' + n + ' để thử cuộn theo dõi.' } });
      setTimeout(() => this.emit({ type: 'translation', segmentId: id, seq, lang: 'en', text: 'Live segment ' + n, provider: 'fake', latencyMs: 300 }), 120);
    }
    close() { clearInterval(this.timer); this.readyState = 3; this.onclose && this.onclose({ code: 1000 }); }
  }
  const Native = window.WebSocket;
  const Patched = function (url, ...rest) { return String(url).indexOf(':4001/') >= 0 ? new FakeWS(String(url)) : new Native(url, ...rest); };
  Patched.prototype = Native.prototype; Object.assign(Patched, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  window.WebSocket = Patched;
})()`;

async function main() {
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ email: process.env.QA_EMAIL, password: process.env.QA_PASSWORD }),
  });
  const token = login.headers
    .getSetCookie()
    .find((c) => c.startsWith("recap_session="))
    .split(";")[0]
    .slice(14);
  const meeting = args.meeting;
  const detail = await (
    await fetch(`${base}/api/meetings/${meeting}/segments?dir=backward&limit=1`, {
      headers: { cookie: `recap_session=${token}` },
    })
  ).json();
  const last = detail.segments[0];
  const target = await (
    await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })
  ).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok) => ws.once("open", ok));
  let id = 0;
  const pending = new Map();
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result);
      pending.delete(m.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((ok) => {
      pending.set(++id, ok);
      ws.send(JSON.stringify({ id, method, params }));
    });
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
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__base = ${last.endMs}; window.__firstSeq = ${last.seq + 1};`,
  });
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `document.addEventListener('DOMContentLoaded', () => {}); ${FAKES}`,
  });
  await send("Page.navigate", { url: `${base}/meetings/${meeting}` });
  await sleep(5000);

  const LOG = `document.querySelector('[role=log]')`;
  const nearBottom = () =>
    ev(
      `(() => { const l = ${LOG}; return l.scrollHeight - l.scrollTop - l.clientHeight < 80; })()`,
    );
  const rows = () => ev(`document.querySelectorAll('[id^=seg-]').length`);
  const lastText = () =>
    ev(
      `(() => { const r = [...document.querySelectorAll('[id^=seg-]')]; return r.at(-1)?.querySelector('p')?.textContent ?? ''; })()`,
    );

  check("starts at the top before recording", (await ev(`${LOG}.scrollTop`)) === 0);
  // a real mouse click: audio contexts need a genuine user gesture
  const pt = await ev(
    `(() => { const r = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Ghi tiếp').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
  );
  console.log(
    "info at point:",
    JSON.stringify(pt),
    await ev(`document.elementFromPoint(${pt.x}, ${pt.y})?.outerHTML.slice(0, 120)`),
    await ev(`typeof window.__calls`),
  );
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
    await send("Input.dispatchMouseEvent", {
      type,
      x: pt.x,
      y: pt.y,
      button: "left",
      clickCount: 1,
      buttons: type === "mouseReleased" ? 0 : 1,
    });
  console.log(
    "info header after click:",
    await ev(`document.querySelector('header').innerText.replace(/\\n/g, " / ")`),
  );
  console.log(
    "info media:",
    await ev(
      `String(typeof navigator.mediaDevices.getDisplayMedia) + " " + String(navigator.mediaDevices.getDisplayMedia).slice(0, 60)`,
    ),
  );
  await sleep(3500);
  const recording = await ev(
    `!!document.querySelector('button[class*=danger], button') && [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Dừng ghi'))`,
  );
  check("recording started (Dừng ghi shown)", recording === true);
  console.log("info calls:", await ev(`JSON.stringify(window.__calls)`));
  console.log(
    "info buttons:",
    await ev(
      `[...document.querySelectorAll('header button, header a')].map((b) => b.textContent.trim()).join(' | ')`,
    ),
  );
  console.log(
    "info banners:",
    (
      await ev(
        `[...document.querySelectorAll('[role=alert],[role=status]')].map((e) => e.textContent.trim()).join(' | ')`,
      )
    ).slice(0, 300),
  );
  const n1 = await ev(`window.__sent`);
  check(
    "room jumped to the live tail and follows",
    (await nearBottom()) && /\(7488\)|Đoạn trực tiếp/.test(await lastText()),
    await lastText(),
  );
  await sleep(5000);
  const n2 = await ev(`window.__sent`);
  check(
    "new segments keep arriving and the list follows the newest",
    (n2 > n1 && (await nearBottom()) && (await lastText()).includes(`số ${n2}`)) ||
      (await lastText()).includes(`số ${n2 - 1}`),
    `sent ${n1}->${n2}, last="${await lastText()}"`,
  );
  check("only a window of rows is in the DOM", (await rows()) < 60, `rows=${await rows()}`);

  // user scrolls up: following stops, rows keep arriving, pill shows, position is not yanked
  await ev(`${LOG}.scrollTop -= 3000`);
  await sleep(1200);
  const topBefore = await ev(`${LOG}.scrollTop`);
  await sleep(2500);
  const topAfter = await ev(`${LOG}.scrollTop`);
  check(
    "scrolling up stops following",
    !(await nearBottom()) && Math.abs(topAfter - topBefore) < 5,
    `${topBefore} -> ${topAfter}`,
  );
  const pill = await ev(
    `[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Về dòng mới nhất'))`,
  );
  check("the 'Về dòng mới nhất' pill shows", pill === true);
  if (args.shot)
    writeFileSync(
      args.shot.replace(/\.png$/, "-scrolled.png"),
      Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"),
    );
  const pillPt = await ev(
    `(() => { const r = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Về dòng mới nhất')).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
  );
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
    await send("Input.dispatchMouseEvent", {
      type,
      x: pillPt.x,
      y: pillPt.y,
      button: "left",
      clickCount: 1,
      buttons: type === "mouseReleased" ? 0 : 1,
    });
  await sleep(1200);
  check("the pill returns to the newest line", await nearBottom());
  if (args.shot)
    writeFileSync(
      args.shot,
      Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"),
    );
  const reduced = await ev(`matchMedia('(prefers-reduced-motion: reduce)').matches`);
  console.log(`info reduced-motion=${reduced}`);
  await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
  ws.close();
  console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error("qa-long-live:", e.message);
  process.exit(1);
});
