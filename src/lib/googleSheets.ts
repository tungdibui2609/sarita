import { google } from "googleapis";
import { ensureGoogleKeyFromB64 } from "./env";

ensureGoogleKeyFromB64();
import { INBOUND_SETTINGS_SHEET_RANGE } from "@/config/sheets";

export type SheetUser = {
  username: string;
  password: string;
  name?: string;
  role?: string; // chucvu (F)
  roles?: string[]; // phân quyền (D), nhiều vai trò, phân tách bằng dấu phẩy
  status?: string;
};

export type SheetUserFull = {
  username: string;
  name?: string;
  role?: string; // chucvu (F)
  position?: string; // alias for chucvu, vẫn đọc ở F
  roles?: string[]; // phân quyền (D)
  status?: string;
  lastseen?: string; // ISO string for reliable parsing
};

// Products
export type Product = {
  code: string; // A - Mã SP
  name: string; // B - Tên sản phẩm
  group: string; // C - Nhóm sản phẩm
  uomSmall: string; // D - ĐVT nhỏ
  uomMedium: string; // E - ĐVT trung
  uomLarge: string; // F - ĐVT lớn
  ratioSmallToMedium: string; // G - Tỷ lệ nhỏ→trung
  ratioMediumToLarge: string; // H - Tỷ lệ trung→lớn
  spec: string; // I - quycach
  description?: string; // J - mô tả
  imageUrl?: string; // K - link hình ảnh 1
  imageUrl2?: string; // L - link hình ảnh 2
  imageUrl3?: string; // M - link hình ảnh 3
};

export async function listProductsFromSheet(sheetId: string, range: string): Promise<Product[]> {
  const rows = await getSheetRows(sheetId, range);
  if (!rows.length) return [];
  const [, ...data] = rows;
  // Cố định cột A..M
  const idxA = 0, idxB = 1, idxC = 2, idxD = 3, idxE = 4, idxF = 5, idxG = 6, idxH = 7, idxI = 8, idxJ = 9, idxK = 10, idxL = 11, idxM = 12;
  const out: Product[] = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const code = (row[idxA] || "").toString().trim();
    if (!code) continue; // bỏ dòng trống
    const p: any = {
      code,
      name: row.length > idxB ? (row[idxB] || "").toString() : "",
      group: row.length > idxC ? (row[idxC] || "").toString() : "",
      uomSmall: row.length > idxD ? (row[idxD] || "").toString() : "",
      uomMedium: row.length > idxE ? (row[idxE] || "").toString() : "",
      uomLarge: row.length > idxF ? (row[idxF] || "").toString() : "",
      ratioSmallToMedium: row.length > idxG ? (row[idxG] || "").toString() : "",
      ratioMediumToLarge: row.length > idxH ? (row[idxH] || "").toString() : "",
  spec: row.length > idxI ? (row[idxI] || "").toString() : "",
  description: row.length > idxJ ? (row[idxJ] || "").toString() : "",
  imageUrl: row.length > idxK ? (row[idxK] || "").toString() : "",
  imageUrl2: row.length > idxL ? (row[idxL] || "").toString() : "",
  imageUrl3: row.length > idxM ? (row[idxM] || "").toString() : "",
    };
    // Thêm metadata rowIndex (1-based) để hỗ trợ cập nhật/xóa (header ở hàng 1, data đầu tiên ở hàng 2)
    (p as any).rowIndex = i + 2;
    out.push(p as Product);
  }
  return out;
}

export async function getSheetRows(sheetId: string, range: string) {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");
  }
  const scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
  const jwt = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes,
  });
  const sheets = google.sheets({ version: "v4", auth: jwt });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  return res.data.values || [];
}

// Đọc cài đặt phiếu nhập từ sheet 'caidatphieunhap' (A=key, B=value)
export type InboundSettings = Record<string, string>;

export async function getInboundSettings(sheetId: string, range: string = INBOUND_SETTINGS_SHEET_RANGE): Promise<InboundSettings> {
  const rows = await getSheetRows(sheetId, range);
  if (!rows.length) return {};
  const [, ...data] = rows;
  const out: InboundSettings = {};
  for (const row of data) {
    const key = (row?.[0] ?? "").toString().trim();
    if (!key) continue;
    const value = (row?.[1] ?? "").toString();
    out[key] = value;
  }
  return out;
}

