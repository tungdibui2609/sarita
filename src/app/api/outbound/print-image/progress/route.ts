import { NextResponse } from 'next/server';

// Dev-only simulated progress endpoint for outbound screenshot

type ProgressMap = Record<string, number>;
const progressMap: ProgressMap = {};

export function GET(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug') || '__default__';
    const cur = progressMap[slug] ?? 0;
    const step = Math.min(100 - cur, Math.floor(Math.random() * 20) + 5);
    const next = Math.min(100, cur + (step > 0 ? step : 0));
    progressMap[slug] = next;
    return NextResponse.json({ progress: next });
  } catch (e) {
    return new NextResponse(null, { status: 500 });
  }
}
