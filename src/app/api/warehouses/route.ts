import { NextResponse } from "next/server";
import { USER_SHEET_ID, WAREHOUSES_SHEET_RANGE } from "@/config/sheets";
import { getSheetRows } from "@/lib/googleSheets";

export async function GET() {
  try {
    const rows = await getSheetRows(USER_SHEET_ID, WAREHOUSES_SHEET_RANGE);
    if (!rows.length) return NextResponse.json({ ok: true, warehouses: [] });
  const [, ...data] = rows;
    const idxA = 0; // ID
    const idxB = 1; // Name
    const idxC = 2; // Default
    const list = data
      .map((r) => {
        const id = (r?.[idxA] || "").toString().trim();
        const name = (r?.[idxB] || "").toString().trim();
        if (!name) return null;
        const def = (r?.[idxC] || "").toString().trim();
        const isDefault = def === "1" || def.toLowerCase() === "true";
        return { id, name, isDefault };
      })
      .filter(Boolean);
    return NextResponse.json({ ok: true, warehouses: list });
  } catch (_err: any) {
    void _err;
    return NextResponse.json({ ok: false, error: 'WAREHOUSES_FAILED' }, { status: 500 });
  }
}
