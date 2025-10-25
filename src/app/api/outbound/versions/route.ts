import { NextResponse } from "next/server";
import { OUTBOUND_VERSIONS_SHEET_RANGE, USER_SHEET_ID, LINK_PHIEUXUAT_SHEET_RANGE, OUTBOUND_SHEET_RANGE } from "@/config/sheets";
import { getInboundVersions, getSheetRows } from "@/lib/googleSheets";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    let code = (url.searchParams.get("code") || "").toString().trim();
    const slug = (url.searchParams.get("slug") || "").toString().trim();
    if (!code && !slug) return NextResponse.json({ ok: false, error: "Thiếu code hoặc slug" }, { status: 400 });

    if (!code && slug) {
      try {
        const rowsLink = await getSheetRows(USER_SHEET_ID, LINK_PHIEUXUAT_SHEET_RANGE);
        if (rowsLink.length) {
          const [, ...linkData] = rowsLink;
          for (const r of linkData) {
            const c = (r?.[0] || "").toString().trim();
            const s = (r?.[1] || "").toString().trim();
            if (s && s === slug) { code = c; break; }
          }
        }
      } catch {}
      if (!code) {
        try {
          const rowsOut = await getSheetRows(USER_SHEET_ID, OUTBOUND_SHEET_RANGE);
          if (rowsOut.length) {
            const [, ...data] = rowsOut;
            const idxN = 13;
            for (const r of data) {
              const s = (r?.[idxN] || "").toString().trim();
              if (s && s === slug) { code = (r?.[0] || "").toString().trim(); break; }
            }
          }
        } catch {}
      }
    }

    if (!code) return NextResponse.json({ ok: false, error: "Không tìm thấy mã phiếu tương ứng với slug" }, { status: 404 });

    const rows = await getInboundVersions(USER_SHEET_ID, OUTBOUND_VERSIONS_SHEET_RANGE, code);
    return NextResponse.json({ ok: true, versions: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi" }, { status: 500 });
  }
}
