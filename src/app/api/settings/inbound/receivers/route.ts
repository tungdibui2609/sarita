import { NextResponse } from "next/server";
import { USER_SHEET_ID, INBOUND_SETTINGS_RECEIVERS_RANGE } from "@/config/sheets";
import { getSheetRows } from "@/lib/googleSheets";

export async function GET() {
  try {
    const rows = await getSheetRows(USER_SHEET_ID, INBOUND_SETTINGS_RECEIVERS_RANGE);
    // Expect A..I from row 2: B=receiverName, C..I -> TEXT1..TEXT7
    const receivers = rows.map((r: any[]) => {
      const name = (r?.[1] || "").toString().trim();
      if (!name) return null;
      return {
        name,
        TEXT1: (r?.[2] || "").toString(),
        TEXT2: (r?.[3] || "").toString(),
        TEXT3: (r?.[4] || "").toString(),
        TEXT4: (r?.[5] || "").toString(),
        TEXT5: (r?.[6] || "").toString(),
        TEXT6: (r?.[7] || "").toString(),
        TEXT7: (r?.[8] || "").toString(),
      };
    }).filter(Boolean);
    return NextResponse.json({ ok: true, receivers });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "RECEIVERS_LOAD_FAILED" }, { status: 500 });
  }
}
