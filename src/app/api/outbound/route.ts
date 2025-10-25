import { NextResponse } from "next/server";
import { USER_SHEET_ID, OUTBOUND_SHEET_RANGE, OUTBOUND_LOG_SHEET_RANGE, LINK_PHIEUXUAT_SHEET_RANGE, OUTBOUND_VERSIONS_SHEET_RANGE } from "@/config/sheets";
import { getSheetRows } from "@/lib/googleSheets";
import { google } from "googleapis";
import { ensureGoogleKeyFromB64 } from "@/lib/env";

ensureGoogleKeyFromB64();

type Row = {
  code: string; // A
  date: string; // B (dd/mm/yyyy)
  time?: string; // C
  warehouse?: string; // D
  productCode: string; // E
  productName?: string; // F
  qty: number; // G
  uom?: string; // H
  user?: string; // I (người lập)
  description?: string; // J - diễn giải
  memo?: string; // K - ghi chú
  source?: string; // L - nguồn dữ liệu
  receiver?: string; // M - người nhận
  slug?: string; // N - link slug (legacy, không dùng, dùng sheet linkphieuxuat)
};

export async function GET() {
  try {
    const rows = await getSheetRows(USER_SHEET_ID, OUTBOUND_SHEET_RANGE);
    if (!rows.length) return NextResponse.json({ ok: true, docs: [] });
    const [, ...data] = rows;

    const idxA = 0, idxB = 1, idxC = 2, idxD = 3, idxE = 4, idxF = 5, idxG = 6, idxH = 7, idxI = 8, idxJ = 9, idxK = 10, idxL = 11, idxM = 12, idxN = 13;

    const items: Row[] = [];
    for (const r of data) {
      const code = (r[idxA] || "").toString().trim();
      const date = (r[idxB] || "").toString().trim();
      if (!code || !date) continue;
      const qtyNum = Number((r[idxG] || "").toString().replace(/,/g, "."));
      items.push({
        code,
        date,
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

    // Load slug mapping from link sheet
    const slugMap: Record<string, string> = {};
    try {
      const rowsLink = await getSheetRows(USER_SHEET_ID, LINK_PHIEUXUAT_SHEET_RANGE);
      const [, ...linkData] = rowsLink;
      for (const r of linkData) {
        const c = (r?.[0] || "").toString().trim();
        const s = (r?.[1] || "").toString().trim();
        if (c) slugMap[c] = s;
      }
    } catch {}

    const map = new Map<string, any>();
    for (const it of items) {
      const key = it.code;
      const line = { productCode: it.productCode, productName: it.productName, unit: it.uom, qty: it.qty, memo: it.memo || "" };
      const cur = map.get(key);
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
    try { console.error("/api/outbound GET error:", e); } catch {}
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

function toDDMMYYYY(dateStr: string) {
  const [y, m, d] = (dateStr || "").split("-");
  if (!y || !m || !d) return dateStr || "";
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}
function codePrefixFromDate(dateStr: string) {
  const [y, m, d] = (dateStr || "").split("-");
  if (!y || !m || !d) return "PXK";
  return `PXK${d.padStart(2, "0")}${m.padStart(2, "0")}${y.slice(-2)}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const date = (body?.date || "").toString().trim();
    const time = (body?.time || "").toString().trim();
    const warehouse = (body?.warehouse || "").toString().trim();
    const createdBy = (body?.createdBy || body?.user || "").toString().trim();
    const actionUser = (body?.user || body?.createdBy || "").toString().trim();
    const receiver = (body?.receiver || body?.nguoiNhan || "").toString().trim();
    const description = (body?.description || body?.note || "").toString();
    const source = (body?.source || body?.dataSource || "").toString();
    const lines = Array.isArray(body?.lines) ? body.lines : [];
    if (!date) return NextResponse.json({ ok: false, error: "Thiếu ngày (date)" }, { status: 400 });
    if (!warehouse) return NextResponse.json({ ok: false, error: "Thiếu kho (warehouse)" }, { status: 400 });
    if (!lines.length) return NextResponse.json({ ok: false, error: "Phiếu không có dòng hàng hóa" }, { status: 400 });

    const rows = await getSheetRows(USER_SHEET_ID, OUTBOUND_SHEET_RANGE);
    const [, ...data] = rows;
    const prefix = codePrefixFromDate(date);
    let maxSeq = 0;
    for (const r of data) {
      const code = (r[0] || "").toString().trim();
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

    function randomSlug(len = 12) {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let s = "";
      for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
      return s;
    }
    const slug = randomSlug(12);

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
          if (!productName) productName = prodStr.trim();
        }
      }
      const qtyNum = Number(l?.qty ?? 0) || 0;
      const uom = (l?.unit || l?.uom || "").toString().trim();
      const memoLine = (l?.memo || l?.note || "").toString();
      // A..N same as inbound, keep slug column empty (use link sheet instead)
      values.push([code, ddmmyyyy, hhmm, warehouse, productCode, productName, qtyNum, uom, createdBy, description, memoLine, source, receiver, ""]);
    }

    // Append rows
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\n/g, "\n");
    if (!clientEmail || !privateKey) throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");
    const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
    const sheets = google.sheets({ version: "v4", auth: jwt });
    const tabName = OUTBOUND_SHEET_RANGE.split("!")[0];
    await sheets.spreadsheets.values.append({ spreadsheetId: USER_SHEET_ID, range: `${tabName}!A:N`, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values } });

    // Save slug link + version 1
    try {
      const { upsertLinkForCode, appendInboundVersion } = await import("@/lib/googleSheets");
      await upsertLinkForCode(USER_SHEET_ID, LINK_PHIEUXUAT_SHEET_RANGE, code, slug);
      // Append version 1 snapshot
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      const timestamp = `${hh}:${mm} - ${dd}/${mo}/${yyyy}`;
      const payloadDoc = { code, date, time: hhmm, warehouse, createdBy, receiver, description, lines: lines.map((l: any) => ({ productCode: l?.code || "", productName: l?.productName || l?.product || "", qty: Number(l?.qty || 0) || 0, unit: l?.unit || l?.uom || "", memo: l?.memo || l?.note || "" })) };
      // Reuse appendInboundVersion but with outbound versions range
      await appendInboundVersion(USER_SHEET_ID, OUTBOUND_VERSIONS_SHEET_RANGE, { code, version: 1, timestamp, user: actionUser || createdBy || "", data: JSON.stringify(payloadDoc), slug });
    } catch {}

    try {
      const { appendInboundLog } = await import("@/lib/googleSheets");
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      const timestamp = `${hh}:${mm} - ${dd}/${mo}/${yyyy}`;
      const details = (body?.logEntry || "").toString();
      await appendInboundLog(USER_SHEET_ID, OUTBOUND_LOG_SHEET_RANGE, { code, timestamp, user: actionUser || createdBy || "", action: "Tạo phiếu", details, slug });
    } catch {}

    const respDoc = {
      code,
      date,
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
    const { deleteInboundRowsByCode, deleteLinkForCode } = await import("@/lib/googleSheets");
    const res = await deleteInboundRowsByCode(USER_SHEET_ID, OUTBOUND_SHEET_RANGE, code);
    try { await deleteLinkForCode(USER_SHEET_ID, LINK_PHIEUXUAT_SHEET_RANGE, code); } catch {}
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
    const date = (body?.date || "").toString().trim();
    const time = (body?.time || "").toString().trim();
    const warehouse = (body?.warehouse || "").toString().trim();
    const createdBy = (body?.createdBy || body?.user || "").toString().trim();
    const actionUser = (body?.user || body?.createdBy || "").toString().trim();
    const receiver = (body?.receiver || body?.nguoiNhan || "").toString().trim();
    const description = (body?.description || body?.note || "").toString();
    const source = (body?.source || "").toString();
    const lines = Array.isArray(body?.lines) ? body.lines : [];
    const logEntry = (body?.logEntry || "").toString();
    if (!lines.length) return NextResponse.json({ ok: false, error: "Phiếu không có dòng hàng" }, { status: 400 });

    const { updateInboundRowsInPlace, appendInboundLog, getLinkForCode, appendInboundVersion, getInboundVersions } = await import("@/lib/googleSheets");

    let preservedSlug: string | null = null;
    try { preservedSlug = await getLinkForCode(USER_SHEET_ID, LINK_PHIEUXUAT_SHEET_RANGE, code); } catch { preservedSlug = null; }

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
        } else { if (!productName) productName = prodStr.trim(); }
      }
      const qtyNum = Number(l?.qty ?? 0) || 0;
      const uom = (l?.unit || l?.uom || "").toString().trim();
      const memoLine = (l?.memo || l?.note || "").toString();
      newRows.push([code, ddmmyyyy, hhmm, warehouse, productCode, productName, qtyNum, uom, createdBy, description, memoLine, source, receiver, ""]);
    }

    // In-place update
    const result = await updateInboundRowsInPlace(USER_SHEET_ID, OUTBOUND_SHEET_RANGE, code, newRows);

    try {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = now.getFullYear();
      const timestamp = `${hh}:${mm} - ${dd}/${mo}/${yyyy}`;
      const details = logEntry || "Cập nhật phiếu";
      await appendInboundLog(USER_SHEET_ID, OUTBOUND_LOG_SHEET_RANGE, { code, timestamp, user: actionUser || createdBy || "", action: "Cập nhật phiếu", details, slug: preservedSlug || "" });
    } catch {}

    try {
      if (preservedSlug) {
        const { upsertLinkForCode } = await import("@/lib/googleSheets");
        await upsertLinkForCode(USER_SHEET_ID, LINK_PHIEUXUAT_SHEET_RANGE, code, preservedSlug);
      }
      // versions
      let nextVersion = 1;
      try {
        const versions = await getInboundVersions(USER_SHEET_ID, OUTBOUND_VERSIONS_SHEET_RANGE, code);
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
      await appendInboundVersion(USER_SHEET_ID, OUTBOUND_VERSIONS_SHEET_RANGE, { code, version: nextVersion, timestamp: timestamp2, user: actionUser || createdBy || "", data: JSON.stringify(snapshot), slug: preservedSlug || "" });
    } catch {}

    return NextResponse.json({ ok: true, updatedRows: newRows.length, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Lỗi không xác định" }, { status: 500 });
  }
}
