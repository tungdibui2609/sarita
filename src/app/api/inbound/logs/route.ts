import { NextResponse } from "next/server";
import { INBOUND_LOG_SHEET_RANGE, USER_SHEET_ID } from "@/config/sheets";
import { getSheetRows } from "@/lib/googleSheets";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = (url.searchParams.get("code") || "").toString().trim();
    if (!code) return NextResponse.json({ ok: false, error: "Thiếu code" }, { status: 400 });

    const rows = await getSheetRows(USER_SHEET_ID, INBOUND_LOG_SHEET_RANGE);
    if (!rows.length) return NextResponse.json({ ok: true, logs: [] });
  const [, ...data] = rows;
    // columns: A=Timestamp, B=Code, C=User, D=Action, E=Details, F=Slug
    const out: Array<{ timestamp: string; code: string; user: string; action: string; details: string; slug?: string }> = [];
    for (const r of data) {
      const c = (r?.[1] || "").toString().trim();
      if (!c) continue;
      if (c !== code) continue;
      out.push({
        timestamp: (r?.[0] || "").toString(),
        code: c,
        user: (r?.[2] || "").toString(),
        action: (r?.[3] || "").toString(),
        details: (r?.[4] || "").toString(),
        slug: (r?.[5] || "").toString() || undefined,
      });
    }

    return NextResponse.json({ ok: true, logs: out });
  } catch (_err: any) {
    void _err;
    return NextResponse.json({ ok: false, error: "Lỗi" }, { status: 500 });
  }
}
