import { NextResponse } from "next/server";
import { USER_SHEET_ID, USER_SHEET_RANGE } from "@/config/sheets";
import { listUsersFromSheet, findUserWithRow, updateUserStatus, appendUserToSheet, updateUserInSheet, listRoleCodesFromSheet } from "@/lib/googleSheets";

export async function GET() {
  try {
    const users = await listUsersFromSheet(USER_SHEET_ID, USER_SHEET_RANGE);
  const now = Date.now();
  const THRESHOLD_MS = 2 * 60 * 1000; // 2 phút
    const withOnline = users.map((u) => {
      const t = u.lastseen ? Date.parse(u.lastseen) : NaN;
      const recent = !Number.isNaN(t) && now - t <= THRESHOLD_MS;
      const fallback = String(u.status || "").toLowerCase() === "online";
      return { ...u, isOnline: recent || (!u.lastseen && fallback) };
    });

    // Best-effort: đồng bộ 'status' trên sheet về 'offline' nếu isOnline=false nhưng status vẫn 'online'
    try {
      const tabName = USER_SHEET_RANGE.split("!")[0];
      for (const u of withOnline) {
        if (!u.isOnline && String(u.status || "").toLowerCase() === "online") {
          const found = await findUserWithRow(USER_SHEET_ID, USER_SHEET_RANGE, u.username);
          if (found) {
            await updateUserStatus(USER_SHEET_ID, tabName, found.header, found.rowIndex, "offline");
          }
        }
      }
    } catch {
      // ignore sync errors; still return data
    }

    return NextResponse.json({ ok: true, users: withOnline });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi không xác định" }, { status: 500 });
  }
}

export async function OPTIONS() {
  // trả về danh sách role code (từ cột J) để client chọn nhiều vai trò
  try {
    const codes = await listRoleCodesFromSheet(USER_SHEET_ID, USER_SHEET_RANGE);
    return NextResponse.json({ ok: true, roleCodes: codes });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi không xác định" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
  const { username, password, name, role, position, roleCodes } = body || {};
    if (!username || !password) {
      return NextResponse.json({ ok: false, error: "Thiếu tài khoản hoặc mật khẩu" }, { status: 400 });
    }
    // Kiểm tra trùng username
    const existing = await findUserWithRow(USER_SHEET_ID, USER_SHEET_RANGE, username);
    if (existing) {
      return NextResponse.json({ ok: false, error: "Tài khoản đã tồn tại" }, { status: 409 });
    }
    await appendUserToSheet(USER_SHEET_ID, USER_SHEET_RANGE, { username, password, name, role, position, roleCodes });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi không xác định" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
  const { originalUsername, username, password, name, role, position, roleCodes } = body || {};
    if (!originalUsername) {
      return NextResponse.json({ ok: false, error: "Thiếu khóa người dùng để cập nhật" }, { status: 400 });
    }
    await updateUserInSheet(USER_SHEET_ID, USER_SHEET_RANGE, originalUsername, { username, password, name, role, position, roleCodes });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi không xác định" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { username } = await req.json();
    if (!username) return NextResponse.json({ ok: false, error: "Thiếu tài khoản" }, { status: 400 });
    const found = await findUserWithRow(USER_SHEET_ID, USER_SHEET_RANGE, username);
    if (!found) return NextResponse.json({ ok: false, error: "Không tìm thấy người dùng" }, { status: 404 });
    const tabName = USER_SHEET_RANGE.split("!")[0];
    await updateUserStatus(USER_SHEET_ID, tabName, found.header, found.rowIndex, "disabled");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi không xác định" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { username, status } = await req.json();
    if (!username) return NextResponse.json({ ok: false, error: "Thiếu tài khoản" }, { status: 400 });
    const found = await findUserWithRow(USER_SHEET_ID, USER_SHEET_RANGE, username);
    if (!found) return NextResponse.json({ ok: false, error: "Không tìm thấy người dùng" }, { status: 404 });
    const tabName = USER_SHEET_RANGE.split("!")[0];
    await updateUserStatus(USER_SHEET_ID, tabName, found.header, found.rowIndex, status || "offline");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi không xác định" }, { status: 500 });
  }
}
