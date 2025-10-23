import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
export const runtime = "nodejs";
import { USER_SHEET_ID, USER_SHEET_RANGE, INBOUND_SETTINGS_RECEIVERS_RANGE, INBOUND_SHEET_RANGE } from "@/config/sheets";
import { listUsersFromSheet, type SheetUserFull, getSheetRows } from "@/lib/googleSheets";

type Line = { product: string; code?: string; unit: string; qty: number; memo?: string; kg?: number | null };
type Doc = { code: string; date: string; time?: string; warehouse: string; createdBy?: string; sender?: string; receiver?: string; description?: string; lines: Line[] };

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

    // Lazy import exceljs to keep edge bundle small (runtime nodejs anyway)
    const ExcelMod: any = await import("exceljs");
    const ExcelNS: any = ExcelMod?.Workbook ? ExcelMod : (ExcelMod?.default || ExcelMod);

    // If a template exists in public/mau.xlsx and only one doc is requested, fill that template instead of drawing programmatically
    const templatePath = path.join(process.cwd(), "public", "mau.xlsx");
    const hasTemplate = fs.existsSync(templatePath);

    if (hasTemplate && docs.length === 1) {
      const tplWb = new ExcelNS.Workbook();
      await tplWb.xlsx.readFile(templatePath);
      const ws = tplWb.worksheets[0] || tplWb.addWorksheet("Phiếu nhập");

      const doc = docs[0];
      // Determine origin for pretty URL
      const origin = req.headers.get("origin") || process.env.APP_ORIGIN || "http://localhost:3000";

      // Resolve slug from inbound sheet (column N) using code in column A
      let slug = "";
      try {
        const rows = await getSheetRows(USER_SHEET_ID, INBOUND_SHEET_RANGE);
        if (Array.isArray(rows)) {
          for (const r of rows as any[]) {
            const codeCell = (r?.[0] ?? "").toString().trim();
            if (codeCell && codeCell === (doc.code || "").trim()) {
              slug = (r?.[13] ?? "").toString().trim(); // N column (0-based index 13)
              break;
            }
          }
        }
      } catch {}

      // Prefer slug when available and include preview=1 so the link matches the in-app print preview
      let printLink = "";
      try {
        if (slug) printLink = `${origin}/xhd/${encodeURIComponent(slug)}?preview=1`;
        else if (doc?.code) printLink = `${origin}/xhd/${encodeURIComponent(doc.code)}?preview=1`;
        else printLink = `${origin}/xhd/?preview=1`;
      } catch {
        printLink = `${origin}/xhd/${encodeURIComponent(slug || doc.code || "")}?preview=1`;
      }

      // Detect storekeeper user for placeholders
      let storekeeper: Partial<SheetUserFull> | undefined = undefined;
      try {
        const users = await listUsersFromSheet(USER_SHEET_ID, USER_SHEET_RANGE);
        storekeeper = users?.find((u: any) => /thu\s*kho/i.test(String(u?.position || u?.role || "")));
      } catch {}

      // Placeholder replace across all cells
      const dmy = formatDMY(doc.date || "");
      const vnDate = formatDateLineVN(doc.date || "");
      // Base replacements
      const replacements: Record<string, string> = {
        DOC_CODE: doc.code || "",
        // Per user request: DOC_DATE_DMY now prints Vietnamese date phrase
        DOC_DATE_DMY: vnDate,
        DOC_DATE_VN: vnDate,
        DOC_DATE_DDMMYYYY: dmy,
        WAREHOUSE: doc.warehouse || "",
        CREATED_BY: doc.createdBy || "",
        NGUOI_GUI: doc.sender || "",
        NGUOI_NHAN: doc.receiver || "",
        BO_PHAN: (body?.placeholders?.BO_PHAN ?? "").toString(),
        HO_TEN: (body?.placeholders?.HO_TEN ?? "").toString(),
        DESCRIPTION: doc.description || "",
        // Thủ kho placeholders (lấy từ sheet người dùng)
        THU_KHO: (storekeeper?.name as string) || (storekeeper?.username as string) || "",
        THU_KHO_TEN: (storekeeper?.name as string) || "",
        THU_KHO_CHUC_DANH: (storekeeper?.position as string) || (storekeeper?.role as string) || "Thủ kho",
        // Pretty link placeholders for templates
        LINK: printLink || "",
        PRINT_LINK: printLink || "",
      };
      // Merge optional placeholders from client body
      if (body && body.placeholders && typeof body.placeholders === "object") {
        for (const [k, v] of Object.entries(body.placeholders)) {
          if (typeof k === "string") replacements[k] = String(v ?? "");
        }
      }

      // Receiver mapping: if a receiver name matches a row in caidatphieunhap, fill TEXT1..TEXT7 from that row
      try {
        const candidate = (doc.receiver || replacements.NGUOI_NHAN || replacements.TEXT7 || replacements.TEXT1 || "").toString().trim();
        if (candidate) {
          const rows = await getSheetRows(USER_SHEET_ID, INBOUND_SETTINGS_RECEIVERS_RANGE);
          const want = candidate.normalize?.("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase?.() || candidate.toLowerCase();
          for (const r of rows as any[]) {
            const nameCell = ((r?.[1] ?? "")).toString(); // column B
            const probe = nameCell.normalize?.("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase?.() || nameCell.toLowerCase();
            if (probe && probe === want) {
              for (let i = 1; i <= 7; i++) {
                const key = `TEXT${i}` as const;
                const val = (r?.[1 + i] ?? "").toString(); // C..H
                if (!replacements[key]) replacements[key] = val; // set only if not provided
              }
              break;
            }
          }
        }
      } catch {}

      const rePH = /\{\{\s*([A-Z0-9_]+)\s*\}\}/gi;
      const replaceInText = (text: string) => {
        // Resolve up to 3 passes to allow nested placeholders, e.g. TEXT7 contains {{LINK}}
        let out = (text || "").toString();
        for (let pass = 0; pass < 3; pass++) {
          const before = out;
          out = out.replace(rePH, (_m: string, key: string) => (replacements[key.toUpperCase()] ?? _m));
          if (out === before) break;
        }
        return out;
      };
      ws.eachRow({ includeEmpty: true }, (row: any) => {
        row.eachCell({ includeEmpty: true }, (cell: any) => {
          const v = cell.value;
          if (typeof v === "string") {
            const s = replaceInText(v);
            if (s !== v) cell.value = s;
            return;
          }
          // Handle richText objects: { richText: [{ text, font? }, ...] }
          if (v && typeof v === "object" && Array.isArray((v as any).richText)) {
            const rt = (v as any).richText.map((run: any) => {
              if (run && typeof run.text === "string") {
                const newText = replaceInText(run.text);
                return { ...run, text: newText };
              }
              return run;
            });
            (cell as any).value = { richText: rt } as any;
            return;
          }
        });
      });

      // (QR placement moved to the end, after all dynamic rows are inserted)

  // Ghi đè ô cụ thể nếu client gửi lên (ví dụ { "G22": "Giám đốc" })
      if (body && body.cells && typeof body.cells === "object") {
        for (const [addr, val] of Object.entries(body.cells)) {
          try {
            const a = String(addr);
            const c = ws.getCell(a);
            c.value = String(val ?? "");
          } catch {}
        }
      }

      // Find the letters row with A..G to set data start, and find the 'Cộng' row to keep it below
      const isLettersRow = (rowNum: number) => {
        const expected = ["A","B","C","D","E","F","G"]; // columns 1..7
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
      // If not found, assume one row below the last data row placeholder area
      if (congRow === -1) congRow = dataStart + 1;

      const lines = Array.isArray(doc.lines) ? doc.lines : [];
      const extraRows = Math.max(0, lines.length - 1);
      if (extraRows > 0) {
        // Duplicate the first data row style to add more rows for items
        ws.duplicateRow(dataStart, extraRows, true);
        // After duplication, shift 'Cộng' row down accordingly if it originally exists below
        congRow += extraRows;
      }

      // Fill item rows
    let kgTotal = 0;
      for (let i = 0; i < lines.length; i++) {
        const L = lines[i];
        const { code, name } = extractCodeAndName(L.product || "", L.code);
        const r = dataStart + i;
        const row = ws.getRow(r);
        row.getCell(1).value = i + 1; // STT
        row.getCell(2).value = name || ""; // Tên
        row.getCell(3).value = code || ""; // Mã số
        row.getCell(4).value = L.unit || ""; // ĐVT
        row.getCell(5).value = Number(L.qty) || 0; // Thực nhập
        row.getCell(6).value = L.kg == null ? "" : Number(L.kg); // Quy đổi (Kg)
        row.getCell(7).value = L.memo || ""; // Ghi chú
        
        if (L.kg != null && Number.isFinite(L.kg as number)) kgTotal += Number(L.kg);
      }

      // Totals row (Cộng)
      const totalRow = ws.getRow(congRow);
      const valB = (totalRow.getCell(2).value ?? "").toString().trim();
      if (valB !== "Cộng") totalRow.getCell(2).value = "Cộng";
  // Keep 'x' marker in column E, show numeric total only in F (kg)
  totalRow.getCell(5).value = "x";
  totalRow.getCell(6).value = kgTotal ? Number(kgTotal.toFixed(3)) : "";

      // Place QR after rows are finalized to avoid position drift
      try {
        if (printLink) {
          // Find the first cell that contains the resolved printLink (string or richText)
          let linkRow = -1, linkCol = -1; let linkCell: any = null;
          const getCellText = (cell: any) => {
            const v = cell?.value;
            if (typeof v === "string") return v;
            if (v && typeof v === "object" && Array.isArray(v.richText)) return v.richText.map((r: any) => r?.text || "").join("");
            return (v == null ? "" : String(v));
          };
          ws.eachRow({ includeEmpty: true }, (row: any, rIdx: number) => {
            row.eachCell({ includeEmpty: true }, (cell: any, cIdx: number) => {
              const val = getCellText(cell);
              if (val && typeof val === "string" && val.includes(printLink) && linkRow === -1) {
                linkRow = rIdx; linkCol = cIdx; linkCell = cell; // 1-based
              }
            });
          });

          // Generate QR PNG at higher resolution to keep it sharp in Excel
          // QR_SIZE_PX is a visual target; QR_GEN_PX is the pixel size we ask the generator for (higher = crisper)
          // Make the QR smaller: reduce generation and display sizes
          const QR_SIZE_PX = 100; // visual target (px)
          const QR_GEN_PX = QR_SIZE_PX * 3; // render at 3x for crispness
          // QR_DISPLAY_PX is the final pixel size we want the image to occupy in the sheet
          const QR_DISPLAY_PX = 120;
          const QRMod: any = await import("qrcode");
          const QRApi: any = QRMod?.toDataURL ? QRMod : (QRMod?.default || QRMod);
          const dataUrl: string = await QRApi.toDataURL(printLink, { margin: 1, width: QR_GEN_PX });
          const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
          const imgId = tplWb.addImage({ base64, extension: "png" });

          // Use the found link cell as the target; fallback to D29 (col 4) if not found
          const targetCol = linkCol > 0 ? linkCol : 4; // D
          const targetRow = linkRow > 0 ? linkRow : 29;

          // Keep link text visible and center it at top of the cell (so QR can sit below)
          try {
            const cell = linkRow > 0 ? linkCell : ws.getCell(targetRow, targetCol);
            // If we didn't find an existing cell containing the link, write the link into the fallback target
            if (linkRow === -1) {
              try { ws.getCell(targetRow, targetCol).value = printLink; } catch {}
            }
            const prev = (cell.alignment || {}) as any;
            cell.alignment = { ...prev, horizontal: "center", vertical: "top", wrapText: true };
          } catch {}

          // Create a merged block under the link cell and anchor the QR there so it follows the link location
          try {
            const colSpan = 7; // span 2 columns to provide room and center the image
            const baseRowSpan = 5;
            const extraSpan = typeof extraRows === "number" ? Math.min(30, extraRows) : 0;
            const rowSpan = baseRowSpan + extraSpan;

            // Place the QR block below the link row so it doesn't overlap the text
            const colStart = Math.max(1, targetCol - Math.floor(colSpan / 2));
            const colEnd = colStart + colSpan - 1;
            const rowStart = targetRow + 1; // below the link row
            const rowEnd = rowStart + rowSpan - 1;

            try { ws.mergeCells(rowStart, colStart, rowEnd, colEnd); } catch {}

            // Increase heights to fit the QR display size and ensure the merged block matches a square image
            try {
              const totalDisplayPoints = Math.ceil(QR_DISPLAY_PX * 0.75); // approx points
              const baseRowHeightPoints = 18; // default row height in points
              // determine how many rows we need to approximate the desired image height
              const desiredRows = Math.max(1, Math.ceil(totalDisplayPoints / baseRowHeightPoints));
              // adjust rowEnd to fit desiredRows (start at rowStart)
              const newRowEnd = rowStart + desiredRows - 1;
              // merge area may need to be extended downward to newRowEnd
              try { ws.unMergeCells(rowStart, colStart, rowEnd, colEnd); } catch {}
              try { ws.mergeCells(rowStart, colStart, newRowEnd, colEnd); } catch {}

              const perRowPoints = Math.ceil(totalDisplayPoints / desiredRows);
              for (let rr = rowStart; rr <= newRowEnd; rr++) {
                const r = ws.getRow(rr);
                r.height = Math.max(perRowPoints, r.height || 0);
              }

              // Insert image with explicit ext to force a square display (prevents vertical stretching)
              try {
                ws.addImage(imgId, { tl: { col: colStart + 2.5, row: rowStart - 1 }, ext: { width: QR_DISPLAY_PX, height: QR_DISPLAY_PX } });
              } catch {}
            } catch {}
          } catch {}
        }
      } catch {}

      const buf: ArrayBuffer = await tplWb.xlsx.writeBuffer();
      const bytes = new Uint8Array(buf);
      const resHeaders = new Headers({
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="phieu-nhap-${doc.code || Date.now()}.xlsx"`,
        "Cache-Control": "no-store",
      });
      return new Response(bytes, { status: 200, headers: resHeaders });
    }

    // Fallback: draw programmatically (multi-doc or no template)
    const wb = new ExcelNS.Workbook();
    wb.creator = "QLK"; wb.created = new Date();

    const addSheetForDoc = (doc: Doc, index: number) => {
      const ws = wb.addWorksheet(doc.code || `Phieu ${index + 1}`, {
        properties: { defaultRowHeight: 18 },
        views: [{ state: "normal" }],
        pageSetup: {
          paperSize: 9, // A4
          orientation: "portrait",
          margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0.2, footer: 0.2 },
          fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        },
      });

      // Column widths
      ws.columns = [
        { header: "STT", key: "idx", width: 6 },
        { header: "Tên hàng", key: "name", width: 44 },
        { header: "Mã hàng", key: "code", width: 16 },
        { header: "ĐVT", key: "unit", width: 10 },
        { header: "Số lượng", key: "qty", width: 14 },
        { header: "Số lượng (kg)", key: "kg", width: 18 },
        { header: "Ghi chú", key: "memo", width: 22 },
      ];

  // Minimal header (no unit/department/form/regulation lines)
  ws.mergeCells("A1:G1");
  const title = ws.getCell("A1");
      title.value = "PHIẾU NHẬP KHO";
      title.font = { bold: true, size: 16 };
      title.alignment = { horizontal: "center" };

  // Meta block starting row 3
  ws.mergeCells("A3:C3"); ws.getCell("A3").value = `Số: ${doc.code || ""}`;
  ws.mergeCells("D3:G3"); ws.getCell("D3").value = formatDateLineVN(doc.date);
  ws.getCell("A3").alignment = { horizontal: "left" };
  ws.getCell("D3").alignment = { horizontal: "right" };

  ws.mergeCells("A4:G4"); ws.getCell("A4").value = `Nhập tại kho: ${doc.warehouse || ""}`;
  ws.mergeCells("A5:G5"); ws.getCell("A5").value = `Người lập phiếu: ${doc.createdBy || ""}`;
  ws.mergeCells("A6:G6"); ws.getCell("A6").value = `Diễn giải: ${doc.description || ""}`;

  // Table header row index adjusted to match minimal header
  const headerRowIdx = 8;
      const headerRow = ws.getRow(headerRowIdx);
      ["STT","Tên hàng","Mã hàng","ĐVT","Số lượng","Số lượng (kg)","Ghi chú"].forEach((h, i) => {
        const c = headerRow.getCell(i + 1);
        c.value = h;
        c.font = { bold: true };
        c.alignment = { horizontal: "center" };
        c.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
      });
      headerRow.height = 20;

      // Lines start at row 9
      const startRow = headerRowIdx + 1;
      let r = startRow;
  let kgTotal = 0;
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
          (L.kg == null ? "" : L.kg),
          L.memo || "",
        ];
        
        if (L.kg != null && Number.isFinite(L.kg as number)) kgTotal += Number(L.kg);
        cells.forEach((val, ci) => {
          const c = row.getCell(ci + 1);
          c.value = val as any;
          if (ci === 0 || ci === 2 || ci === 3) c.alignment = { horizontal: "center", vertical: "top", wrapText: true };
          else if (ci === 4 || ci === 5) c.alignment = { horizontal: "right", vertical: "top", wrapText: true };
          else c.alignment = { vertical: "top", wrapText: true };
          c.border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
        });
        row.height = 20;
      }

      // Totals row
      const totalRow = ws.getRow(r++);
      totalRow.getCell(1).value = "";
      totalRow.getCell(1).border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } };
      totalRow.getCell(2).value = "Cộng:";
      totalRow.getCell(2).alignment = { horizontal: "right" };
      [2,3].forEach(ci => totalRow.getCell(ci).border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } });
  const qtyCell = totalRow.getCell(5);
  qtyCell.value = "x"; qtyCell.alignment = { horizontal: "center" };
      const kgCell = totalRow.getCell(6);
      kgCell.value = kgTotal ? Number(kgTotal.toFixed(3)) : ""; kgCell.alignment = { horizontal: "right" };
      [4,5,6,7].forEach(ci => totalRow.getCell(ci).border = { top: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" }, bottom: { style: "thin" } });

      // Signature block
      const sigStart = r + 1;
      ws.mergeCells(`A${sigStart}:C${sigStart}`);
      ws.mergeCells(`D${sigStart}:E${sigStart}`);
      ws.mergeCells(`F${sigStart}:G${sigStart}`);
      ws.getCell(`A${sigStart}`).value = "Người lập phiếu";
      ws.getCell(`D${sigStart}`).value = "Thủ kho";
      ws.getCell(`F${sigStart}`).value = "Giám đốc";
      ["A","D","F"].forEach(col => {
        const cell = ws.getCell(`${col}${sigStart}`);
        cell.alignment = { horizontal: "center" };
        cell.font = { bold: true };
      });

      const sigNameRow = sigStart + 4;
      ws.mergeCells(`A${sigNameRow}:C${sigNameRow}`);
      ws.mergeCells(`D${sigNameRow}:E${sigNameRow}`);
      ws.mergeCells(`F${sigNameRow}:G${sigNameRow}`);
      if (doc.createdBy) {
        ws.getCell(`A${sigNameRow}`).value = doc.createdBy;
        ws.getCell(`A${sigNameRow}`).alignment = { horizontal: "center" };
      }

      // Freeze header
      ws.views = [{ state: "frozen", ySplit: headerRowIdx }];
      return ws;
    };

    docs.forEach((d, i) => addSheetForDoc(d, i));

    const buffer: ArrayBuffer = await wb.xlsx.writeBuffer();
    const bytes = new Uint8Array(buffer);
    const resHeaders = new Headers({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="phieu-nhap-${Date.now()}.xlsx"`,
      "Cache-Control": "no-store",
    });
    return new Response(bytes, { status: 200, headers: resHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "EXPORT_EXCEL_FAILED" }), { status: 500 });
  }
}
