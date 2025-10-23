import { NextRequest, NextResponse } from "next/server";
import { USER_SHEET_ID, INBOUND_SETTINGS_RECEIVERS_RANGE } from "@/config/sheets";
import { deleteInboundReceiverByName } from "@/lib/googleSheets";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = (body?.name || "").toString().trim();
    if (!name) return NextResponse.json({ ok: false, error: "NAME_REQUIRED" }, { status: 400 });
    const res = await deleteInboundReceiverByName(USER_SHEET_ID, INBOUND_SETTINGS_RECEIVERS_RANGE, name);
    return NextResponse.json({ ok: true, receiver: res });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "DELETE_FAILED" }, { status: 500 });
  }
}