// Ghi nhiều cài đặt: xóa nội dung cũ từ hàng 2 trở đi rồi ghi lại tất cả key/value
export async function saveInboundSettings(sheetId: string, settings: InboundSettings, range: string = INBOUND_SETTINGS_SHEET_RANGE): Promise<void> {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");

  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  const tabName = range.split("!")[0];
  // Lấy sheetId (gid)
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const found = meta.data.sheets?.find((s: any) => s.properties?.title === tabName);
  const sheetGid = found?.properties?.sheetId;
  if (typeof sheetGid !== "number") throw new Error("Không tìm thấy tab '" + tabName + "'");

  // Xóa nội dung cũ từ hàng 2 trở đi (giữ header nếu có)
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: `${tabName}!A2:C`,
  });

  // Viết header (nếu trống) và các giá trị mới
  const rowsData: any[][] = [];
  // Header: Key | Value | mã
  rowsData.push(["Key", "Value", "mã"]);
  for (const [k, v] of Object.entries(settings)) {
    const placeholder = `{{${k}}}`;
    rowsData.push([k, v, placeholder]);
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tabName}!A1:C${rowsData.length}`,
    valueInputOption: "RAW",
    requestBody: { values: rowsData },
  });
}

// Đọc danh mục nhóm sản phẩm từ cột N
export async function listProductGroups(sheetId: string, range: string): Promise<string[]> {
  const rows = await getSheetRows(sheetId, range);
  const vals = rows.map((r: any[]) => (r?.[0] || "").toString().trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of vals) { if (!seen.has(v)) { seen.add(v); out.push(v); } }
  return out;
}

export async function listUoms(sheetId: string, range: string): Promise<string[]> {
  const rows = await getSheetRows(sheetId, range);
  const vals = rows.map((r: any[]) => (r?.[0] || "").toString().trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of vals) { if (!seen.has(v)) { seen.add(v); out.push(v); } }
  return out;
}

// Đọc danh sách mã sản phẩm bị ngưng sử dụng (soft delete) từ một cột chuyên dụng
export async function listDisabledCodes(sheetId: string, range: string): Promise<string[]> {
  const rows = await getSheetRows(sheetId, range);
  const vals = rows.map((r: any[]) => (r?.[0] || "").toString().trim()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of vals) { const key = v.toLowerCase(); if (!seen.has(key)) { seen.add(key); out.push(v); } }
  return out;
}

// Cập nhật dòng cài đặt Phiếu nhập theo tên Người nhận (B); ghi các TEXT1..TEXT7 vào cột C..I
export async function updateInboundReceiverRowByName(
  sheetId: string,
  baseRange: string, // ví dụ: "caidatphieunhap!A2:I"
  receiverName: string,
  updates: Partial<Record<"TEXT1" | "TEXT2" | "TEXT3" | "TEXT4" | "TEXT5" | "TEXT6" | "TEXT7", string>>
) {
  const name = (receiverName || "").toString().trim();
  if (!name) throw new Error("RECEIVER_NAME_REQUIRED");
  const rows = await getSheetRows(sheetId, baseRange);
  // Tên người nhận nằm ở cột B (index 1)
  const idx = rows.findIndex((r: any[]) => ((r?.[1] || "").toString().trim().toLowerCase() === name.toLowerCase()));
  if (idx < 0) throw new Error("RECEIVER_NOT_FOUND");

  // Current values C..I (TEXT1..TEXT7)
  const current = rows[idx] || [];
  const vals: string[] = [];
  const keys: Array<keyof typeof updates> = ["TEXT1", "TEXT2", "TEXT3", "TEXT4", "TEXT5", "TEXT6", "TEXT7"];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    // i + 2 => bắt đầu từ C (index 2) thay vì B (index 1)
    const v = (updates[key] != null) ? String(updates[key] ?? "") : String(current[i + 2] ?? "");
    vals.push(v);
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  const tabName = baseRange.split("!")[0];
  const absoluteRow = 2 + idx; // vì baseRange bắt đầu từ A2
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    // Ghi vào C..I
    range: `${tabName}!C${absoluteRow}:I${absoluteRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [vals] },
  });

  return { name, ...keys.reduce((acc, k, i) => { (acc as any)[k] = vals[i]; return acc; }, {} as Record<string, string>) };
}

