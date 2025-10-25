import { NextResponse } from "next/server";
import { INBOUND_VERSIONS_SHEET_RANGE, USER_SHEET_ID, LINK_PHIEUNHAP_SHEET_RANGE, INBOUND_SHEET_RANGE } from "@/config/sheets";
import { getInboundVersions, getSheetRows } from "@/lib/googleSheets";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    let code = (url.searchParams.get("code") || "").toString().trim();
    const slug = (url.searchParams.get("slug") || "").toString().trim();
    if (!code && !slug) return NextResponse.json({ ok: false, error: "Thiếu code hoặc slug" }, { status: 400 });

    if (!code && slug) {
      // Try find mapping slug -> code from link sheet
      try {
        const rowsLink = await getSheetRows(USER_SHEET_ID, LINK_PHIEUNHAP_SHEET_RANGE);
        if (rowsLink.length) {
          const [, ...linkData] = rowsLink;
          for (const r of linkData) {
            const c = (r?.[0] || "").toString().trim();
            const s = (r?.[1] || "").toString().trim();
            if (s && s === slug) { code = c; break; }
          }
        }
      } catch { /* ignore */ }
      // If still no code, try scanning inbound sheet's slug column
      if (!code) {
        try {
          const rowsInbound = await getSheetRows(USER_SHEET_ID, INBOUND_SHEET_RANGE);
          if (rowsInbound.length) {
            const [, ...data] = rowsInbound;
            const idxN = 13; // column N index
            for (const r of data) {
              const s = (r?.[idxN] || "").toString().trim();
              if (s && s === slug) {
                code = (r?.[0] || "").toString().trim();
                break;
              }
            }
          }
        } catch {}
      }
    }

    if (!code) return NextResponse.json({ ok: false, error: "Không tìm thấy mã phiếu tương ứng với slug" }, { status: 404 });

    const rows = await getInboundVersions(USER_SHEET_ID, INBOUND_VERSIONS_SHEET_RANGE, code);
    return NextResponse.json({ ok: true, versions: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi" }, { status: 500 });
  }
}
