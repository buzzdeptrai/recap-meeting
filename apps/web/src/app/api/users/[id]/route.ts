import { getRepositories } from "@/server/db";
import { getAuthService, withAuth } from "@/server/auth";
import { checkSameOrigin, parseBody, respond } from "@/server/http";
import { patchUserSchema, updateUser } from "@/server/users-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** `resetPassword: true` returns a one-time `tempPassword` (shown once, stored only as a hash). */
export const PATCH = withAuth(
  async (request, { params }: RouteContext, session) => {
    const forbidden = checkSameOrigin(request);
    if (forbidden) return forbidden;
    const parsed = await parseBody(request, patchUserSchema);
    if (!parsed.ok) return parsed.response;
    const { id } = await params;
    const deps = { repos: getRepositories(), auth: getAuthService() };
    return respond(() => updateUser(deps, session.user.id, id, parsed.data));
  },
  { admin: true },
);
