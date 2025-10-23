import { NextRequest } from "next/server";
import { PRODUCTS_SHEET_RANGE, USER_SHEET_ID } from "@/config/sheets";
import { listProductsFromSheet, type Product } from "@/lib/googleSheets";

export const runtime = "nodejs";

function deriveKgPerUnit(p: Product): number {
  const specNum = parseFloat(((p as any).spec || "").replace(/[^0-9.]/g, ""));
  const r1 = parseFloat(((p as any).ratioSmallToMedium || "").toString());
  const r2 = parseFloat(((p as any).ratioMediumToLarge || "").toString());
  if (!isNaN(specNum) && specNum > 0) return specNum;
  if (!isNaN(r1) && r1 > 0) return r1;
  if (!isNaN(r2) && r2 > 0) return r2;
  return 0;
}

export async function GET(_req: NextRequest) {
  try {
    const products = await listProductsFromSheet(USER_SHEET_ID, PRODUCTS_SHEET_RANGE);
    const ratios: Record<string, number> = {};
    for (const p of products) {
      const code = (p.code || "").trim();
      if (!code) continue;
      const kgPerUnit = deriveKgPerUnit(p);
      ratios[code] = kgPerUnit || 0;
    }
    return new Response(JSON.stringify({ ok: true, ratios, count: Object.keys(ratios).length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "LOAD_RATIOS_FAILED" }), { status: 500 });
  }
}