// Thêm Người nhận mới vào caidatphieunhap: B = name, C..I = TEXT1..TEXT7
export async function appendInboundReceiver(
  sheetId: string,
  baseRange: string, // ví dụ: "caidatphieunhap!A2:I"
  payload: { name: string; TEXT1?: string; TEXT2?: string; TEXT3?: string; TEXT4?: string; TEXT5?: string; TEXT6?: string; TEXT7?: string }
) {
  const name = (payload.name || "").toString().trim();
  if (!name) throw new Error("RECEIVER_NAME_REQUIRED");
  const rows = await getSheetRows(sheetId, baseRange);
  // Duplicate guard (case-insensitive, ignore diacritics)
  const norm = (s: string) => {
    try { return s.normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase(); } catch { return s.toLowerCase(); }
  };
  if (rows.some((r: any[]) => norm((r?.[1]||"").toString()) === norm(name))) {
    throw new Error("RECEIVER_EXISTS");
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  const tabName = baseRange.split("!")[0];
  const row: any[] = new Array(9).fill("");
  // A = mã phụ (để trống), B..I như mô tả
  row[1] = name;
  row[2] = (payload.TEXT1 || "").toString();
  row[3] = (payload.TEXT2 || "").toString();
  row[4] = (payload.TEXT3 || "").toString();
  row[5] = (payload.TEXT4 || "").toString();
  row[6] = (payload.TEXT5 || "").toString();
  row[7] = (payload.TEXT6 || "").toString();
  row[8] = (payload.TEXT7 || "").toString();

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${tabName}!A:I`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  return { name, TEXT1: row[2], TEXT2: row[3], TEXT3: row[4], TEXT4: row[5], TEXT5: row[6], TEXT6: row[7], TEXT7: row[8] };
}

// Xóa Người nhận theo tên (B) khỏi 'caidatphieunhap' bằng cách xóa cả dòng dữ liệu
export async function deleteInboundReceiverByName(
  sheetId: string,
  baseRange: string, // ví dụ: "caidatphieunhap!A2:I"
  receiverName: string
) {
  const name = (receiverName || "").toString().trim();
  if (!name) throw new Error("RECEIVER_NAME_REQUIRED");

  // Đọc để tìm index (tính từ 0 theo vùng A2:I)
  const rows = await getSheetRows(sheetId, baseRange);
  const idx = rows.findIndex((r: any[]) => ((r?.[1] || "").toString().trim().toLowerCase() === name.toLowerCase()));
  if (idx < 0) throw new Error("RECEIVER_NOT_FOUND");

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  // Lấy sheet gid từ tab name
  const tabName = baseRange.split("!")[0];
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const found = meta.data.sheets?.find((s: any) => s.properties?.title === tabName);
  const sheetGid = found?.properties?.sheetId;
  if (typeof sheetGid !== "number") throw new Error("TAB_NOT_FOUND");

  // Dòng tuyệt đối cần xóa (hàng 1 là header chung; baseRange bắt đầu từ hàng 2)
  const absoluteRow = 2 + idx; // ví dụ: idx 0 -> hàng 2

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetGid,
              dimension: "ROWS",
              startIndex: absoluteRow - 1, // 0-based, inclusive
              endIndex: absoluteRow,       // 0-based, exclusive
            },
          },
        },
      ],
    },
  });

  return { name };
}

// Xóa tất cả các dòng của một phiếu (mã code) trong sheet phieunhap bằng cách xóa từng hàng phù hợp
export async function deleteInboundRowsByCode(
  sheetId: string,
  baseRange: string, // ví dụ: "phieunhap!A1:N"
  code: string
) {
  const v = (code || "").toString().trim();
  if (!v) throw new Error("CODE_REQUIRED");

  const rows = await getSheetRows(sheetId, baseRange);
  if (!rows.length) throw new Error("NO_ROWS_FOUND");
  // header at index 0, data starts at index 1 -> dataIndex = i-1 for absoluteRow
  const [, ...data] = rows;
  const matchedAbsoluteRows: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i] || [];
    const cellA = (r[0] || "").toString().trim();
    if (cellA === v) {
      const absoluteRow = 2 + i; // data[0] -> row 2
      matchedAbsoluteRows.push(absoluteRow);
    }
  }
  if (!matchedAbsoluteRows.length) throw new Error("CODE_NOT_FOUND");

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY");

  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  const tabName = baseRange.split("!")[0];
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const found = meta.data.sheets?.find((s: any) => s.properties?.title === tabName);
  const sheetGid = found?.properties?.sheetId;
  if (typeof sheetGid !== "number") throw new Error("TAB_NOT_FOUND");

  // Sort descending so deletions don't affect earlier indexes
  matchedAbsoluteRows.sort((a, b) => b - a);

  const requests: any[] = matchedAbsoluteRows.map((absoluteRow) => ({
    deleteDimension: {
      range: {
        sheetId: sheetGid,
        dimension: "ROWS",
        startIndex: absoluteRow - 1,
        endIndex: absoluteRow,
      },
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { requests },
  });

  return { code: v, deletedRows: matchedAbsoluteRows.length };
}

// Append a log entry to a separate log sheet (phieunhap_log)
export async function appendInboundLog(sheetId: string, logRange: string, payload: { code: string; timestamp: string; user: string; action: string; details?: string; slug?: string }) {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY");
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  const tabName = logRange.split("!")[0];
  // Row format: Timestamp | Code | User | Action | Details | Slug
  const row = [payload.timestamp, payload.code, payload.user, payload.action, (payload.details || ""), (payload.slug || "")];
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${tabName}!A:F`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
  return { ok: true };
}

// Update existing rows for a code in-place: find all rows with the code and overwrite their values (preserve row positions)
export async function updateInboundRowsInPlace(sheetId: string, baseRange: string, code: string, newRows: any[][]) {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY");
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  const rows = await getSheetRows(sheetId, baseRange);
  if (!rows.length) throw new Error("NO_ROWS_FOUND");
  const [, ...data] = rows;
  const tabName = baseRange.split("!")[0];

  // Find absolute rows to update
  const matched: { absoluteRow: number; dataIndex: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i] || [];
    const cellA = (r[0] || "").toString().trim();
    if (cellA === code) matched.push({ absoluteRow: 2 + i, dataIndex: i });
  }
  if (!matched.length) throw new Error("CODE_NOT_FOUND");

  // If count differs, we will try to overwrite existing rows up to min(count), then insert remaining rows after last matched row, or delete extras
  const minCount = Math.min(matched.length, newRows.length);
  // Overwrite existing rows via batchUpdate (using updateCells requires more setup), we will use values.update per row
  for (let i = 0; i < minCount; i++) {
    const abs = matched[i].absoluteRow;
    const values = [newRows[i]];
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!A${abs}:O${abs}`,
      valueInputOption: 'RAW',
      requestBody: { values },
    });
  }

  if (newRows.length > matched.length) {
    // insert remaining after last matched row
  const remaining = newRows.slice(matched.length);
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${tabName}!A:O`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: remaining },
    });
  } else if (newRows.length < matched.length) {
    // delete excess rows (delete from bottom to top)
    const excess = matched.slice(newRows.length).map(m => m.absoluteRow).sort((a,b) => b - a);
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const found = meta.data.sheets?.find((s: any) => s.properties?.title === tabName);
    const sheetGid = found?.properties?.sheetId;
    if (typeof sheetGid !== 'number') throw new Error('TAB_NOT_FOUND');
  const delRequests = excess.map((absoluteRow) => ({ deleteDimension: { range: { sheetId: sheetGid, dimension: 'ROWS', startIndex: absoluteRow - 1, endIndex: absoluteRow } } }));
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: sheetId, requestBody: { requests: delRequests } });
  }

  return { ok: true, updated: newRows.length };
}

