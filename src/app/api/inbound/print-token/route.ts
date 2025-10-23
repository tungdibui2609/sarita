import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

function b64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = (searchParams.get("code") || "").trim();
    if (!code) return NextResponse.json({ ok: false, error: "CODE_REQUIRED" }, { status: 400 });

    const secret = process.env.QLK_LINK_SECRET || process.env.LINK_SIGN_SECRET;
    if (!secret) return NextResponse.json({ ok: false, error: "MISSING_SECRET" }, { status: 500 });

  // Permanent token: only bind to code; no expiry
  const payload = { c: code };
    const payloadJson = JSON.stringify(payload);
    const sig = crypto.createHmac("sha256", secret).update(payloadJson).digest();
    const token = `${b64url(payloadJson)}.${b64url(sig)}`;

    return NextResponse.json({ ok: true, token });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "TOKEN_FAILED" }, { status: 500 });
  }
}
