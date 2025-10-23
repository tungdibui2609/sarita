import { NextResponse } from "next/server";
import { INBOUND_VERSIONS_SHEET_RANGE, USER_SHEET_ID } from "@/config/sheets";
import { getInboundVersions } from "@/lib/googleSheets";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = (url.searchParams.get("code") || "").toString().trim();
    if (!code) return NextResponse.json({ ok: false, error: "Thiếu code" }, { status: 400 });

    const rows = await getInboundVersions(USER_SHEET_ID, INBOUND_VERSIONS_SHEET_RANGE, code);
    return NextResponse.json({ ok: true, versions: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi" }, { status: 500 });
  }
}
