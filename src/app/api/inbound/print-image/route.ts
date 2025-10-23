export async function GET() {
  return new Response(JSON.stringify({ ok: false, error: 'print-image API disabled' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
}
