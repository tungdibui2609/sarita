import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

function fromB64url(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = (searchParams.get("token") || "").trim();
    if (!token) return NextResponse.json({ ok: false, error: "TOKEN_REQUIRED" }, { status: 400 });
    const secret = process.env.QLK_LINK_SECRET || process.env.LINK_SIGN_SECRET;
    if (!secret) return NextResponse.json({ ok: false, error: "MISSING_SECRET" }, { status: 500 });

    const parts = token.split(".");
    if (parts.length !== 2) return NextResponse.json({ ok: false, error: "TOKEN_FORMAT" }, { status: 400 });
    const payloadBuf = fromB64url(parts[0]);
    const sigBuf = fromB64url(parts[1]);
    const payloadStr = payloadBuf.toString("utf8");
    const expected = crypto.createHmac("sha256", secret).update(payloadStr).digest();
    if (!crypto.timingSafeEqual(expected, sigBuf)) {
      return NextResponse.json({ ok: false, error: "TOKEN_INVALID" }, { status: 400 });
    }
    const data = JSON.parse(payloadStr || "{}");
    // Permanent tokens: no expiry check. For backward compatibility, if exp is present, ignore it.
    const code = (data?.c || "").toString();
    if (!code) return NextResponse.json({ ok: false, error: "CODE_MISSING" }, { status: 400 });
    return NextResponse.json({ ok: true, code });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "RESOLVE_FAILED" }, { status: 500 });
  }
}
