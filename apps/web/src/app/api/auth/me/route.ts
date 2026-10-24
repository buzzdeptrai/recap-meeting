import { NextResponse } from "next/server";
import { withAuth } from "@/server/auth";

export const dynamic = "force-dynamic";

export const GET = withAuth((_request, _context, { user }) => NextResponse.json({ user }));
