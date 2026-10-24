import { parseQuery } from "@/server/http";
import { getCsv } from "@/server/usage-service";
import { exportQuerySchema } from "@/server/usage-range";
import { withAuth } from "@/server/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request: Request) => {
  const parsed = parseQuery(request.url, exportQuerySchema);
  if (!parsed.ok) return parsed.response;
  const { from, to, groupBy } = parsed.data;
  const name = `usage-${groupBy}-${from.slice(0, 10)}_${to.slice(0, 10)}.csv`;
  return new Response(getCsv(parsed.data), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
});
