import { NextRequest } from "next/server";
export const runtime = "nodejs";

/**
 * Lightweight example showing how to proxy a screenshot request to Browserless Cloud
 * - Reads BROWSERLESS_URL and BROWSERLESS_TOKEN from env
 * - Accepts POST JSON { url, html, width, height } or GET ?url=...
 * - Returns image/png (passes through the bytes from browserless)
 *
 * Notes:
 * - Replace BROWSERLESS_URL/BROWSERLESS_TOKEN with your provider values.
 * - This route is intentionally small and focused on clarity for integration.
 */
async function callBrowserless(url: string | undefined, html: string | undefined, width = 800, height = 600) {
  const base = process.env.BROWSERLESS_URL || "https://chrome.browserless.io";
  const token = process.env.BROWSERLESS_TOKEN || process.env.BROWSERLESS_API_KEY;
  if (!token) throw new Error("Missing BROWSERLESS_TOKEN in environment");

  const endpoint = `${base.replace(/\/+$/, "")}/screenshot?token=${encodeURIComponent(token)}`;

  const payload: any = { options: { format: "png", width: Number(width) || 800, height: Number(height) || 600, deviceScaleFactor: 2 } };
  if (url) payload.url = url;
  else if (html) payload.html = html;
  else throw new Error("Either url or html must be provided");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Browserless error ${res.status}: ${txt}`);
  }

  const buf = await res.arrayBuffer();
  return buf;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { url, html, width, height } = body || {};
    const buf = await callBrowserless(url, html, width ?? 800, height ?? 600);
    const headers = new Headers({ "Content-Type": "image/png", "Cache-Control": "no-cache" });
    return new Response(buf, { status: 200, headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

// Also support GET for quick tests: /api/screenshot/browserless?url=...&width=...&height=...
export async function GET(req: NextRequest) {
  try {
    const q = Object.fromEntries(req.nextUrl.searchParams.entries());
    const url = q.url as string | undefined;
    const width = q.width ? Number(q.width) : 800;
    const height = q.height ? Number(q.height) : 600;
    const buf = await callBrowserless(url, undefined, width, height);
    const headers = new Headers({ "Content-Type": "image/png", "Cache-Control": "no-cache" });
    return new Response(buf, { status: 200, headers });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
