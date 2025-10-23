import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function safeHostFromReq(req: NextRequest) {
  try {
    const forwardedProto = req.headers.get('x-forwarded-proto');
    const forwardedHost = req.headers.get('x-forwarded-host');
    const hostHeader = req.headers.get('host');
    if (forwardedHost) return `${forwardedProto || 'https'}://${forwardedHost}`;
    if (hostHeader) return `https://${hostHeader}`;
  } catch {}
  return '';
}

// Allow only simple slugs (alnum, -, _). Prevent SSRF by disallowing full URLs here.
const SLUG_RE = /^[A-Za-z0-9_-]+$/;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = (searchParams.get('slug') || '').trim();
    if (!slug) return NextResponse.json({ ok: false, error: 'SLUG_REQUIRED' }, { status: 400 });
    if (!SLUG_RE.test(slug)) return NextResponse.json({ ok: false, error: 'SLUG_INVALID' }, { status: 400 });

    // Resolve absolute preview URL
    const envBase = (process.env.PRINT_BASE || '').toString().trim().replace(/\/$/, '');
    const base = envBase || safeHostFromReq(req) || 'http://localhost:3000';
    const targetUrl = `${base.replace(/\/$/, '')}/xhd/${encodeURIComponent(slug)}?snapshot=1`;

    const browserlessBase = (process.env.BROWSERLESS_URL || '').trim() || 'https://production-sfo.browserless.io';
    const token = (process.env.BROWSERLESS_TOKEN || process.env.BROWSERLESS_API_KEY || '').trim();
    if (!token) return NextResponse.json({ ok: false, error: 'MISSING_BROWSERLESS_TOKEN' }, { status: 500 });

    const timeoutMs = Number(process.env.SCREENSHOT_TIMEOUT_MS || 30000);
    const endpoint = `${browserlessBase.replace(/\/+$/, '')}/screenshot?token=${encodeURIComponent(token)}&timeout=${encodeURIComponent(String(timeoutMs))}`;

    // Payload: ask Browserless to nav to the preview URL, wait for #print-ready briefly
    const payload = {
      url: targetUrl,
      gotoOptions: { timeout: timeoutMs, waitUntil: 'networkidle2' },
      waitForSelector: { selector: '#print-ready', timeout: Math.min(4000, timeoutMs), visible: true },
      bestAttempt: true,
    } as any;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs + 2000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal as any,
      } as any);
      clearTimeout(timer);
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        return NextResponse.json({ ok: false, error: 'BROWSERLESS_ERROR', status: res.status, body: txt }, { status: 502 });
      }
      const buf = await res.arrayBuffer();
      const byteLen = buf ? (buf as ArrayBuffer).byteLength : 0;
      if (byteLen < 100) {
        return NextResponse.json({ ok: false, error: 'EMPTY_IMAGE', bytes: byteLen }, { status: 502 });
      }

      const headers = new Headers({ 'Content-Type': 'image/png', 'Cache-Control': `public, max-age=${Math.floor((process.env.SCREENSHOT_CACHE_TTL_MS ? Number(process.env.SCREENSHOT_CACHE_TTL_MS) : 60000)/1000)}` });
      // Expose as inline image for preview
      headers.set('Content-Disposition', `inline; filename="phieu-${slug}.png"`);
      return new NextResponse(Buffer.from(buf as any), { status: 200, headers });
    } catch (e: any) {
      clearTimeout(timer);
      if (e && e.name === 'AbortError') {
        return NextResponse.json({ ok: false, error: 'TIMEOUT' }, { status: 504 });
      }
      return NextResponse.json({ ok: false, error: (e && e.message) ? e.message : 'FETCH_FAILED' }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: (e && e.message) ? e.message : 'UNEXPECTED' }, { status: 500 });
  }
}
