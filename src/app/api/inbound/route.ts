import { NextResponse } from "next/server";
import { INBOUND_SHEET_RANGE, USER_SHEET_ID, INBOUND_LOG_SHEET_RANGE, LINK_PHIEUNHAP_SHEET_RANGE } from "@/config/sheets";
import { getSheetRows } from "@/lib/googleSheets";
import { google } from "googleapis";
import { ensureGoogleKeyFromB64 } from "@/lib/env";

ensureGoogleKeyFromB64();

type InboundRow = {
  code: string; // mã phiếu (A)
  date: string; // ngày nhập (B)
  time?: string; // giờ (C)
  warehouse?: string; // kho (D)
  productCode: string; // E
  productName?: string; // F
  qty: number; // G
  uom?: string; // H
  user?: string; // I
  description?: string; // J - diễn giải
  memo?: string; // K - ghi chú
  source?: string; // L - nguồn dữ liệu
  receiver?: string; // M - người nhận (mới)
  slug?: string; // N - link slug
};

export async function GET() {
  try {
    const rows = await getSheetRows(USER_SHEET_ID, INBOUND_SHEET_RANGE);
    if (!rows.length) return NextResponse.json({ ok: true, docs: [] });
  const [, ...data] = rows;

    // Map header indices safely (fallback to fixed columns if needed)
  const idxA = 0; // mã phiếu
  const idxB = 1; // ngày
  const idxC = 2; // giờ
    const idxD = 3; // kho
    const idxE = 4; // mã SP
    const idxF = 5; // tên SP
    const idxG = 6; // số lượng
    const idxH = 7; // đvt
    const idxI = 8; // người nhập
    const idxJ = 9; // diễn giải
  const idxK = 10; // ghi chú
  const idxL = 11; // nguồn dữ liệu
  const idxM = 12; // người nhận (có thể trống ở dữ liệu cũ)
  const idxN = 13; // link slug

  const items: InboundRow[] = [];
    for (const r of data) {
      const code = (r[idxA] || "").toString().trim();
      const date = (r[idxB] || "").toString().trim();
      if (!code || !date) continue; // bỏ dòng trống/không hợp lệ
      const qtyNum = Number((r[idxG] || "").toString().replace(/,/g, "."));
      items.push({
        code,
        date, // giữ nguyên chuỗi ngày như trong sheet (10/10/2025)
        time: (r[idxC] || "").toString().trim(),
        warehouse: (r[idxD] || "").toString().trim(),
        productCode: (r[idxE] || "").toString().trim(),
        productName: (r[idxF] || "").toString().trim(),
        qty: Number.isFinite(qtyNum) ? qtyNum : 0,
        uom: (r[idxH] || "").toString().trim(),
        user: (r[idxI] || "").toString().trim(),
        description: (r[idxJ] || "").toString().trim(),
        memo: (r[idxK] || "").toString().trim(),
        source: (r[idxL] || "").toString().trim(),
        receiver: (r[idxM] || "").toString().trim(),
        slug: (r[idxN] || "").toString().trim(),
      });
    }

    // Load slug mapping from link sheet to avoid relying on column N
    const slugMap: Record<string, string> = {};
    try {
      const rowsLink = await getSheetRows(USER_SHEET_ID, LINK_PHIEUNHAP_SHEET_RANGE);
      const [, ...linkData] = rowsLink;
      for (const r of linkData) {
        const c = (r?.[0] || "").toString().trim();
        const s = (r?.[1] || "").toString().trim();
        if (c) slugMap[c] = s;
      }
  } catch { /* ignore link read errors */ }

    // Aggregate/group by doc code
    const map = new Map<string, any>();
    for (const it of items) {
      const key = it.code;
      const cur = map.get(key);
      const line = {
        productCode: it.productCode,
        productName: it.productName,
        unit: it.uom,
        qty: it.qty,
        memo: it.memo || "",
      };
      if (!cur) {
        map.set(key, {
          code: it.code,
          date: it.date,
          time: it.time,
          warehouse: it.warehouse,
          description: it.description || "",
          source: it.source || "",
          lines: [line],
          items: 1,
          quantity: it.qty,
          createdBy: it.user || "",
          receiver: it.receiver || "",
          slug: slugMap[it.code] || it.slug || "",
        });
      } else {
        cur.lines.push(line);
        cur.items += 1;
        cur.quantity += it.qty;
        if (!cur.source && it.source) cur.source = it.source;
        if (!cur.receiver && it.receiver) cur.receiver = it.receiver;
        if (!cur.slug && (slugMap[it.code] || it.slug)) cur.slug = slugMap[it.code] || it.slug;
      }
    }

    const docs = Array.from(map.values()).sort((a, b) => b.code.localeCompare(a.code));
    return NextResponse.json({ ok: true, docs });
  } catch (e: any) {
    // Log server-side and return sanitized message
    try { console.error("/api/inbound GET error:", e); } catch {}
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

function toDDMMYYYY(dateStr: string) {
  // dateStr is expected yyyy-mm-dd
  const [y, m, d] = (dateStr || "").split("-");
  if (!y || !m || !d) return dateStr || "";
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function codePrefixFromDate(dateStr: string) {
  const [y, m, d] = (dateStr || "").split("-");
  if (!y || !m || !d) return "PNK";
  return `PNK${d.padStart(2, "0")}${m.padStart(2, "0")}${y.slice(-2)}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
  const date = (body?.date || "").toString().trim(); // yyyy-mm-dd
    const time = (body?.time || "").toString().trim(); // optional HH:mm
    const warehouse = (body?.warehouse || "").toString().trim();
  const createdBy = (body?.createdBy || body?.user || "").toString().trim();
  // Actor performing this request (prefer explicit user field sent by client)
  const actionUser = (body?.user || body?.createdBy || "").toString().trim();
    const receiver = (body?.receiver || body?.nguoiNhan || "").toString().trim();
  const description = (body?.description || body?.note || "").toString(); // prefer explicit description
  const memoHeader = (body?.memo || body?.remark || "").toString(); // header memo fallback (not preferred)
  const source = (body?.source || body?.dataSource || "").toString();
    const lines = Array.isArray(body?.lines) ? body.lines : [];
    if (!date) return NextResponse.json({ ok: false, error: "Thiếu ngày (date)" }, { status: 400 });
    if (!warehouse) return NextResponse.json({ ok: false, error: "Thiếu kho (warehouse)" }, { status: 400 });
    if (!lines.length) return NextResponse.json({ ok: false, error: "Phiếu không có dòng hàng hóa" }, { status: 400 });

    // Read existing rows to compute next code for the date
    const rows = await getSheetRows(USER_SHEET_ID, INBOUND_SHEET_RANGE);
  const [, ...data] = rows;
  const idxA = 0, _idxB = 1; // code, date (idxB not used in this block)
    const prefix = codePrefixFromDate(date);
    let maxSeq = 0;
    for (const r of data) {
      const code = (r[idxA] || "").toString().trim();
      if (!code.startsWith(prefix)) continue;
      const tail = code.slice(prefix.length);
      const m = tail.match(/^(\d{1,3})$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n)) maxSeq = Math.max(maxSeq, n);
      }
    }
    const next = maxSeq + 1;
    const suffix = String(next).padStart(2, "0");
    const code = prefix + suffix;

    // Generate a random slug for column N (link). Keep simple alphanumeric base62, length 12
    function randomSlug(len = 12) {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let s = "";
      for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
      return s;
    }
    const slug = randomSlug(12);

    // Prepare rows to append: one per line
    const ddmmyyyy = toDDMMYYYY(date);
    const hhmm = time || new Date().toTimeString().slice(0, 5);
  const values: any[] = [];
  for (const l of lines) {
      const prodStr = ((l?.product || l?.name || "") as string).toString();
      let productCode = (l?.code || "").toString().trim();
      let productName = (l?.productName || "").toString().trim();
      if (!productCode || !productName) {
        const parts = prodStr.split(" - ");
        if (parts.length >= 2) {
          if (!productCode) productCode = parts[0].trim();
          if (!productName) productName = parts.slice(1).join(" - ").trim();
        } else {
          // Fallback: treat whole string as name if cannot parse
          if (!productName) productName = prodStr.trim();
        }
      }
      const qtyNum = Number(l?.qty ?? 0) || 0;
      const uom = (l?.unit || l?.uom || "").toString().trim();
      // A..N: code, date, time, warehouse, productCode, productName, qty, uom, user, description(J), note(K), source(L), receiver(M), slug(N)
      const memoLine = (l?.memo || l?.note || memoHeader || "").toString();
      // Do not store slug in phieunhap column N anymore; keep empty and manage slugs in linkphieunhap
      values.push([code, ddmmyyyy, hhmm, warehouse, productCode, productName, qtyNum, uom, createdBy, description, memoLine, source, receiver, ""]);
    }

    // Append to sheet with write scope
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\n/g, "\n");
    if (!clientEmail || !privateKey) throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");
    const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    const sheets = google.sheets({ version: "v4", auth: jwt });
    const tabName = INBOUND_SHEET_RANGE.split("!")[0];
    await sheets.spreadsheets.values.append({
      spreadsheetId: USER_SHEET_ID,
      range: `${tabName}!A:N`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });

    // Persist slug into dedicated link sheet so edits won't remove it
    try {
      const { upsertLinkForCode, appendInboundVersion } = await import("@/lib/googleSheets");
      await upsertLinkForCode(USER_SHEET_ID, LINK_PHIEUNHAP_SHEET_RANGE, code, slug);
      // Append initial version (version 1) snapshot
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      const timestamp = `${hh}:${mm} - ${dd}/${mo}/${yyyy}`;
      const payloadDoc = {
        code,
        date,
        time: hhmm,
        warehouse,
        createdBy,
        receiver,
        description,
        lines: lines.map((l: any) => ({ productCode: l?.code || "", productName: l?.productName || l?.product || "", qty: Number(l?.qty || 0) || 0, unit: l?.unit || l?.uom || "", memo: l?.memo || l?.note || "" })),
      };
  await appendInboundVersion(USER_SHEET_ID, (await import("@/config/sheets")).INBOUND_VERSIONS_SHEET_RANGE, { code, version: 1, timestamp, user: actionUser || createdBy || "", data: JSON.stringify(payloadDoc), slug });
  } catch { /* ignore link save errors */ }

    // Append to log sheet
    try {
      const { appendInboundLog } = await import("@/lib/googleSheets");
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      const timestamp = `${hh}:${mm} - ${dd}/${mo}/${yyyy}`;
  const user = actionUser || createdBy || "";
  const action = "Tạo phiếu";
  const details = (body?.logEntry || "").toString();
  await appendInboundLog(USER_SHEET_ID, INBOUND_LOG_SHEET_RANGE, { code, timestamp, user, action, details, slug });
  } catch {
      // ignore logging errors
    }

    // Build response doc (aggregated)
    const respDoc = {
      code,
      date, // yyyy-mm-dd
      time: hhmm,
      warehouse,
      createdBy,
      receiver,
      description,
      lines: lines.map((l: any) => ({
        productCode: l?.code || (l?.product || "").toString().split(" - ")[0]?.trim() || "",
        productName: l?.productName || (l?.product || "").toString().split(" - ").slice(1).join(" - ").trim(),
        unit: l?.unit || l?.uom || "",
        qty: Number(l?.qty ?? 0) || 0,
        memo: (l?.memo || l?.note || "").toString(),
      })),
      items: lines.length,
      quantity: lines.reduce((s: number, l: any) => s + (Number(l?.qty ?? 0) || 0), 0),
      source,
      slug,
    };

    return NextResponse.json({ ok: true, doc: respDoc });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi không xác định" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = (body?.code || "").toString().trim();
    if (!code) return NextResponse.json({ ok: false, error: "Thiếu code" }, { status: 400 });
  // Use helper to delete all rows with this code
  const { deleteInboundRowsByCode, deleteLinkForCode } = await import("@/lib/googleSheets");
  const { USER_SHEET_ID, INBOUND_SHEET_RANGE } = await import("@/config/sheets");
  const res = await deleteInboundRowsByCode(USER_SHEET_ID, INBOUND_SHEET_RANGE, code);
  // Also remove mapping from link sheet
  try { await deleteLinkForCode(USER_SHEET_ID, LINK_PHIEUNHAP_SHEET_RANGE, code); } catch { /* ignore */ }
    return NextResponse.json({ ok: true, result: res });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi không xác định" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const code = (body?.code || "").toString().trim();
    if (!code) return NextResponse.json({ ok: false, error: "Thiếu code" }, { status: 400 });
    const date = (body?.date || "").toString().trim(); // yyyy-mm-dd
    const time = (body?.time || "").toString().trim();
    const warehouse = (body?.warehouse || "").toString().trim();
  const createdBy = (body?.createdBy || body?.user || "").toString().trim();
  // Actor performing this request (prefer explicit user field sent by client)
  const actionUser = (body?.user || body?.createdBy || "").toString().trim();
    const receiver = (body?.receiver || body?.nguoiNhan || "").toString().trim();
    const description = (body?.description || body?.note || "").toString();
    const source = (body?.source || "").toString();
    const lines = Array.isArray(body?.lines) ? body.lines : [];
    const logEntry = (body?.logEntry || "").toString();

    if (!lines.length) return NextResponse.json({ ok: false, error: "Phiếu không có dòng hàng" }, { status: 400 });

  const { updateInboundRowsInPlace, appendInboundLog, getLinkForCode } = await import("@/lib/googleSheets");
  const { USER_SHEET_ID, INBOUND_SHEET_RANGE, INBOUND_LOG_SHEET_RANGE, LINK_PHIEUNHAP_SHEET_RANGE } = await import("@/config/sheets");

  // Try to retrieve existing slug mapping so we preserve it
  let preservedSlug: string | null = null;
  try { preservedSlug = await getLinkForCode(USER_SHEET_ID, LINK_PHIEUNHAP_SHEET_RANGE, code); } catch { preservedSlug = null; }

    // Build newRows in A..N format
    function toDDMMYYYY_local(dateStr: string) {
      const [y, m, d] = (dateStr || "").split("-");
      if (!y || !m || !d) return dateStr || "";
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    }
    const ddmmyyyy = toDDMMYYYY_local(date);
    const hhmm = time || new Date().toTimeString().slice(0, 5);
    const newRows: any[][] = [];
    for (const l of lines) {
      const prodStr = ((l?.product || l?.name || "") as string).toString();
      let productCode = (l?.code || "").toString().trim();
      let productName = (l?.productName || "").toString().trim();
      if (!productCode || !productName) {
        const parts = prodStr.split(" - ");
        if (parts.length >= 2) {
          if (!productCode) productCode = parts[0].trim();
          if (!productName) productName = parts.slice(1).join(" - ").trim();
        } else {
          if (!productName) productName = prodStr.trim();
        }
      }
      const qtyNum = Number(l?.qty ?? 0) || 0;
      const uom = (l?.unit || l?.uom || "").toString().trim();
      const memoLine = (l?.memo || l?.note || "").toString();
      // Do not write slug into phieunhap; preserve link in linkphieunhap only
      newRows.push([code, ddmmyyyy, hhmm, warehouse, productCode, productName, qtyNum, uom, createdBy, description, memoLine, source, receiver, ""]);
    }

    // Read existing rows for this code to build a detailed diff
    const allRows = await getSheetRows(USER_SHEET_ID, INBOUND_SHEET_RANGE);
    const [, ...allData] = allRows;
    const existingRows = allData.filter((r: any[]) => ((r?.[0] || "").toString().trim() === code));

    // Helper: convert dd/mm/yyyy -> yyyy-mm-dd
    function ddmmyyyyToYYYY(s: string) {
      if (!s) return s;
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!m) return s;
      const dd = m[1].padStart(2, '0');
      const mo = m[2].padStart(2, '0');
      const yyyy = m[3];
      return `${yyyy}-${mo}-${dd}`;
    }

    // Build old header fields and lines
    const oldHeader = existingRows[0] || [];
    const old = {
      date: ddmmyyyyToYYYY((oldHeader[1] || "").toString().trim()),
      warehouse: (oldHeader[3] || "").toString().trim(),
      receiver: (oldHeader[12] || "").toString().trim(),
      description: (oldHeader[9] || "").toString().trim(),
    };
    const oldLines = existingRows.map((r: any[]) => ({
      productCode: (r[4] || "").toString().trim(),
      productName: (r[5] || "").toString().trim(),
      qty: Number((r[6] || 0)),
      uom: (r[7] || "").toString().trim(),
      memo: (r[10] || "").toString().trim(),
    }));

    // Build newLines structure for comparison
    const newLines = lines.map((l: any) => ({
      productCode: (l?.code || "").toString().trim(),
      productName: (l?.productName || (l?.product || "")).toString().split(' - ').slice(1).join(' - ').trim() || (l?.product || "").toString().trim(),
      qty: Number(l?.qty || 0),
      uom: (l?.unit || l?.uom || "").toString().trim(),
      memo: (l?.memo || l?.note || "").toString().trim(),
    }));

    // Compute detailed diffs
    const diffs: string[] = [];
    if ((old.date || '') !== (date || '')) diffs.push(`Ngày: "${old.date || ''}" => "${date || ''}"`);
    if ((old.warehouse || '') !== (warehouse || '')) diffs.push(`Kho: "${old.warehouse || ''}" => "${warehouse || ''}"`);
    if ((old.receiver || '') !== (receiver || '')) diffs.push(`Người nhận: "${old.receiver || ''}" => "${receiver || ''}"`);
    if ((old.description || '') !== (description || '')) diffs.push(`Diễn giải: "${old.description || ''}" => "${description || ''}"`);

    const maxLines = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLines; i++) {
      const o = oldLines[i];
      const n = newLines[i];
      const idx = i + 1;
      if (!o && n) {
        diffs.push(`Dòng ${idx}: Thêm -> ${n.productCode} | ${n.productName} | ${n.qty} ${n.uom}`);
        continue;
      }
      if (o && !n) {
        diffs.push(`Dòng ${idx}: Xóa -> ${o.productCode} | ${o.productName} | ${o.qty} ${o.uom}`);
        continue;
      }
      // both exist, compare fields
      const parts: string[] = [];
      if ((o.productCode || '') !== (n.productCode || '')) parts.push(`Mã: "${o.productCode}"=>"${n.productCode}"`);
      if ((o.productName || '') !== (n.productName || '')) parts.push(`Tên: "${o.productName}"=>"${n.productName}"`);
      if ((o.qty || 0) !== (n.qty || 0)) parts.push(`SL: ${o.qty}=>${n.qty}`);
      if ((o.uom || '') !== (n.uom || '')) parts.push(`ĐVT: "${o.uom}"=>"${n.uom}"`);
      if ((o.memo || '') !== (n.memo || '')) parts.push(`Ghi chú`);
      if (parts.length) diffs.push(`Dòng ${idx}: ${parts.join('; ')}`);
    }

    const details = diffs.length ? diffs.join(' \n') : (logEntry || 'Cập nhật phiếu');

    // Perform in-place update (overwrite existing rows, insert/delete as needed)
    const result = await updateInboundRowsInPlace(USER_SHEET_ID, INBOUND_SHEET_RANGE, code, newRows);

    // Perform in-place update (overwrite existing rows, insert/delete as needed)
    try {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
    const timestamp = `${hh}:${mm} - ${dd}/${mo}/${yyyy}`;
  const user = actionUser || createdBy || "";
  const action = "Cập nhật phiếu";
  await appendInboundLog(USER_SHEET_ID, INBOUND_LOG_SHEET_RANGE, { code, timestamp, user, action, details, slug: preservedSlug || "" });
  } catch { /* ignore log errors */ }

    // Persist slug mapping (ensure slug remains available) and append version snapshot
    try {
      const { upsertLinkForCode, appendInboundVersion, getInboundVersions } = await import("@/lib/googleSheets");
      if (preservedSlug) await upsertLinkForCode(USER_SHEET_ID, LINK_PHIEUNHAP_SHEET_RANGE, code, preservedSlug);
      // determine next version
      let nextVersion = 1;
      try {
        const versions = await getInboundVersions(USER_SHEET_ID, (await import("@/config/sheets")).INBOUND_VERSIONS_SHEET_RANGE, code);
        if (Array.isArray(versions) && versions.length) {
          const maxV = versions.reduce((m: number, v: any) => Math.max(m, Number(v.version || 0)), 0);
          nextVersion = maxV + 1;
        }
  } catch { nextVersion = 1; }

      const now2 = new Date();
      const hh2 = String(now2.getHours()).padStart(2, "0");
      const mm2 = String(now2.getMinutes()).padStart(2, "0");
      const dd2 = String(now2.getDate()).padStart(2, "0");
      const mo2 = String(now2.getMonth() + 1).padStart(2, "0");
      const yyyy2 = now2.getFullYear();
      const timestamp2 = `${hh2}:${mm2} - ${dd2}/${mo2}/${yyyy2}`;
      const snapshot = { code, date, time: hhmm, warehouse, createdBy, receiver, description, lines: newRows.map((r) => ({ productCode: r[4], productName: r[5], qty: Number(r[6] || 0), unit: r[7], memo: r[10] })) };
    // include preserved slug (if any) so versions sheet also records the link
    await appendInboundVersion(USER_SHEET_ID, (await import("@/config/sheets")).INBOUND_VERSIONS_SHEET_RANGE, { code, version: nextVersion, timestamp: timestamp2, user: actionUser || createdBy || "", data: JSON.stringify(snapshot), slug: preservedSlug || "" });
  } catch { /* ignore */ }

    return NextResponse.json({ ok: true, updatedRows: newRows.length, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi không xác định" }, { status: 500 });
  }
}