// --- Link mapping helpers (code -> slug) stored in a dedicated sheet 'linkphieunhap' A=code, B=slug
export async function getLinkForCode(sheetId: string, range: string, code: string): Promise<string | null> {
  const rows = await getSheetRows(sheetId, range);
  if (!rows.length) return null;
  const [, ...data] = rows; // header at row 1
  for (const r of data) {
    const c = (r?.[0] || "").toString().trim();
    const s = (r?.[1] || "").toString().trim();
    if (c === code) return s || null;
  }
  return null;
}

export async function upsertLinkForCode(sheetId: string, range: string, code: string, slug: string) {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY");
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  const rows = await getSheetRows(sheetId, range);
  const tabName = range.split("!")[0];
  const [, ...data] = rows;
  for (let i = 0; i < data.length; i++) {
    const r = data[i] || [];
    const c = (r[0] || "").toString().trim();
    if (c === code) {
      const rowNumber = 2 + i; // header row 1
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${tabName}!B${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[slug]] },
      });
      return { ok: true, updated: true };
    }
  }
  // not found -> append
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${tabName}!A:B`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[code, slug]] },
  });
  return { ok: true, appended: true };
}

export async function deleteLinkForCode(sheetId: string, range: string, code: string) {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY");
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  const rows = await getSheetRows(sheetId, range);
  if (!rows.length) return { ok: true, deleted: 0 };
  const [, ...data] = rows;
  const tabName = range.split("!")[0];
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const found = meta.data.sheets?.find((s: any) => s.properties?.title === tabName);
  const sheetGid = found?.properties?.sheetId;
  if (typeof sheetGid !== 'number') throw new Error('TAB_NOT_FOUND');

  const matched: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i] || [];
    const c = (r[0] || "").toString().trim();
    if (c === code) matched.push(2 + i);
  }
  if (!matched.length) return { ok: true, deleted: 0 };
  // delete from bottom
  matched.sort((a, b) => b - a);
  const requests = matched.map((absoluteRow) => ({ deleteDimension: { range: { sheetId: sheetGid, dimension: 'ROWS', startIndex: absoluteRow - 1, endIndex: absoluteRow } } }));
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: sheetId, requestBody: { requests } });
  return { ok: true, deleted: matched.length };
}

// Append a version snapshot for an inbound code
export async function appendInboundVersion(sheetId: string, range: string, payload: { code: string; version: number; timestamp: string; user: string; data: string; slug?: string }) {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY");
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  const tabName = range.split("!")[0];
  // Include slug as column F (optional)
  const row = [payload.code, String(payload.version), payload.timestamp, payload.user, payload.data || "", payload.slug || ""];
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${tabName}!A:F`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
  return { ok: true };
}

