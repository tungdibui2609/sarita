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

    // First try: the simpler payload that worked previously — wait for the '#print-ready' marker
    // and capture the default viewport (some providers / pages behaved better with this payload).
    const simplePayload = {
      url: targetUrl,
      gotoOptions: { timeout: timeoutMs, waitUntil: 'networkidle2' },
      // Wait a bit longer for the readiness marker and capture the full page so QR/footer is included
      waitForSelector: { selector: '#print-ready', timeout: Math.min(8000, timeoutMs), visible: true },
      fullPage: true,
      bestAttempt: true,
    } as any;

    // Fallback payload: wait for the QR image and capture full page so QR (usually at bottom)
    // is included. We use this if the simple attempt fails or returns a too-small image.
    const fallbackPayload = {
      url: targetUrl,
      gotoOptions: { timeout: timeoutMs, waitUntil: 'networkidle2' },
      waitForSelector: { selector: 'img[alt="QR"]', timeout: Math.min(8000, timeoutMs), visible: true },
      fullPage: true,
      bestAttempt: true,
    } as any;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs + 2000);
    try {
      // Try simple first
      let res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simplePayload),
        signal: controller.signal as any,
      } as any);
      clearTimeout(timer);
      // If simple attempt fails or returns small/empty image, fall back to the QR/fullPage payload
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        try { console.error('Browserless (simple) responded with', res.status, txt && txt.slice ? txt.slice(0, 2000) : txt); } catch {}
        // proceed to fallback below
      } else {
        const buf = await res.arrayBuffer().catch(() => null as any);
        const byteLen = buf ? (buf as ArrayBuffer).byteLength : 0;
        if (buf && byteLen >= 100) {
          const headers = new Headers({ 'Content-Type': 'image/png', 'Cache-Control': `public, max-age=${Math.floor((process.env.SCREENSHOT_CACHE_TTL_MS ? Number(process.env.SCREENSHOT_CACHE_TTL_MS) : 60000)/1000)}` });
          headers.set('Content-Disposition', `inline; filename="phieu-${slug}.png"`);
          return new NextResponse(Buffer.from(buf as any), { status: 200, headers });
        }
        // else fall through to fallback
      }

      // Fallback: try the QR + fullPage payload
      // reset timer and controller
      const controller2 = new AbortController();
      const timer2 = setTimeout(() => controller2.abort(), timeoutMs + 2000);
      try {
        let res2 = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackPayload),
          signal: controller2.signal as any,
        } as any);
        clearTimeout(timer2);
        if (!res2.ok) {
          const txt2 = await res2.text().catch(() => '');
          try { console.error('Browserless (fallback) responded with', res2.status, txt2 && txt2.slice ? txt2.slice(0, 2000) : txt2); } catch {}
          // Try auth-retry below for 401/403
          if (res2.status === 401 || res2.status === 403) {
            try {
              const authEndpoint = `${browserlessBase.replace(/\/+$|$/,'')}/screenshot?timeout=${encodeURIComponent(String(timeoutMs))}`;
              const retryRes = await fetch(authEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(fallbackPayload),
                signal: controller2.signal as any,
              } as any);
              if (retryRes.ok) {
                const buf3 = await retryRes.arrayBuffer();
                const byteLen3 = buf3 ? (buf3 as ArrayBuffer).byteLength : 0;
                if (byteLen3 >= 100) {
                  const headers = new Headers({ 'Content-Type': 'image/png', 'Cache-Control': `public, max-age=${Math.floor((process.env.SCREENSHOT_CACHE_TTL_MS ? Number(process.env.SCREENSHOT_CACHE_TTL_MS) : 60000)/1000)}` });
                  headers.set('Content-Disposition', `inline; filename="phieu-${slug}.png"`);
                  return new NextResponse(Buffer.from(buf3 as any), { status: 200, headers });
                }
              } else {
                const retryTxt = await retryRes.text().catch(() => '');
                try { console.error('Browserless retry responded with', retryRes.status, retryTxt && retryTxt.slice ? retryTxt.slice(0, 2000) : retryTxt); } catch {}
              }
            } catch (e: any) { try { console.error('Browserless auth-retry failed:', e && e.message ? e.message : e); } catch {} }
          }
          return NextResponse.json({ ok: false, error: 'BROWSERLESS_ERROR', status: res2.status, body: txt2 }, { status: 502 });
        }
        const buf2 = await res2.arrayBuffer();
        const byteLen2 = buf2 ? (buf2 as ArrayBuffer).byteLength : 0;
        if (byteLen2 < 100) {
          return NextResponse.json({ ok: false, error: 'EMPTY_IMAGE', bytes: byteLen2 }, { status: 502 });
        }
        const headers2 = new Headers({ 'Content-Type': 'image/png', 'Cache-Control': `public, max-age=${Math.floor((process.env.SCREENSHOT_CACHE_TTL_MS ? Number(process.env.SCREENSHOT_CACHE_TTL_MS) : 60000)/1000)}` });
        headers2.set('Content-Disposition', `inline; filename="phieu-${slug}.png"`);
        return new NextResponse(Buffer.from(buf2 as any), { status: 200, headers: headers2 });
      } catch (e: any) {
        clearTimeout(timer2);
        if (e && e.name === 'AbortError') {
          return NextResponse.json({ ok: false, error: 'TIMEOUT' }, { status: 504 });
        }
        return NextResponse.json({ ok: false, error: (e && e.message) ? e.message : 'FETCH_FAILED' }, { status: 500 });
      }
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
