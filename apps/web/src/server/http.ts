import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import type { ApiErrorBody } from "@/lib/api-types";
import { ServiceError } from "./service-error";

export function jsonError(status: number, code: string, message: string) {
  const body: ApiErrorBody = { error: { code, message } };
  return NextResponse.json(body, { status });
}

export const notFound = () => jsonError(404, "NOT_FOUND", "Không tìm thấy cuộc họp này.");

/**
 * CSRF guard for mutating routes: a browser always sends `Origin` on cross-site POST/PATCH, so
 * a foreign origin is refused. Requests without Origin (curl, tools, same-origin GET) pass.
 */
export function checkSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const host = request.headers.get("host") ?? new URL(request.url).host;
  try {
    if (new URL(origin).host === host) return null;
  } catch {
    // malformed Origin falls through to the refusal
  }
  return jsonError(403, "FORBIDDEN_ORIGIN", "Yêu cầu bị từ chối vì đến từ nguồn khác.");
}

type Parsed<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Reads a JSON body and validates it; failures become a ready-to-return 400. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<Parsed<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: jsonError(400, "BAD_JSON", "Nội dung gửi lên không phải JSON hợp lệ."),
    };
  }
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const detail = result.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);
  return { ok: false, response: jsonError(400, "VALIDATION", detail.join("; ")) };
}

/** Runs a service call; `ServiceError`s become their JSON error response, anything else rethrows. */
export async function respond<T>(fn: () => Promise<T> | T, status = 200): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn(), { status });
  } catch (err) {
    if (err instanceof ServiceError) return jsonError(err.status, err.code, err.message);
    throw err;
  }
}

/** Validates URL search params; failures become a ready-to-return 400. */
export function parseQuery<T>(url: string, schema: ZodType<T>): Parsed<T> {
  const raw = Object.fromEntries(new URL(url).searchParams);
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const detail = result.error.issues.map((i) => `${i.path.join(".") || "query"}: ${i.message}`);
  return { ok: false, response: jsonError(400, "VALIDATION", detail.join("; ")) };
}