// Read versions for a given code (returns rows with parsed JSON data)
export async function getInboundVersions(sheetId: string, range: string, code: string) {
  const rows = await getSheetRows(sheetId, range);
  if (!rows.length) return [];
  const [, ...data] = rows;
  const out: Array<{ version: number; timestamp: string; user: string; data: any; slug?: string | null }> = [];
  for (const r of data) {
    const c = (r?.[0] || "").toString().trim();
    if (!c || c !== code) continue;
    const ver = Number((r?.[1] || "0").toString()) || 0;
    const ts = (r?.[2] || "").toString();
    const user = (r?.[3] || "").toString();
    const raw = (r?.[4] || "").toString();
    const slug = (r?.[5] || "").toString().trim() || null;
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch { parsed = raw; }
    out.push({ version: ver, timestamp: ts, user, data: parsed, slug });
  }
  // sort by version desc
  out.sort((a, b) => b.version - a.version);
  return out;
}

// Đảm bảo một giá trị tồn tại trong cột (ví dụ nhóm SP tại cột N)
export async function ensureValueInColumn(sheetId: string, range: string, value: string): Promise<boolean> {
  const v = (value || "").toString().trim();
  if (!v) return false;
  const existing = await listProductGroups(sheetId, range);
  if (existing.some((x) => x.localeCompare(v, undefined, { sensitivity: "base" }) === 0)) return false;

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  const tabName = range.split("!")[0];
  const after = range.split("!")[1] || "N2:N";
  const m = after.match(/^([A-Z]+)(\d+)?/);
  const col = m && m[1] ? m[1] : "N"; // mặc định N
  const startRow = m && m[2] ? parseInt(m[2], 10) : 1;

  // tìm dòng trống tiếp theo trong cột
  const existingRows = await getSheetRows(sheetId, range);
  const nextRow = startRow + existingRows.length; // vì range đã bỏ header (ví dụ N2:N)

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tabName}!${col}${nextRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [[v]] },
  });
  return true;
}

