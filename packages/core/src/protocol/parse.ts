import type { z } from "zod";
import { clientMessageSchema, type ClientMessage } from "./client";
import { serverMessageSchema, type ServerMessage } from "./server";

export type ParseResult<T> = { ok: true; message: T } | { ok: false; error: string };

const textDecoder = new TextDecoder();

/** Accepts a raw text frame (string / Buffer) or an already-decoded value. */
function decodeJson(raw: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  if (typeof raw !== "string" && !(raw instanceof Uint8Array)) return { ok: true, value: raw };
  const text = typeof raw === "string" ? raw : textDecoder.decode(raw);
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

function parseWith<T>(schema: z.ZodType<T>, raw: unknown): ParseResult<T> {
  const decoded = decodeJson(raw);
  if (!decoded.ok) return decoded;
  const result = schema.safeParse(decoded.value);
  if (!result.success) return { ok: false, error: formatIssues(result.error) };
  return { ok: true, message: result.data };
}

export function parseClientMessage(raw: unknown): ParseResult<ClientMessage> {
  return parseWith(clientMessageSchema, raw);
}

export function parseServerMessage(raw: unknown): ParseResult<ServerMessage> {
  return parseWith(serverMessageSchema, raw);
}

/** Serialize a server message; typed so only valid shapes compile. */
export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

/** Serialize a client message; typed so only valid shapes compile. */
export function encodeClientMessage(message: ClientMessage): string {
  return JSON.stringify(message);
}
