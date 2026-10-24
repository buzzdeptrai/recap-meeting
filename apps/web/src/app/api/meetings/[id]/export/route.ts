import {
  DOCX_CONTENT_TYPE,
  MARKDOWN_CONTENT_TYPE,
  exportMinutesDocx,
  exportMinutesMarkdownFile,
  parseExportFormat,
  parseExportMode,
} from "@/server/export-service";
import { jsonError } from "@/server/http";
import { ServiceError } from "@/server/service-error";
import { withAuth } from "@/server/auth";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withAuth(async (request: Request, { params }: RouteContext) => {
  const { id } = await params;
  const query = new URL(request.url).searchParams;
  const mode = parseExportMode(query.get("lang"));
  if (!mode) return jsonError(400, "VALIDATION", "lang: phải là vi, en hoặc both");
  const format = parseExportFormat(query.get("format"));
  if (!format) return jsonError(400, "VALIDATION", "format: phải là docx hoặc md");
  try {
    if (format === "md") {
      const { body, contentDisposition } = await exportMinutesMarkdownFile(id, mode);
      return new Response(body, {
        headers: {
          "Content-Type": MARKDOWN_CONTENT_TYPE,
          "Content-Disposition": contentDisposition,
          "Cache-Control": "no-store",
        },
      });
    }
    const { buffer, contentDisposition } = await exportMinutesDocx(id, mode);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": DOCX_CONTENT_TYPE,
        "Content-Disposition": contentDisposition,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ServiceError) return jsonError(err.status, err.code, err.message);
    throw err;
  }
});