// Thêm một mã vào cột đánh dấu "ngưng sử dụng" (nếu chưa tồn tại)
export async function disableCode(sheetId: string, range: string, code: string): Promise<boolean> {
  const v = (code || "").toString().trim();
  if (!v) return false;
  const existing = await listDisabledCodes(sheetId, range);
  if (existing.some((x) => x.localeCompare(v, undefined, { sensitivity: "base" }) === 0)) return false;

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  const tabName = range.split("!")[0];
  const after = range.split("!")[1] || "P2:P";
  const m = after.match(/^([A-Z]+)(\d+)?/);
  const col = m && m[1] ? m[1] : "P"; // mặc định P
  const startRow = m && m[2] ? parseInt(m[2], 10) : 1;

  const existingRows = await getSheetRows(sheetId, range);
  const nextRow = startRow + existingRows.length;

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tabName}!${col}${nextRow}`,
    valueInputOption: "RAW",
    requestBody: { values: [[v]] },
  });
  return true;
}

// Khôi phục: xóa giá trị mã khỏi cột đánh dấu "ngưng sử dụng"
export async function restoreCode(sheetId: string, range: string, code: string): Promise<boolean> {
  const v = (code || "").toString().trim();
  if (!v) return false;
  const rows = await getSheetRows(sheetId, range);
  const vals = rows.map((r: any[]) => (r?.[0] || "").toString());
  const idx = vals.findIndex((x) => x.localeCompare(v, undefined, { sensitivity: "base" }) === 0);
  if (idx < 0) return false; // không có gì để xóa

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  const tabName = range.split("!")[0];
  const after = range.split("!")[1] || "P2:P";
  const m = after.match(/^([A-Z]+)(\d+)?/);
  const col = m && m[1] ? m[1] : "P"; // P
  const startRow = m && m[2] ? parseInt(m[2], 10) : 1; // 2 theo cấu hình N2:N, P2:P, nhưng an toàn mặc định 1
  const rowNumber = startRow + idx; // vị trí tuyệt đối của ô cần clear

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tabName}!${col}${rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [[""]] },
  });
  return true;
}

// Thêm sản phẩm mới (append cuối bảng)
export async function appendProductToSheet(
  sheetId: string,
  range: string,
  payload: {
    code: string; name: string; group?: string;
    uomSmall?: string; uomMedium?: string; uomLarge?: string;
    ratioSmallToMedium?: string; ratioMediumToLarge?: string; spec?: string; description?: string; imageUrl?: string; imageUrl2?: string; imageUrl3?: string;
  }
) {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");
  }
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  // Cột A..M
  const rows = await getSheetRows(sheetId, range);
  if (!rows.length) throw new Error("Không đọc được header của sheet Products");
  const idxA = 0, idxB = 1, idxC = 2, idxD = 3, idxE = 4, idxF = 5, idxG = 6, idxH = 7, idxI = 8, idxJ = 9, idxK = 10, idxL = 11, idxM = 12;
  const maxIdx = idxM;
  const row: string[] = new Array(maxIdx + 1).fill("");
  row[idxA] = payload.code;
  row[idxB] = payload.name;
  row[idxC] = (payload.group || "").trim();
  row[idxD] = (payload.uomSmall || "").trim();
  row[idxE] = (payload.uomMedium || "").trim();
  row[idxF] = (payload.uomLarge || "").trim();
  row[idxG] = (payload.ratioSmallToMedium || "").toString().trim();
  row[idxH] = (payload.ratioMediumToLarge || "").toString().trim();
  row[idxI] = (payload.spec || "").trim();
  row[idxJ] = (payload.description || "").trim();
  (row as any)[idxK] = ((payload as any).imageUrl || "").toString().trim();
  (row as any)[idxL] = ((payload as any).imageUrl2 || "").toString().trim();
  (row as any)[idxM] = ((payload as any).imageUrl3 || "").toString().trim();

  const tabName = range.split("!")[0];
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
  range: `${tabName}!A:M`,
  valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

// Cập nhật sản phẩm theo rowIndex (1-based); chỉ ghi các trường được cung cấp
export async function updateProductAtRow(
  sheetId: string,
  range: string,
  rowIndex: number,
  updates: Partial<Product>
) {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");
  }
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  const tabName = range.split("!")[0];
  const idxA = 0, idxB = 1, idxC = 2, idxD = 3, idxE = 4, idxF = 5, idxG = 6, idxH = 7, idxI = 8, idxJ = 9, idxK = 10, idxL = 11, idxM = 12;

  const data: Array<{ range: string; values: any[][] }> = [];
  if (typeof updates.code === "string") data.push({ range: `${tabName}!${colIndexToLetter(idxA)}${rowIndex}`, values: [[updates.code]] });
  if (typeof updates.name === "string") data.push({ range: `${tabName}!${colIndexToLetter(idxB)}${rowIndex}`, values: [[updates.name]] });
  if (typeof updates.group === "string") data.push({ range: `${tabName}!${colIndexToLetter(idxC)}${rowIndex}`, values: [[updates.group]] });
  if (typeof updates.uomSmall === "string") data.push({ range: `${tabName}!${colIndexToLetter(idxD)}${rowIndex}`, values: [[updates.uomSmall]] });
  if (typeof updates.uomMedium === "string") data.push({ range: `${tabName}!${colIndexToLetter(idxE)}${rowIndex}`, values: [[updates.uomMedium]] });
  if (typeof updates.uomLarge === "string") data.push({ range: `${tabName}!${colIndexToLetter(idxF)}${rowIndex}`, values: [[updates.uomLarge]] });
  if (typeof updates.ratioSmallToMedium === "string") data.push({ range: `${tabName}!${colIndexToLetter(idxG)}${rowIndex}`, values: [[updates.ratioSmallToMedium]] });
  if (typeof updates.ratioMediumToLarge === "string") data.push({ range: `${tabName}!${colIndexToLetter(idxH)}${rowIndex}`, values: [[updates.ratioMediumToLarge]] });
  if (typeof updates.spec === "string") data.push({ range: `${tabName}!${colIndexToLetter(idxI)}${rowIndex}`, values: [[updates.spec]] });
  if (typeof (updates as any).description === "string") data.push({ range: `${tabName}!${colIndexToLetter(idxJ)}${rowIndex}`, values: [[(updates as any).description]] });
  if (typeof (updates as any).imageUrl === "string") data.push({ range: `${tabName}!${colIndexToLetter(idxK)}${rowIndex}`, values: [[(updates as any).imageUrl]] });
  if (typeof (updates as any).imageUrl2 === "string") data.push({ range: `${tabName}!${colIndexToLetter(idxL)}${rowIndex}`, values: [[(updates as any).imageUrl2]] });
  if (typeof (updates as any).imageUrl3 === "string") data.push({ range: `${tabName}!${colIndexToLetter(idxM)}${rowIndex}`, values: [[(updates as any).imageUrl3]] });

  if (!data.length) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: "RAW", data },
  });
}

// Xóa cả dòng theo rowIndex (1-based). Không xóa header.
export async function deleteProductRow(sheetId: string, range: string, rowIndex: number) {
  if (rowIndex <= 1) throw new Error("Không thể xóa header");
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");
  }
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  const tabName = range.split("!")[0];
  // Cần sheetId (gid) dạng số, nhưng API deleteDimension dùng sheetId nội bộ, không phải tên tab.
  // Truy vấn metadata để lấy sheetId theo tên tab.
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const found = meta.data.sheets?.find((s: any) => s.properties?.title === tabName);
  const sheetGid = found?.properties?.sheetId;
  if (typeof sheetGid !== "number") throw new Error("Không tìm thấy sheetId của tab Products");

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetGid,
              dimension: "ROWS",
              startIndex: rowIndex - 1, // 0-based inclusive
              endIndex: rowIndex, // 0-based exclusive
            },
          },
        },
      ],
    },
  });
}

export async function findUserFromSheet(sheetId: string, range: string, username: string): Promise<SheetUser | null> {
  const rows = await getSheetRows(sheetId, range);
  if (!rows.length) return null;
  const [header, ...data] = rows;
  // Ánh xạ cột cố định theo yêu cầu: B=username(1), C=password(2), D=roles(3), E=name(4), F=chucvu(5)
  const idxUser = 1; // B
  const idxPass = 2; // C
  const idxRoles = 3; // D
  const idxName = 4; // E
  const idxChucVu = 5; // F
  const idxStatus = header.findIndex((h: string) => /status|tr[ạa]ng\s*th[aá]i/i.test(h));
  if (idxUser < 0 || idxPass < 0) return null;
  for (const row of data) {
    const u = (row[idxUser] || "").toString().trim();
    if (u.toLowerCase() === username.toLowerCase()) {
      return {
        username: u,
        password: (row[idxPass] || "").toString(),
        name: row.length > idxName ? (row[idxName] || "").toString() : undefined,
        role: row.length > idxChucVu ? (row[idxChucVu] || "").toString() : undefined,
        roles: row.length > idxRoles && row[idxRoles] ? (row[idxRoles] as string).toString().split(/\s*,\s*/).filter(Boolean) : [],
        status: idxStatus >= 0 ? (row[idxStatus] || "").toString() : undefined,
      };
    }
  }
  return null;
}

// Helper: chuyển chỉ số cột (0-based) sang chữ (A, B, ... AA, AB)
function colIndexToLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export async function findUserWithRow(sheetId: string, range: string, username: string): Promise<{ user: SheetUser; rowIndex: number; header: string[] } | null> {
  const rows = await getSheetRows(sheetId, range);
  if (!rows.length) return null;
  const [header, ...data] = rows;
  const idxUser = 1; // B
  const idxPass = 2; // C
  const idxRoles = 3; // D
  const idxName = 4; // E
  const idxChucVu = 5; // F
  const idxStatus = header.findIndex((h: string) => /status|tr[ạa]ng\s*th[aá]i/i.test(h));
  if (idxUser < 0 || idxPass < 0) return null;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const u = (row[idxUser] || "").toString().trim();
    if (u.toLowerCase() === username.toLowerCase()) {
      const user: SheetUser = {
        username: u,
        password: (row[idxPass] || "").toString(),
        name: row.length > idxName ? (row[idxName] || "").toString() : undefined,
        role: row.length > idxChucVu ? (row[idxChucVu] || "").toString() : undefined,
        roles: row.length > idxRoles && row[idxRoles] ? (row[idxRoles] as string).toString().split(/\s*,\s*/).filter(Boolean) : [],
        status: idxStatus >= 0 ? (row[idxStatus] || "").toString() : undefined,
      };
      // rowIndex trong sheet (1-based): 1 (header) + i (0-based) + 1 => i + 2
      return { user, rowIndex: i + 2, header };
    }
  }
  return null;
}


export async function updateUserStatus(sheetId: string, tabName: string, header: string[], rowIndex: number, status: string) {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");
  }
  const scopes = ["https://www.googleapis.com/auth/spreadsheets"];
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  let colIdx = header.findIndex((h: string) => /status/i.test(h));
  if (colIdx < 0) colIdx = 7; // H
  const colLetter = colIndexToLetter(colIdx);
  const range = `${tabName}!${colLetter}${rowIndex}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[status]] },
  });
}

