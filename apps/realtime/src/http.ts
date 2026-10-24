import type { IncomingMessage, ServerResponse } from "node:http";
import { HEALTH_PATH } from "@recap/core";
import type { MinutesWorker } from "@recap/minutes";

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

/** Health body: liveness plus the minutes worker's state (flags and numbers only). */
function healthBody(worker?: Pick<MinutesWorker, "status">) {
  if (!worker) return { ok: true };
  const { running, pollMs } = worker.status();
  return { ok: true, minutesWorker: { running, pollMs } };
}

export function createHttpHandler(worker?: Pick<MinutesWorker, "status">) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (req.method === "GET" && path === HEALTH_PATH) {
      sendJson(res, HTTP_OK, healthBody(worker));
      return;
    }
    sendJson(res, HTTP_NOT_FOUND, { ok: false, error: "Not found" });
  };
}
