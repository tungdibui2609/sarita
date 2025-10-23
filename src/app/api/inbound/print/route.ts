import { NextRequest } from "next/server";
export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  return new Response(JSON.stringify({ ok: false, error: "PRINT_FEATURE_REMOVED" }), { status: 410 });
}