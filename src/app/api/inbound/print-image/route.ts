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
    if (!code) return new Response(JSON.stringify({ ok: false, error: "MISSING_CODE" }), { status: 400 });

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
    const printUrl = `${base.replace(/\/$/, "")}/xhd/${encodeURIComponent(code)}`;

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

        // Always POST a minimal payload { url } to Browserless
        const cacheKeyUrl = `${cacheKey}::url`;
        const reqPromise = (async () => {
          const payload = { url: printUrl };
          const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!r.ok) {
            const txt = await r.text().catch(() => '');
            throw new Error(`Browserless(url) ${r.status}: ${txt}`);
          }
          const arrBuf = await r.arrayBuffer();
          try { screenshotCache.set(cacheKeyUrl, { expires: Date.now() + CACHE_TTL_MS, buffer: arrBuf }); } catch (e) {}
          return arrBuf;
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