export function formatVNDateTime(d = new Date()) {
  // VN timezone (UTC+7)
  const tz = "Asia/Ho_Chi_Minh";
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
  // dd/mm/yyyy hh:mm:ss
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export async function updateUserLastSeen(sheetId: string, tabName: string, header: string[], rowIndex: number, isoValue: string) {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");
  }
  const scopes = ["https://www.googleapis.com/auth/spreadsheets"];
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  // Tìm cột lastseen; nếu không có, mặc định I (index 8)
  let colIdx = header.findIndex((h: string) => /last\s*seen|lastseen|last\s*active|last\s*activity/i.test(h));
  if (colIdx < 0) colIdx = 8; // I
  const colLetter = colIndexToLetter(colIdx);
  const range = `${tabName}!${colLetter}${rowIndex}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[isoValue]] },
  });
}

export async function listUsersFromSheet(sheetId: string, range: string): Promise<SheetUserFull[]> {
  const rows = await getSheetRows(sheetId, range);
  if (!rows.length) return [];
  const [header, ...data] = rows;

  // Cột cố định theo yêu cầu
  const idxUser = 1; // B
  const idxRoles = 3; // D
  const idxName = 4; // E
  const idxPosition = 5; // F
  const idxChucVu = 5; // F
  const idxStatus = header.findIndex((h: string) => /status|tr[ạa]ng\s*th[aá]i/i.test(h));
  let idxLastSeen = header.findIndex((h: string) => /last\s*seen|lastseen|last\s*active|last\s*activity/i.test(h));
  if (idxLastSeen < 0) idxLastSeen = 8; // nếu không có header, đọc mặc định cột I
  // lastlogin removed per latest requirement; only lastseen kept

  const users: SheetUserFull[] = [];
  // Bảo mật: Bỏ qua hàng 2 (index 0 của data) — chỉ lấy từ hàng 3 trở xuống
  for (const row of data.slice(1)) {
    const username = idxUser >= 0 ? (row[idxUser] || "").toString().trim() : "";
    if (!username) continue;
    users.push({
      username,
      name: row.length > idxName ? (row[idxName] || "").toString() : undefined,
      role: row.length > idxChucVu ? (row[idxChucVu] || "").toString() : undefined,
      position: row.length > idxPosition ? (row[idxPosition] || "").toString() : undefined,
      roles: row.length > idxRoles && row[idxRoles] ? (row[idxRoles] as string).toString().split(/\s*,\s*/).filter(Boolean) : [],
      status: idxStatus >= 0 ? (row[idxStatus] || "").toString() : undefined,
  lastseen: idxLastSeen >= 0 ? (row[idxLastSeen] || "").toString() : undefined,
    });
  }
  return users;
}

// Lấy danh sách code-role từ cột J (index 9), loại bỏ trùng và bỏ 'admin'
export async function listRoleCodesFromSheet(sheetId: string, range: string): Promise<string[]> {
  const rows = await getSheetRows(sheetId, range);
  if (!rows.length) return [];
  const [, ...data] = rows;
  const idxCodeRole = 9; // J
  const set = new Set<string>();
  // Bảo mật: bỏ qua hàng 2 (index 0 của data), chỉ lấy từ hàng 3 trở xuống
  for (const row of data.slice(1)) {
    const val = row.length > idxCodeRole ? (row[idxCodeRole] || "").toString().trim() : "";
    if (!val) continue;
    if (val.toLowerCase() === "admin") continue;
    set.add(val);
  }
  return Array.from(set.values());
}

// Thêm người dùng mới vào Google Sheet (append cuối bảng)
export async function appendUserToSheet(
  sheetId: string,
  range: string,
  payload: { username: string; password: string; name?: string; role?: string; position?: string; roleCodes?: string[] }
) {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");
  }
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  // Cột cố định theo yêu cầu
  const rows = await getSheetRows(sheetId, range);
  if (!rows.length) throw new Error("Không đọc được header của sheet");
  const idxUser = 1; // B
  const idxPass = 2; // C
  const idxRoles = 3; // D
  const idxName = 4; // E
  const idxChucVu = 5; // F

  const maxIdx = Math.max(idxUser, idxPass, idxRoles, idxName, idxChucVu);
  const row: string[] = new Array(maxIdx + 1).fill("");
  row[idxUser] = payload.username;
  row[idxPass] = payload.password;
  row[idxName] = payload.name || "";
  row[idxChucVu] = (payload.position || payload.role || "");
  row[idxRoles] = (payload.roleCodes || []).filter((r) => r && r.toLowerCase() !== "admin").join(",");

  const tabName = range.split("!")[0];
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${tabName}!A:Z`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

// Cập nhật người dùng theo username (tìm dòng rồi batch update A/B/E/F)
export async function updateUserInSheet(
  sheetId: string,
  range: string,
  originalUsername: string,
  updates: { username?: string; password?: string; name?: string; role?: string; position?: string; roleCodes?: string[] }
) {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY trong biến môi trường");
  }
  const jwt = new google.auth.JWT({ email: clientEmail, key: privateKey, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth: jwt });

  const found = await findUserWithRow(sheetId, range, originalUsername);
  if (!found) throw new Error("Không tìm thấy người dùng để cập nhật");
  const { header: _header, rowIndex } = found;
  const tabName = range.split("!")[0];

  const idxUser = 1; // B
  const idxPass = 2; // C
  const idxRoles = 3; // D
  const idxName = 4; // E
  const idxChucVu = 5; // F

  const data: Array<{ range: string; values: any[][] }> = [];
  if (typeof updates.username === "string" && updates.username.length) {
    data.push({ range: `${tabName}!${colIndexToLetter(idxUser)}${rowIndex}`, values: [[updates.username]] });
  }
  if (typeof updates.password === "string" && updates.password.length) {
    data.push({ range: `${tabName}!${colIndexToLetter(idxPass)}${rowIndex}`, values: [[updates.password]] });
  }
  if (typeof updates.name !== "undefined") {
    data.push({ range: `${tabName}!${colIndexToLetter(idxName)}${rowIndex}`, values: [[updates.name || ""]] });
  }
  if (typeof updates.position !== "undefined" || typeof updates.role !== "undefined") {
    const val = (updates.position ?? updates.role ?? "");
    data.push({ range: `${tabName}!${colIndexToLetter(idxChucVu)}${rowIndex}`, values: [[val]] });
  }
  if (typeof updates.roleCodes !== "undefined") {
    const val = (updates.roleCodes || []).filter((r) => r && r.toLowerCase() !== "admin").join(",");
    data.push({ range: `${tabName}!${colIndexToLetter(idxRoles)}${rowIndex}`, values: [[val]] });
  }

  if (data.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
}
