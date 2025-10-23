import { NextRequest, NextResponse } from "next/server";
import { USER_SHEET_ID } from "@/config/sheets";
import { getSheetRows } from "@/lib/googleSheets";

export const runtime = "nodejs";

// GET /api/settings/inbound/cell?cell=D2
// Reads a single cell from sheet 'caidatphieunhap' and returns its value
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const cell = (searchParams.get("cell") || "D2").toUpperCase().trim();
    // Basic validation: A1 notation like [A-I][2-9][0-9]* allowed
    if (!/^[A-I][1-9][0-9]*$/.test(cell)) {
      return NextResponse.json({ ok: false, error: "INVALID_CELL" }, { status: 400 });
    }
    const range = `caidatphieunhap!${cell}:${cell}`;
    const rows = await getSheetRows(USER_SHEET_ID, range);
    const value = Array.isArray(rows) && rows.length ? (rows[0]?.[0] ?? "") : "";
    return NextResponse.json({ ok: true, cell, value: String(value ?? "") });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "CELL_READ_FAILED" }, { status: 500 });
  }
}
