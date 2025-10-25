import { NextResponse } from 'next/server';

// Dev-only simulated progress endpoint. Returns 404 outside development.
// This helps UI testing so the client can poll and show a progress bar.

type ProgressMap = Record<string, number>;
const progressMap: ProgressMap = {};

export function GET(req: Request) {
  // Only available in development to avoid exposing test behavior in prod.
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug') || '__default__';
    const cur = progressMap[slug] ?? 0;
    // Advance progress by a random step so UI shows movement.
    const step = Math.min(100 - cur, Math.floor(Math.random() * 20) + 5);
    const next = Math.min(100, cur + (step > 0 ? step : 0));
    progressMap[slug] = next;

    // If reached 100, keep it at 100 for subsequent requests.
    return NextResponse.json({ progress: next });
  } catch (e) {
    return new NextResponse(null, { status: 500 });
  }
}
