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

    // For snapshot requests we use a small injected script so we can:
    // - wait for #print-ready to appear
    // - scroll it into view (so QR / dynamic content is rendered)
    // - then capture a full-page PNG
    // This is more reliable than the simple JSON payload when the page
    // needs a scroll / render step before a full-page screenshot.
    const code = `
      const page = await browser.newPage();
      await page.goto("${targetUrl}", { waitUntil: "networkidle2", timeout: ${timeoutMs} });

      // Wait for the #print-ready marker (but don't fail hard if missing)
      const readyEl = await page.waitForSelector("#print-ready", { timeout: ${Math.min(8000, timeoutMs)}, visible: true }).catch(() => null);
      if (readyEl) {
        await readyEl.evaluate(el => el.scrollIntoView({ behavior: "instant", block: "center" }));
        // small pause to let layout/images settle
        await new Promise(r => setTimeout(r, 600));
      }

      // Capture full page as PNG to preserve QR fidelity
      const buf = await page.screenshot({ fullPage: true, type: "png" });
      return buf;
    `;

    const payload = { code } as any;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs + 2000);
    // Determine cache TTL in seconds (optional env)
    const cacheTtlSec = Math.max(0, Math.floor(Number(process.env.SCREENSHOT_CACHE_TTL_MS || 0) / 1000));

    try {
      // First attempt: token in query param
      let res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      // If provider rejects with 401/403, retry with Authorization: Bearer <token>
      if (res.status === 401 || res.status === 403) {
        try {
          const authEndpoint = `${browserlessBase.replace(/\/\/+$/, '')}/screenshot`;
          const authRes = await fetch(authEndpoint, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          res = authRes;
          console.warn('Browserless: retried with Authorization header, status=', res.status);
        } catch (e) {
          console.error('Browserless auth-retry failed', e);
        }
      }

      const ct = res.headers.get('content-type') || '';
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('Browserless error', res.status, ct, body);
        return NextResponse.json({ error: 'BROWSERLESS_ERROR', details: body }, { status: 502 });
      }

      const buffer = await res.arrayBuffer();
      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          'content-type': ct,
          'cache-control': `public, max-age=${cacheTtlSec}`,
        },
      });
    } catch (err: any) {
      console.error('print-image error', err?.message || err);
      return NextResponse.json({ error: 'BROWSERLESS_FETCH_ERROR', details: String(err) }, { status: 502 });
    } finally {
      clearTimeout(timer);
      }

    } catch (err: any) {
      console.error('print-image top-level', err?.message || err);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR', details: String(err) }, { status: 500 });
    }
    }
