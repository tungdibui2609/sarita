// Simple Browserless screenshot test script
// Usage:
//   BROWSERLESS_URL=https://production-sfo.browserless.io BROWSERLESS_TOKEN=... node scripts/browserless-screenshot.js "https://example.com" out.png

const fs = require('fs');

async function main() {
  const argv = process.argv.slice(2);
  const target = argv[0];
  const out = argv[1] || 'screenshot.png';
  if (!target) {
    console.error('Usage: node scripts/browserless-screenshot.js <url> [out.png]');
    process.exit(2);
  }

  const BROWSERLESS_URL = process.env.BROWSERLESS_URL || process.env.BROWSERLESS_API_URL || 'https://production-sfo.browserless.io';
  const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN || process.env.BROWSERLESS_API_KEY;
  if (!BROWSERLESS_TOKEN) {
    console.error('Missing BROWSERLESS_TOKEN environment variable.');
    process.exit(3);
  }

  const timeoutMs = Number(process.env.SCREENSHOT_TIMEOUT_MS || 30000);
  const base = String(BROWSERLESS_URL).replace(/\/+$/g, '');
  const endpoint = `${base}/screenshot?token=${encodeURIComponent(BROWSERLESS_TOKEN)}&timeout=${encodeURIComponent(String(timeoutMs))}`;

  const payload = {
    url: target,
    gotoOptions: { timeout: timeoutMs, waitUntil: 'networkidle2' },
    // If your page includes an explicit readiness marker (#print-ready) the script will wait for it
    waitForSelector: { selector: '#print-ready', timeout: Math.min(5000, timeoutMs), visible: true },
    bestAttempt: true
  };

  // Node 18+ has global fetch; fall back to node-fetch if not available
  let fetchFn = global.fetch;
  if (!fetchFn) {
    try {
      // eslint-disable-next-line node/no-extraneous-require
      fetchFn = require('node-fetch');
    } catch (e) {
      console.error('No global fetch and node-fetch not installed. Use Node 18+ or install node-fetch.');
      process.exit(4);
    }
  }

  console.log('POST', endpoint);
  console.log('payload', JSON.stringify(payload, null, 2));

  const res = await fetchFn(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    // allow aborts via env-driven timeout if you want; Browserless will also enforce timeout
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '<no body>');
    console.error('Browserless returned error', res.status, txt);
    process.exit(5);
  }

  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  fs.writeFileSync(out, buf);
  console.log('Saved', out, 'bytes=', buf.length);
}

main().catch((err) => {
  console.error('Unexpected error', err && err.stack ? err.stack : err);
  process.exit(99);
});
