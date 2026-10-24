#!/usr/bin/env node
/* eslint-disable max-lines-per-function, @typescript-eslint/no-unused-expressions -- QA/demo tooling, linear scripts */
/**
 * Tiny headless-Chrome (CDP) screenshot driver for UI QA.
 *
 * Usage:
 *   QA_EMAIL=... QA_PASSWORD=... node scripts/qa-cdp.mjs --base http://localhost:3101 \
 *     --chrome-port 9335 --out data/screens/meetings-list --scenarios scripts/qa-meetings-list.scenarios.mjs [--only name,name]
 * Chrome must already run:
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --remote-debugging-port=9335 --user-data-dir=<tmp>
 * A scenarios module default-exports `[{ name, width, height, fullPage?, steps: [...] }]`; steps:
 *   ["goto", path] ["click", css|"text=Label"] ["hover", css|text] ["type", css, text]
 *   ["key", "Escape"] ["wait", ms] ["eval", js] ["shot", name?]
 * Credentials come from the environment and are never printed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import WebSocket from "ws";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce(
      (acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc),
      [],
    ),
);
const base = args.base ?? "http://localhost:3101";
const port = args["chrome-port"] ?? "9335";
const out = resolve(args.out ?? "data/screens/meetings-list");
const only = args.only ? new Set(args.only.split(",")) : null;
mkdirSync(out, { recursive: true });

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
  const targets = await (
    await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })
  ).json();
  const ws = new WebSocket(targets.webSocketDebuggerUrl);
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
  return { send, close: () => ws.close(), targetId: targets.id };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FIND = `(sel) => {
  if (sel.startsWith("text=")) {
    const t = sel.slice(5);
    const all = [...document.querySelectorAll("button,a,[role=option],[role=menuitem],[role=radio],[role=combobox],label,span")];
    return all.find((e) => e.textContent.trim() === t && e.offsetParent !== null) ?? all.find((e) => e.textContent.trim().startsWith(t) && e.offsetParent !== null);
  }
  return [...document.querySelectorAll(sel)].find((e) => e.offsetParent !== null || getComputedStyle(e).position === "fixed") ?? document.querySelector(sel);
}`;

async function main() {
  const token = await login();
  const scenarios = (await import(pathToFileURL(resolve(args.scenarios)).href)).default;
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
  await send("Network.enable");
  await send("Network.setCookie", {
    name: "recap_session",
    value: token,
    url: base,
    httpOnly: true,
  });
  const center = async (sel) => {
    const rect = await ev(
      `(() => { const f = ${FIND}; const e = f(${JSON.stringify(sel)}); if (!e) return null; e.scrollIntoView({block:"center"}); const r = e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`,
    );
    if (!rect) throw new Error(`not found: ${sel}`);
    return rect;
  };
  const mouse = async (type, x, y) =>
    send("Input.dispatchMouseEvent", {
      type,
      x,
      y,
      button: "left",
      clickCount: 1,
      buttons: type === "mouseReleased" ? 0 : 1,
    });
  for (const scenario of scenarios) {
    if (only && !only.has(scenario.name)) continue;
    await send("Emulation.setDeviceMetricsOverride", {
      width: scenario.width,
      height: scenario.height ?? 900,
      deviceScaleFactor: 1,
      mobile: scenario.width < 700,
    });
    for (const [op, a, b] of scenario.steps) {
      if (op === "goto") {
        await send("Page.navigate", { url: base + a });
        await sleep(2500);
      } else if (op === "click") {
        const { x, y } = await center(a);
        await mouse("mouseMoved", x, y);
        await mouse("mousePressed", x, y);
        await mouse("mouseReleased", x, y);
        await sleep(450);
      } else if (op === "hover") {
        const { x, y } = await center(a);
        await mouse("mouseMoved", x, y);
        await sleep(350);
      } else if (op === "type") {
        const { x, y } = await center(a);
        await mouse("mousePressed", x, y);
        await mouse("mouseReleased", x, y);
        await send("Input.insertText", { text: b });
        await sleep(900);
      } else if (op === "key") {
        // "Escape", or with modifiers: "Control+f", "Shift+Enter"
        const parts = a.split("+");
        const key = parts.pop();
        const MODS = { Alt: 1, Control: 2, Meta: 4, Shift: 8 };
        const modifiers = parts.reduce((m, name) => m | (MODS[name] ?? 0), 0);
        const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
        const text = key === "Enter" ? "\r" : undefined;
        await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, modifiers, text });
        await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, modifiers });
        await sleep(300);
      } else if (op === "wait") await sleep(a);
      else if (op === "eval") console.log(`  eval:`, JSON.stringify(await ev(a)));
      else if (op === "shot") {
        const name = a ?? scenario.name;
        const params = { format: "png" };
        if (scenario.fullPage) {
          const height = await ev("Math.ceil(document.documentElement.scrollHeight)");
          Object.assign(params, {
            captureBeyondViewport: true,
            clip: { x: 0, y: 0, width: scenario.width, height: Math.min(height, 6000), scale: 1 },
          });
        }
        const { data } = await send("Page.captureScreenshot", params);
        writeFileSync(`${out}/${name}.png`, Buffer.from(data, "base64"));
        console.log(`shot ${name}`);
      }
    }
  }
  await fetch(`http://127.0.0.1:${port}/json/close/${chrome.targetId}`);
  chrome.close();
}

main().catch((error) => {
  console.error("qa-cdp:", error.message);
  process.exit(1);
});
