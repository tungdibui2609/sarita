import { NextResponse } from "next/server";
import { findUserWithRow, updateUserStatus, updateUserLastSeen } from "@/lib/googleSheets";
import { USER_SHEET_ID, USER_SHEET_RANGE } from "@/config/sheets";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ message: "Thiếu tài khoản hoặc mật khẩu" }, { status: 400 });
    }

    // Xác thực với Google Sheet (kèm vị trí hàng)
    const found = await findUserWithRow(USER_SHEET_ID, USER_SHEET_RANGE, username);
    if (!found || found.user.password !== password) {
      return NextResponse.json({ message: "Sai tài khoản hoặc mật khẩu" }, { status: 401 });
    }

    // Chặn đăng nhập nếu tài khoản bị vô hiệu hóa
    if (String(found.user.status || "").toLowerCase() === "disabled") {
      return NextResponse.json({ message: "Tài khoản đã bị vô hiệu hóa" }, { status: 403 });
    }

    // Cập nhật trạng thái online và lastseen khi đăng nhập
    try {
      const tabName = USER_SHEET_RANGE.split("!")[0];
      await updateUserStatus(USER_SHEET_ID, tabName, found.header, found.rowIndex, "online");
      await updateUserLastSeen(USER_SHEET_ID, tabName, found.header, found.rowIndex, new Date().toISOString());
    } catch {}

    const res = NextResponse.json({ ok: true, name: found.user.name || found.user.username, role: found.user.role || "Nhân viên" });
    res.cookies.set("wms_auth", "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch {
    return NextResponse.json({ message: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
}
