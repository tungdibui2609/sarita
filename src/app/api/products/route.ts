import { NextResponse } from "next/server";
import { PRODUCTS_SHEET_RANGE, USER_SHEET_ID, PRODUCTS_GROUPS_RANGE, PRODUCTS_UOMS_RANGE, PRODUCTS_DISABLED_CODES_RANGE } from "@/config/sheets";
import { listProductsFromSheet, appendProductToSheet, updateProductAtRow, ensureValueInColumn, listDisabledCodes, disableCode, restoreCode } from "@/lib/googleSheets";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const includeDisabled = searchParams.get("includeDisabled");
    const [products, disabled] = await Promise.all([
      listProductsFromSheet(USER_SHEET_ID, PRODUCTS_SHEET_RANGE),
      listDisabledCodes(USER_SHEET_ID, PRODUCTS_DISABLED_CODES_RANGE).catch(() => [] as string[]),
    ]);
    const disabledSet = new Set(disabled.map((c) => c.toLowerCase()));
    if (includeDisabled) {
      const merged = products.map((p: any) => ({ ...p, disabled: disabledSet.has((p.code || "").toLowerCase()) }));
      return NextResponse.json({ ok: true, products: merged });
    }
    const visible = products.filter((p: any) => !disabledSet.has((p.code || "").toLowerCase()));
    return NextResponse.json({ ok: true, products: visible });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi không xác định" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
  const body = await req.json();
  const { code, name, group, uomSmall, uomMedium, uomLarge, ratioSmallToMedium, ratioMediumToLarge, spec, description, imageUrl, imageUrl2, imageUrl3 } = body || {};
    if (!code || !name) return NextResponse.json({ ok: false, error: "Thiếu code hoặc name" }, { status: 400 });
    await appendProductToSheet(USER_SHEET_ID, PRODUCTS_SHEET_RANGE, {
      code, name, group, uomSmall, uomMedium, uomLarge, ratioSmallToMedium, ratioMediumToLarge, spec, description, imageUrl, imageUrl2, imageUrl3,
    });
    if (group) { try { await ensureValueInColumn(USER_SHEET_ID, PRODUCTS_GROUPS_RANGE, group); } catch {} }
    for (const u of [uomSmall, uomMedium, uomLarge]) { if (u) { try { await ensureValueInColumn(USER_SHEET_ID, PRODUCTS_UOMS_RANGE, u); } catch {} } }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi không xác định" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
  const body = await req.json();
  const { rowIndex, ...updates } = body || {};
    if (!rowIndex || typeof rowIndex !== "number") return NextResponse.json({ ok: false, error: "Thiếu rowIndex" }, { status: 400 });
  await updateProductAtRow(USER_SHEET_ID, PRODUCTS_SHEET_RANGE, rowIndex, updates);
  const g = (updates as any)?.group;
  if (g) { try { await ensureValueInColumn(USER_SHEET_ID, PRODUCTS_GROUPS_RANGE, g); } catch {} }
  for (const u of [(updates as any)?.uomSmall, (updates as any)?.uomMedium, (updates as any)?.uomLarge]) { if (u) { try { await ensureValueInColumn(USER_SHEET_ID, PRODUCTS_UOMS_RANGE, u); } catch {} } }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi không xác định" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let code = (searchParams.get("code") || "").trim();
    if (!code) {
      try {
        const body = await req.json();
        code = (body?.code || "").toString().trim();
      } catch {}
    }
    if (!code) return NextResponse.json({ ok: false, error: "Thiếu code" }, { status: 400 });
    await disableCode(USER_SHEET_ID, PRODUCTS_DISABLED_CODES_RANGE, code);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi không xác định" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = (body?.code || "").toString().trim();
    const action = (body?.action || "").toString().trim().toLowerCase();
    if (!code) return NextResponse.json({ ok: false, error: "Thiếu code" }, { status: 400 });
    if (action && action !== "restore") return NextResponse.json({ ok: false, error: "Hành động không hợp lệ" }, { status: 400 });
    await restoreCode(USER_SHEET_ID, PRODUCTS_DISABLED_CODES_RANGE, code);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi không xác định" }, { status: 500 });
  }
}
