import type { IncomingMessage, ServerResponse } from "node:http";
import { HEALTH_PATH } from "@recap/core";

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

export function handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (req.method === "GET" && path === HEALTH_PATH) {
    sendJson(res, HTTP_OK, { ok: true });
    return;
  }
  sendJson(res, HTTP_NOT_FOUND, { ok: false, error: "Not found" });
}
