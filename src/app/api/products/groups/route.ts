import { NextResponse } from "next/server";
import { USER_SHEET_ID, PRODUCTS_GROUPS_RANGE } from "@/config/sheets";
import { listProductGroups } from "@/lib/googleSheets";

export async function GET() {
  try {
    const groups = await listProductGroups(USER_SHEET_ID, PRODUCTS_GROUPS_RANGE);
    return NextResponse.json({ groups });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load groups" }, { status: 500 });
  }
}
