import { NextRequest } from "next/server";
import { USER_SHEET_ID } from "@/config/sheets";
import { getInboundSettings, saveInboundSettings, type InboundSettings } from "@/lib/googleSheets";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await getInboundSettings(USER_SHEET_ID);
    return new Response(JSON.stringify({ ok: true, settings }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "LOAD_SETTINGS_FAILED" }), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const settings: InboundSettings = (body?.settings && typeof body.settings === "object") ? body.settings : {};
    await saveInboundSettings(USER_SHEET_ID, settings);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "SAVE_SETTINGS_FAILED" }), { status: 500 });
  }
}
