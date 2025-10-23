import { NextResponse } from "next/server";
import { USER_SHEET_ID, PRODUCTS_UOMS_RANGE } from "@/config/sheets";
import { listUoms } from "@/lib/googleSheets";

export async function GET() {
  try {
    const uoms = await listUoms(USER_SHEET_ID, PRODUCTS_UOMS_RANGE);
    return NextResponse.json({ uoms });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load uoms" }, { status: 500 });
  }
}
