import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

type Line = { product: string; code?: string; unit: string; qty: number; memo?: string };
type Doc = { code: string; date: string; partner: string; warehouse: string; status?: string; note?: string; lines: Line[] };

function extractCodeAndName(raw: string, fallbackCode?: string) {
  const m = (raw || "").match(/^(.*?)\s*-\s*(.+)$/);
  const code = fallbackCode || (m ? (m[1] || "").trim() : "");
  const name = m ? (m[2] || "").trim() : (raw || "").trim();
  return { code, name };
}

function formatDMY(dateStr: string): string {
  if (!dateStr) return "";
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return dateStr;
}

function formatDateLineVN(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = d.getDate();
  const mm = d.getMonth() + 1;
  const yy = d.getFullYear();
  return `Ngày ${dd} tháng ${mm} năm ${yy}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const docs: Doc[] = Array.isArray(body?.docs)
      ? body.docs
      : body && body.code && Array.isArray(body.lines)
        ? [body as Doc]
        : [];
    if (!docs.length) {
      return new Response(JSON.stringify({ ok: false, error: "INVALID_PAYLOAD" }), { status: 400 });
    }

    const ExcelMod: any = await import("exceljs");
    const ExcelNS: any = ExcelMod?.Workbook ? ExcelMod : (ExcelMod?.default || ExcelMod);

  // Template path for outbound (per request: mauxuat.xlsx)
  const templatePath = path.join(process.cwd(), "public", "mauxuat.xlsx");
    const hasTemplate = fs.existsSync(templatePath);

    if (hasTemplate && docs.length === 1) {
      const tplWb = new ExcelNS.Workbook();
      await tplWb.xlsx.readFile(templatePath);
      const ws = tplWb.worksheets[0] || tplWb.addWorksheet("Phiếu xuất");

      const doc = docs[0];
      // Placeholder replace
      const dmy = formatDMY(doc.date || "");
      const vnDate = formatDateLineVN(doc.date || "");
      const replacements: Record<string, string> = {
        DOC_CODE: doc.code || "",
        DOC_DATE_DMY: vnDate,
        DOC_DATE_VN: vnDate,
        DOC_DATE_DDMMYYYY: dmy,
        WAREHOUSE: doc.warehouse || "",
        PARTNER: doc.partner || "",
        STATUS: doc.status || "",
        NOTE: doc.note || "",
      };
      if (body && body.placeholders && typeof body.placeholders === "object") {
        for (const [k, v] of Object.entries(body.placeholders)) {
          if (typeof k === "string") replacements[k] = String(v ?? "");
        }
      }
      ws.eachRow({ includeEmpty: true }, (row: any) => {
        row.eachCell({ includeEmpty: true }, (cell: any) => {
          const v = cell.value;
          if (typeof v === "string") {
            let s = v as string;
            s = s.replace(/\{\{(\w+)\}\}/g, (_m: string, key: string) => (replacements[key] ?? _m));
            if (s !== v) cell.value = s;
          }
        });
      });

      // Cells override if provided
      if (body && body.cells && typeof body.cells === "object") {
        for (const [addr, val] of Object.entries(body.cells)) {
          try { ws.getCell(String(addr)).value = String(val ?? ""); } catch {}
        }
      }

      // Find letters row A..F and "Cộng"
      const isLettersRow = (rowNum: number) => {
        const expected = ["A","B","C","D","E","F"]; // 6 columns outbound
        for (let i = 0; i < expected.length; i++) {
          const val = (ws.getRow(rowNum).getCell(i + 1).value ?? "").toString().trim();
          if (val !== expected[i]) return false;
        }
        return true;
      };
      let lettersRow = -1;
      for (let r = 1; r <= ws.rowCount; r++) {
        if (isLettersRow(r)) { lettersRow = r; break; }
      }
      const dataStart = lettersRow > 0 ? lettersRow + 1 : 15;

      let congRow = -1;
      for (let r = dataStart; r <= ws.rowCount; r++) {
        const valB = (ws.getRow(r).getCell(2).value ?? "").toString().trim();
        if (valB === "Cộng") { congRow = r; break; }
      }
      if (congRow === -1) congRow = dataStart + 1;

      const lines = Array.isArray(doc.lines) ? doc.lines : [];
      const extraRows = Math.max(0, lines.length - 1);
      if (extraRows > 0) {
        ws.duplicateRow(dataStart, extraRows, true);
        congRow += extraRows;
      }

      // Fill item rows: STT | Tên | Mã | ĐVT | SL | Ghi chú
      let qtyTotal = 0;
      for (let i = 0; i < lines.length; i++) {
        const L = lines[i];
        const { code, name } = extractCodeAndName(L.product || "", L.code);
        const r = dataStart + i;
        const row = ws.getRow(r);
        row.getCell(1).value = i + 1;
        row.getCell(2).value = name || "";
        row.getCell(3).value = code || "";
        row.getCell(4).value = L.unit || "";
        row.getCell(5).value = Number(L.qty) || 0;
        row.getCell(6).value = L.memo || "";
        qtyTotal += Number(L.qty) || 0;
      }

      // Totals row
      const totalRow = ws.getRow(congRow);
      const valB = (totalRow.getCell(2).value ?? "").toString().trim();
      if (valB !== "Cộng") totalRow.getCell(2).value = "Cộng";
      totalRow.getCell(5).value = qtyTotal ? Number(qtyTotal) : "";

      const buf: ArrayBuffer = await tplWb.xlsx.writeBuffer();
      const bytes = new Uint8Array(buf);
      const resHeaders = new Headers({
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="phieu-xuat-${doc.code || Date.now()}.xlsx"`,
        "Cache-Control": "no-store",
      });
      return new Response(bytes, { status: 200, headers: resHeaders });
    }

    // Programmatic fallback (multi-doc or no template)
    const wb = new ExcelNS.Workbook();
    wb.creator = "QLK"; wb.created = new Date();

    const addSheetForDoc = (doc: Doc, index: number) => {
      const ws = wb.addWorksheet(doc.code || `PhieuXuat ${index + 1}`, {
        properties: { defaultRowHeight: 18 },
        views: [{ state: "normal" }],
        pageSetup: {
          paperSize: 9,
          orientation: "portrait",
          margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0.2, footer: 0.2 },
          fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        },
      });

      ws.columns = [
        { header: "STT", key: "idx", width: 6 },
        { header: "Tên hàng", key: "name", width: 44 },
        { header: "Mã hàng", key: "code", width: 16 },
        { header: "ĐVT", key: "unit", width: 10 },
        { header: "Số lượng", key: "qty", width: 14 },
        { header: "Ghi chú", key: "memo", width: 22 },
      ];

      ws.mergeCells("A1:F1");
      const title = ws.getCell("A1");
      title.value = "PHIẾU XUẤT KHO";
      title.font = { bold: true, size: 16 };
      title.alignment = { horizontal: "center" };

      ws.mergeCells("A3:C3"); ws.getCell("A3").value = `Số: ${doc.code || ""}`;
      ws.mergeCells("D3:F3"); ws.getCell("D3").value = formatDateLineVN(doc.date);
      ws.getCell("A3").alignment = { horizontal: "left" };
      ws.getCell("D3").alignment = { horizontal: "right" };

      ws.mergeCells("A4:F4"); ws.getCell("A4").value = `Xuất tại kho: ${doc.warehouse || ""}`;
      ws.mergeCells("A5:F5"); ws.getCell("A5").value = `Đơn vị nhận: ${doc.partner || ""}`;
      ws.mergeCells("A6:F6"); ws.getCell("A6").value = `Ghi chú: ${doc.note || ""}`;

      const headerRowIdx = 8;
      const headerRow = ws.getRow(headerRowIdx);
      ["STT","Tên hàng","Mã hàng","ĐVT","Số lượng","Ghi chú"].forEach((h, i) => {
        const c = headerRow.getCell(i + 1);
        c.value = h;
        c.font = { bold: true };
        c.alignment = { horizontal: "center" };
        c.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
      });
      headerRow.height = 20;

      const startRow = headerRowIdx + 1;
      let r = startRow;
      let qtyTotal = 0;
      for (let i = 0; i < doc.lines.length; i++) {
        const L = doc.lines[i];
        const { code, name } = extractCodeAndName(L.product || "", L.code);
        const row = ws.getRow(r++);
        const cells = [
          i + 1,
          name || "",
          code || "",
          L.unit || "",
          (L.product ? (Number(L.qty) || 0) : ""),
          L.memo || "",
        ];
        qtyTotal += Number(L.qty) || 0;
        cells.forEach((val, ci) => {
          const c = row.getCell(ci + 1);
          c.value = val as any;
          if (ci === 0 || ci === 2 || ci === 3) c.alignment = { horizontal: "center", vertical: "top", wrapText: true };
          else if (ci === 4) c.alignment = { horizontal: "right", vertical: "top", wrapText: true };
          else c.alignment = { vertical: "top", wrapText: true };
          c.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
        });
        row.height = 20;
      }

      const totalRow = ws.getRow(r++);
      totalRow.getCell(1).value = "";
      totalRow.getCell(1).border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
      totalRow.getCell(2).value = "Cộng:";
      totalRow.getCell(2).alignment = { horizontal: "right" };
      [2,3].forEach(ci => totalRow.getCell(ci).border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } });
      const qtyCell = totalRow.getCell(5);
      qtyCell.value = qtyTotal ? Number(qtyTotal) : ""; qtyCell.alignment = { horizontal: "right" };
      [4,5,6].forEach(ci => totalRow.getCell(ci).border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } });

      ws.views = [{ state: "frozen", ySplit: headerRowIdx }];
      return ws;
    };

    docs.forEach((d, i) => addSheetForDoc(d, i));

    const buffer: ArrayBuffer = await wb.xlsx.writeBuffer();
    const bytes = new Uint8Array(buffer);
    const resHeaders = new Headers({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="phieu-xuat-${Date.now()}.xlsx"`,
      "Cache-Control": "no-store",
    });
    return new Response(bytes, { status: 200, headers: resHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "EXPORT_EXCEL_FAILED" }), { status: 500 });
  }
}
