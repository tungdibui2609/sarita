import { NextResponse } from "next/server";
import { USER_SHEET_ID, USER_SHEET_RANGE } from "@/config/sheets";
import { findUserWithRow, updateUserStatus } from "@/lib/googleSheets";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = body?.username as string | undefined;
    if (username) {
      try {
        const found = await findUserWithRow(USER_SHEET_ID, USER_SHEET_RANGE, username);
        if (found) {
          const tabName = USER_SHEET_RANGE.split("!")[0];
          await updateUserStatus(USER_SHEET_ID, tabName, found.header, found.rowIndex, "offline");
        }
      } catch {}
    }
  } catch {}

  const res = NextResponse.json({ ok: true });
  res.cookies.set("wms_auth", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
