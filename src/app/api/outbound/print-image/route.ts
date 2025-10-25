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

const SLUG_RE = /^[A-Za-z0-9_-]+$/;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slugOrCode = (searchParams.get('slug') || '').trim();
    if (!slugOrCode) return NextResponse.json({ ok: false, error: 'SLUG_REQUIRED' }, { status: 400 });
    if (!SLUG_RE.test(slugOrCode)) return NextResponse.json({ ok: false, error: 'SLUG_INVALID' }, { status: 400 });

    const envBase = (process.env.PRINT_BASE || '').toString().trim().replace(/\/$/, '');
    const base = envBase || safeHostFromReq(req) || 'http://localhost:3000';
    // For outbound we use the dedicated print page
    const targetUrl = `${base.replace(/\/$/, '')}/print/outbound?code=${encodeURIComponent(slugOrCode)}&snapshot=1`;

    const serviceBase = (process.env.SCREENSHOT_SERVICE_URL || '').trim() || 'https://chupanh.onrender.com';
    const timeoutMs = Number(process.env.SCREENSHOT_TIMEOUT_MS || 45000);
    const screenshotUrl = `${serviceBase.replace(/\/+$/, '')}/screenshot?url=${encodeURIComponent(targetUrl)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs + 2000);
    const cacheTtlSec = Math.max(0, Math.floor(Number(process.env.SCREENSHOT_CACHE_TTL_MS || 0) / 1000));

    try {
      const res = await fetch(screenshotUrl, { method: 'GET', signal: controller.signal });
      const ct = res.headers.get('content-type') || 'image/jpeg';
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('Screenshot service error', res.status, ct, body);
        return NextResponse.json({ error: 'SCREENSHOT_SERVICE_ERROR', details: body }, { status: 502 });
      }
      const buffer = await res.arrayBuffer();
      return new NextResponse(Buffer.from(buffer), { status: 200, headers: { 'content-type': ct, 'cache-control': `public, max-age=${cacheTtlSec}` } });
    } catch (err: any) {
      console.error('print-image outbound fetch error', err?.message || err);
      return NextResponse.json({ error: 'SCREENSHOT_SERVICE_FETCH_ERROR', details: String(err) }, { status: 502 });
    } finally { clearTimeout(timer); }
  } catch (err: any) {
    console.error('print-image outbound top-level', err?.message || err);
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR', details: String(err) }, { status: 500 });
  }
}
