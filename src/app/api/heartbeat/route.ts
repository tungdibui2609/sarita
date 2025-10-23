import { NextResponse } from "next/server";
import { USER_SHEET_ID, USER_SHEET_RANGE } from "@/config/sheets";
import { findUserWithRow, updateUserLastSeen } from "@/lib/googleSheets";

export async function POST(request: Request) {
  try {
    const { username } = await request.json().catch(() => ({}));
    if (!username) return NextResponse.json({ ok: false, error: "Thiếu username" }, { status: 400 });
    const found = await findUserWithRow(USER_SHEET_ID, USER_SHEET_RANGE, username);
    if (!found) return NextResponse.json({ ok: false, error: "Không tìm thấy người dùng" }, { status: 404 });
    const tabName = USER_SHEET_RANGE.split("!")[0];
    await updateUserLastSeen(USER_SHEET_ID, tabName, found.header, found.rowIndex, new Date().toISOString());
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi không xác định" }, { status: 500 });
  }
}
