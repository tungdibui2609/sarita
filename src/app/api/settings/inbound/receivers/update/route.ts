import { NextRequest, NextResponse } from "next/server";
import { USER_SHEET_ID, INBOUND_SETTINGS_RECEIVERS_RANGE } from "@/config/sheets";
import { updateInboundReceiverRowByName } from "@/lib/googleSheets";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = (body?.name || "").toString().trim();
    const updates = (body?.updates || {}) as Record<string, string>;
    if (!name) return NextResponse.json({ ok: false, error: "NAME_REQUIRED" }, { status: 400 });

    const allowed = ["TEXT1","TEXT2","TEXT3","TEXT4","TEXT5","TEXT6","TEXT7"] as const;
    const payload: any = {};
    for (const k of allowed) {
      if (k in updates) payload[k] = (updates as any)[k];
    }

    const res = await updateInboundReceiverRowByName(USER_SHEET_ID, INBOUND_SETTINGS_RECEIVERS_RANGE, name, payload);
    return NextResponse.json({ ok: true, receiver: res });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "UPDATE_FAILED" }, { status: 500 });
  }
}
