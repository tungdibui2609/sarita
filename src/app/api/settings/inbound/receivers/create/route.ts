import { NextRequest, NextResponse } from "next/server";
import { USER_SHEET_ID, INBOUND_SETTINGS_RECEIVERS_RANGE } from "@/config/sheets";
import { appendInboundReceiver } from "@/lib/googleSheets";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = (body?.name || "").toString().trim();
    if (!name) return NextResponse.json({ ok: false, error: "RECEIVER_NAME_REQUIRED" }, { status: 400 });
    const payload = {
      name,
      TEXT1: (body?.TEXT1 || "").toString(),
      TEXT2: (body?.TEXT2 || "").toString(),
      TEXT3: (body?.TEXT3 || "").toString(),
      TEXT4: (body?.TEXT4 || "").toString(),
      TEXT5: (body?.TEXT5 || "").toString(),
      TEXT6: (body?.TEXT6 || "").toString(),
      TEXT7: (body?.TEXT7 || "").toString(),
    };
    const receiver = await appendInboundReceiver(USER_SHEET_ID, INBOUND_SETTINGS_RECEIVERS_RANGE, payload);
    return NextResponse.json({ ok: true, receiver });
  } catch (e: any) {
    const msg = (e?.message || "CREATE_FAILED").toString();
    const code = msg === "RECEIVER_EXISTS" ? 409 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status: code });
  }
}
