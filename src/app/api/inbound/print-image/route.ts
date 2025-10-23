import { NextRequest } from "next/server";
export const runtime = "nodejs";

// Simple in-memory cache and in-flight dedupe to avoid sending duplicate screenshot
// requests to Browserless. Keyed by the print URL + view. TTL is configurable via
// SCREENSHOT_CACHE_TTL_MS (defaults to 60s).
const screenshotCache = new Map<string, { expires: number; buffer: ArrayBuffer }>();
const inflightScreenshots = new Map<string, Promise<ArrayBuffer>>();
const CACHE_TTL_MS = Number(process.env.SCREENSHOT_CACHE_TTL_MS || 60000);

// Strategy: we already have a printable HTML page at /print/inbound?code=...
// We'll spin up a headless Chromium (Puppeteer), navigate to that URL, and take a full-page PNG screenshot.
// This avoids Excel->image conversion complexity while keeping the visual aligned with our print layout.

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").trim();
  const view = (searchParams.get("view") || searchParams.get("inline") || "").toString();
  const explicitUrl = (searchParams.get("url") || "").trim();
  if (!code && !explicitUrl) return new Response(JSON.stringify({ ok: false, error: "MISSING_CODE_OR_URL" }), { status: 400 });

    // Resolve absolute URL to the print page robustly
    const envBase = process.env.PRINT_BASE || "";
    const forwardedProto = req.headers.get("x-forwarded-proto");
    const forwardedHost = req.headers.get("x-forwarded-host");
    const host = req.headers.get("host");
    let base = envBase ? envBase.replace(/\/$/, "") : (forwardedHost
      ? `${forwardedProto || "https"}://${forwardedHost}`
      : (req as any).nextUrl?.origin || (host ? `http://${host}` : "http://localhost:3000"));
    try {
      const lower = (host || "").toLowerCase();
      if (!envBase && lower.includes("devtunnels.ms")) base = "http://localhost:3000";
    } catch {}
  const printUrl = code ? `${base.replace(/\/$/, "")}/xhd/${encodeURIComponent(code)}` : null;

    // Try Browserless Cloud first (configured via env). If not configured, fall back to Puppeteer.
    let browserlessBase = (process.env.BROWSERLESS_URL || "").trim();
    const browserlessToken = (process.env.BROWSERLESS_TOKEN || process.env.BROWSERLESS_API_KEY || "").trim();
    // If token present but no base set, default to Browserless Cloud production endpoint
    if (!browserlessBase && browserlessToken) browserlessBase = "https://production-sfo.browserless.io";
    // Map legacy host to current production endpoint (common mistake)
    try {
      const lb = browserlessBase.toLowerCase();
      if (lb.includes("chrome.browserless.io") || lb.includes("browserless.io") && lb.includes("chrome.")) {
        console.warn('[print-image] Detected legacy Browserless host; rewriting to https://production-sfo.browserless.io');
        browserlessBase = "https://production-sfo.browserless.io";
      }
    } catch {}

    if (browserlessBase && browserlessToken) {
      try {
        const endpoint = `${browserlessBase.replace(/\/+$/, "")}/screenshot?token=${encodeURIComponent(browserlessToken)}`;

    const cacheKey = `${printUrl}::${view}`;
        // Return cached image if not expired
        const now = Date.now();
        const cached = screenshotCache.get(cacheKey);
        if (cached && cached.expires > now) {
          const buf = cached.buffer;
          const disposition = view ? "inline" : "attachment";
          const resHeaders = new Headers({ "Content-Type": "image/png", "Content-Disposition": `${disposition}; filename="phieu-nhap-${code}.png"`, "Cache-Control": `public, max-age=${Math.floor(CACHE_TTL_MS/1000)}` });
          return new Response(buf, { status: 200, headers: resHeaders });
        }

        // If an identical request is already in-flight, wait for it instead of firing another to Browserless
        if (inflightScreenshots.has(cacheKey)) {
          const inBuf = await inflightScreenshots.get(cacheKey)!;
          const disposition = view ? "inline" : "attachment";
          const resHeaders = new Headers({ "Content-Type": "image/png", "Content-Disposition": `${disposition}; filename="phieu-nhap-${code}.png"`, "Cache-Control": `public, max-age=${Math.floor(CACHE_TTL_MS/1000)}` });
          return new Response(inBuf, { status: 200, headers: resHeaders });
        }

        // Determine the screenshot target. If an explicit `url` query param was provided, use it verbatim.
        // Otherwise use the generated printUrl and append ?preview=1 to avoid triggering print dialogs.
        const screenshotUrl = explicitUrl
          ? explicitUrl
          : (printUrl + (printUrl!.includes('?') ? '&preview=1' : '?preview=1'));
        const cacheKeyUrl = `${cacheKey}::url::${screenshotUrl}`;
        const reqPromise = (async () => {
          const payload = { url: screenshotUrl };
          const timeoutMs = Number(process.env.SCREENSHOT_TIMEOUT_MS || 30000);
          const maxAttempts = Number(process.env.SCREENSHOT_RETRIES || 3);
          const minBytes = Number(process.env.SCREENSHOT_MIN_BYTES || 5000);
          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            console.log(`[print-image] Browserless attempt ${attempt}/${maxAttempts} url=${screenshotUrl} timeout=${timeoutMs}ms`);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
              const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal } as any);
              clearTimeout(timer);
              if (!r.ok) {
                const txt = await r.text().catch(() => '');
                console.error('[print-image] Browserless returned non-OK:', r.status, txt);
                // if last attempt, throw, else retry
                if (attempt === maxAttempts) throw new Error(`Browserless(url) ${r.status}: ${txt}`);
                await new Promise(res => setTimeout(res, attempt * 1000));
                continue;
              }
              const arrBuf = await r.arrayBuffer();
              const byteLen = (arrBuf && (arrBuf as ArrayBuffer).byteLength) || 0;
              console.log('[print-image] Browserless returned bytes=', byteLen);
              if (byteLen < minBytes) {
                console.warn(`[print-image] Screenshot too small (${byteLen} bytes) - likely blank. Attempt ${attempt}/${maxAttempts}`);
                if (attempt === maxAttempts) {
                  try { screenshotCache.set(cacheKeyUrl, { expires: Date.now() + CACHE_TTL_MS, buffer: arrBuf }); } catch (e) {}
                  return arrBuf;
                }
                // delay before retrying
                await new Promise(res => setTimeout(res, attempt * 1000 + 500));
                continue;
              }
              try { screenshotCache.set(cacheKeyUrl, { expires: Date.now() + CACHE_TTL_MS, buffer: arrBuf }); } catch (e) {}
              return arrBuf;
            } catch (err: any) {
              clearTimeout(timer);
              if (err && err.name === 'AbortError') {
                console.error('[print-image] Browserless request aborted due to timeout');
                if (attempt === maxAttempts) throw new Error(`Browserless(url) timeout after ${timeoutMs}ms`);
                await new Promise(res => setTimeout(res, attempt * 1000));
                continue;
              }
              console.error('[print-image] Browserless request error:', err?.message || err);
              if (attempt === maxAttempts) throw err;
              await new Promise(res => setTimeout(res, attempt * 1000));
            }
          }
          // If we reach here, all { url } attempts failed or returned too-small images.
          // As a robust fallback, try fetching the target page HTML server-side and POST { html, url }
          // to Browserless in case the service cannot reach the public URL directly (dev tunnels, auth, etc.).
          try {
            console.warn('[print-image] Falling back to HTML-post strategy (fetching page HTML and sending to Browserless)');
            const fetchTimeout = Math.min(10000, timeoutMs);
            const fc = new AbortController();
            const ft = setTimeout(() => fc.abort(), fetchTimeout);
            let html = null as string | null;
            try {
              const r = await fetch(screenshotUrl, { signal: fc.signal } as any);
              clearTimeout(ft);
              if (r.ok) {
                html = await r.text();
              } else {
                console.warn('[print-image] Fetching preview HTML returned non-OK', r.status);
              }
            } catch (e) {
              clearTimeout(ft);
              console.warn('[print-image] Error fetching preview HTML:', (e as any)?.message || e);
            }
            if (html) {
              const htmlPayload: any = { html, url: screenshotUrl };
              try {
                const controller2 = new AbortController();
                const timer2 = setTimeout(() => controller2.abort(), timeoutMs);
                const r2 = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(htmlPayload), signal: controller2.signal } as any);
                clearTimeout(timer2);
                if (!r2.ok) {
                  const txt = await r2.text().catch(() => '');
                  console.error('[print-image] Browserless (html) returned non-OK:', r2.status, txt);
                } else {
                  const arrBuf2 = await r2.arrayBuffer();
                  const byteLen2 = (arrBuf2 && (arrBuf2 as ArrayBuffer).byteLength) || 0;
                  console.log('[print-image] Browserless(html) returned bytes=', byteLen2);
                  if (byteLen2 >= minBytes) {
                    try { screenshotCache.set(cacheKeyUrl, { expires: Date.now() + CACHE_TTL_MS, buffer: arrBuf2 }); } catch (e) {}
                    return arrBuf2;
                  } else {
                    console.warn('[print-image] Browserless(html) returned too-small image', byteLen2);
                  }
                }
              } catch (errHtml: any) {
                console.error('[print-image] Browserless(html) request error:', errHtml?.message || errHtml);
              }
            }
          } catch (e) {
            console.error('[print-image] HTML-post fallback failed:', (e as any)?.message || e);
          }
          throw new Error('Browserless: all attempts failed');
        })();

        inflightScreenshots.set(cacheKey, reqPromise);
        try {
          const bufArr = await reqPromise;
          const disposition = view ? "inline" : "attachment";
          const resHeaders = new Headers({ "Content-Type": "image/png", "Content-Disposition": `${disposition}; filename="phieu-nhap-${code}.png"`, "Cache-Control": `public, max-age=${Math.floor(CACHE_TTL_MS/1000)}` });
          return new Response(bufArr, { status: 200, headers: resHeaders });
        } finally {
          inflightScreenshots.delete(cacheKey);
        }
      } catch (err) {
        // If Browserless fails, log and return an explicit 502 so callers know the external provider failed.
        console.error('[print-image] Browserless screenshot failed:', (err as any)?.stack || err);
  const e: any = err;
  const msg = (e && (e.message || String(e))) || 'BROWSERLESS_FAILED';
  const details = e?.stack ? String(e.stack) : undefined;
        return new Response(JSON.stringify({ ok: false, error: msg, details }), { status: 502, headers: { 'Content-Type': 'application/json' } });
      }
    }
  } catch (e: any) {
    console.error('[print-image] Unexpected error:', e?.stack || e);
    const msg = (e && (e.message || String(e))) || 'PRINT_IMAGE_FAILED';
    const details = e?.stack ? String(e.stack) : undefined;
    return new Response(JSON.stringify({ ok: false, error: msg, details }), { status: 500 });
  }
}
