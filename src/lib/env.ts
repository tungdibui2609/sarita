// Utility helpers for environment variables
export function ensureGoogleKeyFromB64() {
  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64 && !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64, 'base64').toString('utf8');
    }
  } catch (e) {
    // ignore decoding errors; callers will validate presence of key
    void e;
  }
}

export default {} as any;
