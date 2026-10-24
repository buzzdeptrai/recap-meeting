import { NextResponse } from "next/server";
import { getRepositories } from "@/server/db";
import { getAuthService, withAuth } from "@/server/auth";
import { checkSameOrigin, parseBody, respond } from "@/server/http";
import { createUser, createUserSchema, listUsers } from "@/server/users-service";

export const dynamic = "force-dynamic";

const deps = () => ({ repos: getRepositories(), auth: getAuthService() });

export const GET = withAuth(() => NextResponse.json({ users: listUsers(deps()) }), { admin: true });

export const POST = withAuth(
  async (request) => {
    const forbidden = checkSameOrigin(request);
    if (forbidden) return forbidden;
    const parsed = await parseBody(request, createUserSchema);
    if (!parsed.ok) return parsed.response;
    return respond(() => createUser(deps(), parsed.data), 201);
  },
  { admin: true },
);
