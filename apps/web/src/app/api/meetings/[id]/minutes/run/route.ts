import { jsonError, respond } from "@/server/http";
import { getLatestRun } from "@/server/minutes-run-service";
import { ServiceError } from "@/server/service-error";
import { minutesQuerySchema } from "@/server/schemas";
import { withAuth } from "@/server/auth";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Latest generation run of the minutes in one language; 404 RUN_NOT_FOUND when none yet. */
export const GET = withAuth(async (request: Request, { params }: RouteContext) => {
  const { id } = await params;
  const query = minutesQuerySchema.safeParse({
    lang: new URL(request.url).searchParams.get("lang"),
  });
  if (!query.success) return jsonError(400, "VALIDATION", "lang: phải là vi hoặc en");
  return respond(() => {
    const run = getLatestRun(id, query.data.lang);
    if (!run) throw new ServiceError(404, "RUN_NOT_FOUND", "Chưa có lần tạo biên bản nào.");
    return run;
  });
});
