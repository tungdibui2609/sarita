"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

type Product = {
  code: string; // Mã SP (A)
  name: string; // Tên sản phẩm (B)
  group: string; // Nhóm sản phẩm (C)
  uomSmall: string; // ĐVT nhỏ (D)
  uomMedium: string; // ĐVT trung (E)
  uomLarge: string; // ĐVT lớn (F)
  ratioSmallToMedium: string; // Tỷ lệ nhỏ→trung (G)
  ratioMediumToLarge: string; // Tỷ lệ trung→lớn (H)
  spec: string; // quycach (I)
  rowIndex?: number; // metadata để cập nhật/xóa
  description?: string; // mô tả (J)
  imageUrl?: string; // link hình ảnh (K)
  imageUrl2?: string; // link hình ảnh (L)
  imageUrl3?: string; // link hình ảnh (M)
  disabled?: boolean; // soft-disabled flag from API when includeDisabled=1
};

// Kept for future use; currently unused in this file
// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
function GroupSelect({ value, onChange }: { value: string; onChange: (_v: string) => void }) {
  const [groups, setGroups] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/products/groups", { cache: "no-store" });
        const js = await res.json();
        if (mounted && Array.isArray(js?.groups)) setGroups(js.groups);
      } catch {}
      finally { setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = (value || "").toLowerCase();
    if (!q) return groups.slice(0, 8);
    return groups.filter((g) => g.toLowerCase().includes(q)).slice(0, 8);
  }, [groups, value]);

  return (
    <div className="relative">
      <input
        className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
        placeholder={loading ? "Đang tải nhóm..." : "Nhập nhóm sản phẩm"}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
          if (!filtered.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") {
            if (highlight >= 0) { onChange(filtered[highlight]); setOpen(false); }
          } else if (e.key === "Escape") { setOpen(false); }
        }}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-52 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-zinc-500">Không có gợi ý — sẽ tạo nhóm mới</div>
          ) : (
            filtered.map((g, i) => (
              <button
                type="button"
                key={g}
                onMouseDown={(e) => { e.preventDefault(); onChange(g); setOpen(false); }}
                onMouseEnter={() => setHighlight(i)}
                className={`block w-full text-left px-3 py-2 text-sm ${i === highlight ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
              >
                {g}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AutocompleteInput({ value, onChange, source, placeholder }: { value: string; onChange: (_v: string) => void; source: string; placeholder: string }) {
  const [items, setItems] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(source, { cache: "no-store" });
        const js = await res.json();
        const arr = js?.uoms || js?.groups || [];
        if (mounted && Array.isArray(arr)) setItems(arr);
      } catch {}
      finally { setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [source]);
  const filtered = useMemo(() => {
    const q = (value || "").toLowerCase();
    if (!q) return items.slice(0, 8);
    return items.filter((g) => g.toLowerCase().includes(q)).slice(0, 8);
  }, [items, value]);
  return (
    <div className="relative">
      <input
        className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
        placeholder={loading ? "Đang tải..." : placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
          if (!filtered.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter") { if (highlight >= 0) { onChange(filtered[highlight]); setOpen(false); } }
          else if (e.key === "Escape") { setOpen(false); }
        }}
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-52 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-zinc-500">Không có gợi ý</div>
          ) : (
            filtered.map((g, i) => (
              <button
                type="button"
                key={g}
                onMouseDown={(e) => { e.preventDefault(); onChange(g); setOpen(false); }}
                onMouseEnter={() => setHighlight(i)}
                className={`block w-full text-left px-3 py-2 text-sm ${i === highlight ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
              >
                {g}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Helpers chuyển link Google Drive sang danh sách ứng viên ảnh nhúng
function getDriveIdFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (u.hostname === "drive.google.com") {
      const m = u.pathname.match(/\/d\/([^/]+)/); // bắt ID trong /file/d/{id}/view
      let id = m?.[1];
      if (!id) id = u.searchParams.get("id") || undefined; // open?id={id} hoặc uc?id=
      return id || undefined;
    }
  } catch {}
  return undefined;
}

function buildImageCandidates(url?: string): string[] {
  if (!url) return [];
  try {
    const id = getDriveIdFromUrl(url);
    if (id) {
      // Thử lần lượt các endpoint ảnh của Drive
      return [
        `https://drive.google.com/uc?export=view&id=${id}`,
        `https://lh3.googleusercontent.com/d/${id}=w1000`,
        `https://drive.google.com/thumbnail?id=${id}&sz=w1000`,
        `https://drive.google.com/uc?export=download&id=${id}`,
      ];
    }
  } catch {}
  return [url];
}

function ImgWithFallback({ url, alt, className }: { url: string; alt: string; className?: string }) {
  const candidates = useMemo(() => buildImageCandidates(url), [url]);
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const src = candidates[idx] || url;
  const driveId = useMemo(() => getDriveIdFromUrl(url), [url]);

  if (failed && driveId) {
    // Fallback cuối: nhúng Drive preview qua iframe
    return (
      <div className={className}>
        <iframe
          src={`https://drive.google.com/file/d/${driveId}/preview`}
          title={alt}
          className="h-full w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white"
          allow="autoplay; fullscreen"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        if (idx < candidates.length - 1) setIdx(idx + 1);
        else setFailed(true);
      }}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

function isLikelyVideo(url?: string): boolean {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov|m4v|avi|mkv)([?#].*)?$/i.test(url);
}

function buildVideoCandidates(url?: string): string[] {
  if (!url) return [];
  const id = getDriveIdFromUrl(url);
  if (id) {
    // Thử tải trực tiếp file video từ Drive (có thể bị chặn CORS ở một số tài khoản)
    return [
      `https://drive.google.com/uc?export=download&id=${id}`,
    ];
  }
  return [url];
}

function VideoWithFallback({ url, title, className }: { url: string; title: string; className?: string }) {
  const candidates = useMemo(() => buildVideoCandidates(url), [url]);
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const src = candidates[idx] || url;
  const driveId = useMemo(() => getDriveIdFromUrl(url), [url]);

  if (failed && driveId) {
    return (
      <div className={className}>
        <iframe
          src={`https://drive.google.com/file/d/${driveId}/preview`}
          title={title}
          className="h-full w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-black"
          allow="autoplay; fullscreen"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <video
      controls
      className={className}
      onError={() => {
        if (idx < candidates.length - 1) setIdx(idx + 1);
        else setFailed(true);
      }}
    >
      <source src={src} />
    </video>
  );
}

function MediaWithFallback({ url, name, code, className }: { url: string; name?: string; code: string; className?: string }) {
  const alt = `${name || code}`;
  const _driveId = getDriveIdFromUrl(url);
  // Nếu là file có đuôi video → thử <video>; nếu là Drive link (không đuôi) → để Img thử trước, thất bại sẽ chuyển iframe preview (có thể phát video)
  if (isLikelyVideo(url)) {
    return <VideoWithFallback url={url} title={alt} className={className} />;
  }
  // Với Drive link không rõ loại, ImgWithFallback sẽ chuyển iframe preview khi cần.
  return <ImgWithFallback url={url} alt={alt} className={className} />;
}

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  // Removed codeOnly toggle — global search already covers this use case
  const [includeDisabled, setIncludeDisabled] = useState(false);
  const pageSize = 10;
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [editingDisabled, setEditingDisabled] = useState<boolean>(false);
  const [originalDisabled, setOriginalDisabled] = useState<boolean>(false);
  const [originalCode, setOriginalCode] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Product | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const [playerIndex, setPlayerIndex] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function exportXLSX() {
    if (exporting) return;
    setExporting(true);
    try {
      // Lọc toàn bộ kết quả (không chỉ trang hiện tại)
      const q = query.trim().toLowerCase();
      const norm = (x: string | undefined) => (x || "").toString().toLowerCase();
      const baseItems = includeDisabled ? (items as any[]).filter((p) => (p as any).disabled) : items;
      const filteredAll = baseItems.filter((p) => {
        if (!q) return true;
        const code = norm(p.code);
        const name = norm(p.name);
        const group = norm(p.group);
        const spec = norm(p.spec);
        const desc = norm(p.description);
        return [code, name, group, spec, desc].some((v) => v.includes(q));
      });

      const headers = [
        "Mã SP",
        "Tên sản phẩm",
        "Nhóm sản phẩm",
        "ĐVT nhỏ",
        "ĐVT trung",
        "ĐVT lớn",
        "Tỷ lệ nhỏ→trung",
        "Tỷ lệ trung→lớn",
        "Quy cách",
        "Mô tả",
      ];
      const rows = filteredAll.map((p) => [
        p.code,
        p.name,
        p.group,
        p.uomSmall,
        p.uomMedium,
        p.uomLarge,
        p.ratioSmallToMedium,
        p.ratioMediumToLarge,
        p.spec,
        p.description || "",
      ]);

      let ExcelJS: any;
      try {
        ExcelJS = await import("exceljs");
      } catch (err) {
        console.error("ExcelJS import failed:", err);
        alert("Không thể tải thư viện xuất Excel. Vui lòng cài đặt phụ thuộc: npm i exceljs");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Products");

      // Freeze header row
      sheet.views = [{ state: "frozen", ySplit: 1 }];

      // Add header with bold style
      sheet.addRow(headers);
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true } as any;

      // Add data rows
      rows.forEach((r) => sheet.addRow(r));

      // Add borders and approximate autofit
      const totalRows = sheet.rowCount;
      const totalCols = headers.length;
      const colMax: number[] = new Array(totalCols).fill(0);
      for (let r = 1; r <= totalRows; r++) {
        for (let c = 1; c <= totalCols; c++) {
          const cell = sheet.getCell(r, c);
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          } as any;
          const text = (cell.value ?? "").toString();
          colMax[c - 1] = Math.max(colMax[c - 1], text.length);
        }
      }
      const padding = 2;
      sheet.columns = headers.map((h, i) => ({ key: `c${i}`, width: Math.min(Math.max(colMax[i] + padding, 10), 50) } as any));

      // Generate and download
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const fileName = `products_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const url = new URL("/api/products", window.location.origin);
      if (includeDisabled) url.searchParams.set("includeDisabled", "1");
      const res = await fetch(url.toString(), { cache: "no-store" });
      const js = await res.json();
      if (js?.ok && Array.isArray(js.products)) setItems(js.products);
    } catch {}
    finally { setLoading(false); }
  }, [includeDisabled]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = includeDisabled ? (items as any[]).filter((p) => (p as any).disabled) : items;
    if (!q) return source;

    const norm = (s: string | undefined) => (s || "").toString().toLowerCase();

    const scored = source
      .map((p, originalIndex) => {
        const code = norm(p.code);
        const name = norm(p.name);
        const group = norm(p.group);
  const spec = norm(p.spec);
  const desc = norm(p.description);

        const matches = [code, name, group, spec, desc].some((v) => v.includes(q));
        if (!matches) return null;

        // Scoring: ưu tiên (tốt -> xấu):
        // 0: code === q
        // 1: code startsWith q
        // 2: name startsWith q
        // 3: group startsWith q
        // 4: spec startsWith q
        // 5..8: includes ở các trường tương ứng
        let score = 1000;
        if (code === q) score = Math.min(score, 0);
        if (code.startsWith(q)) score = Math.min(score, 1);
        if (name.startsWith(q)) score = Math.min(score, 2);
        if (group.startsWith(q)) score = Math.min(score, 3);
        if (spec.startsWith(q)) score = Math.min(score, 4);
  if (code.includes(q)) score = Math.min(score, 5);
  if (name.includes(q)) score = Math.min(score, 6);
  if (group.includes(q)) score = Math.min(score, 7);
  if (spec.includes(q)) score = Math.min(score, 8);
  if (desc.includes(q)) score = Math.min(score, 9);

        return { p, score, originalIndex };
      })
      .filter(Boolean) as { p: Product; score: number; originalIndex: number }[];

    // Mặc định: sắp xếp theo độ khớp ưu tiên (code khớp đầu -> trên cùng)
    scored.sort(
      (a, b) =>
        a.score - b.score || a.p.code.localeCompare(b.p.code) || a.originalIndex - b.originalIndex
    );
    return scored.map((s) => s.p);
  }, [items, query, includeDisabled]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const view = filtered.slice(start, start + pageSize);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold inline-flex items-center gap-2">
          Quản lý sản phẩm
        </h1>
        <div>
          <button
            onClick={() => { setEditing({ code: "", name: "", group: "", uomSmall: "", uomMedium: "", uomLarge: "", ratioSmallToMedium: "", ratioMediumToLarge: "", spec: "", description: "", imageUrl: "", imageUrl2: "", imageUrl3: "" }); setOriginalDisabled(false); setEditingDisabled(false); setOriginalCode(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white text-sm px-3 py-2 hover:bg-emerald-700"
          >
            Thêm sản phẩm
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-900/70 backdrop-blur p-4 ring-1 ring-black/5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
          <div className="flex-1">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 bg-white/60 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                placeholder="Tìm theo mã, tên, nhóm, quy cách, mô tả"
              />
            </div>
          </div>
          <div className="flex items-center flex-wrap gap-2 sm:justify-start md:ml-2">
            <label
              className={`inline-flex items-center gap-2 text-sm rounded-lg border px-2.5 py-1.5 cursor-pointer select-none transition-colors ${
                includeDisabled
                  ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100/80 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-300"
                  : "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-800/60 dark:bg-sky-900/20 dark:text-sky-300"
              }`}
            >
              <input
                type="checkbox"
                checked={includeDisabled}
                onChange={(e) => { setIncludeDisabled(e.target.checked); setPage(1); }}
                disabled={loading}
                className={`${includeDisabled ? "accent-amber-600" : "accent-sky-600"}`}
              />
              <span className="whitespace-nowrap">Đã ngưng</span>
            </label>
            <div className="flex items-center gap-2 shrink-0 ml-2 lg:ml-3">
              <button onClick={load} disabled={loading} className="px-3 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-70 text-sm inline-flex items-center gap-2">
                {loading && (
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" className="opacity-25" />
                    <path d="M12 2a10 10 0 0 1 10 10" className="opacity-75" />
                  </svg>
                )}
                <span>Làm mới</span>
              </button>
              <button onClick={exportXLSX} disabled={exporting} className={`px-3 py-2 rounded-lg text-sm text-white hover:bg-emerald-700 ${exporting ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-600"}`}>
                {exporting ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" className="opacity-25" />
                      <path d="M12 2a10 10 0 0 1 10 10" className="opacity-75" />
                    </svg>
                    Đang xuất…
                  </span>
                ) : (
                  <span>Xuất Excel</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-900/70 backdrop-blur ring-1 ring-black/5 overflow-hidden">
        <div className="overflow-x-auto">
          {loading && (
            <div className="px-4 py-2 border-b border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-900/20 dark:text-emerald-300 text-sm flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" className="opacity-25" />
                <path d="M12 2a10 10 0 0 1 10 10" className="opacity-75" />
              </svg>
              <span>Đang tải dữ liệu…</span>
            </div>
          )}
          {!loading && (
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50/70 dark:bg-zinc-800/50 text-zinc-500">
              <tr>
                <th className="text-left font-medium px-4 py-3">Mã SP</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Tên sản phẩm</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Quy cách</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Mô tả</th>
                <th className="text-right font-medium px-4 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
              {view.map((p, idx) => (
                <tr key={`${p.code}-${start + idx}`} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{p.code}</span>
                      {p.disabled && (
                        <span className="md:hidden inline-flex items-center text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Đã ngưng</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <span>{p.name}</span>
                      {p.disabled && (
                        <span className="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Đã ngưng</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">{p.spec}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{p.description || ""}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-zinc-300 px-2.5 py-1 text-[13px] text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
                        title="Xem thêm"
                        onClick={() => setViewing(p)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/></svg>
                        <span>Xem thêm</span>
                      </button>

                      <button
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-300 px-2.5 py-1 text-[13px] text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                        title="Sửa"
                        onClick={() => { setEditing({ ...p }); setOriginalDisabled(!!p.disabled); setEditingDisabled(!!p.disabled); setOriginalCode(p.code); setShowModal(true); }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                        <span>Sửa</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {view.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-zinc-500" colSpan={5}>Không có dữ liệu phù hợp</td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200/70 dark:border-zinc-800/70 text-sm">
          <div className="text-zinc-500">Trang {currentPage}/{totalPages} — {filtered.length} sản phẩm</div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              Trước
            </button>
            <button
              className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Sau
            </button>
          </div>
        </div>
      </div>
      {showModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowModal(false); setEditing(null); }} />
          <div className="relative w-full max-w-2xl mx-2 md:mx-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white dark:bg-zinc-900 shadow-xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 px-4 md:px-6 pt-4 md:pt-5 pb-3 border-b border-zinc-200/70 dark:border-zinc-800/70 flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editing?.rowIndex ? "Sửa sản phẩm" : "Thêm sản phẩm"}</h3>
              <button onClick={() => { setShowModal(false); setEditing(null); }} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 text-xl leading-none">×</button>
            </div>
            <div className={`px-4 md:px-6 py-4 flex-1 overflow-y-auto ${saving ? "pointer-events-none opacity-90" : ""}`}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-1">Mã SP</label>
                <input value={editing?.code || ""} onChange={(e) => setEditing((prev) => ({ ...(prev as any), code: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Tên sản phẩm</label>
                <input value={editing?.name || ""} onChange={(e) => setEditing((prev) => ({ ...(prev as any), name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="block text-sm mb-1">Nhóm sản phẩm</label>
                <AutocompleteInput value={editing?.group || ""} onChange={(v) => setEditing((prev) => ({ ...(prev as any), group: v }))} source="/api/products/groups" placeholder="Nhập nhóm sản phẩm" />
              </div>
              <div>
                <label className="block text-sm mb-1">ĐVT nhỏ</label>
                <AutocompleteInput value={editing?.uomSmall || ""} onChange={(v) => setEditing((prev) => ({ ...(prev as any), uomSmall: v }))} source="/api/products/uoms" placeholder="Nhập ĐVT nhỏ" />
              </div>
              <div>
                <label className="block text-sm mb-1">ĐVT trung</label>
                <AutocompleteInput value={editing?.uomMedium || ""} onChange={(v) => setEditing((prev) => ({ ...(prev as any), uomMedium: v }))} source="/api/products/uoms" placeholder="Nhập ĐVT trung" />
              </div>
              <div>
                <label className="block text-sm mb-1">ĐVT lớn</label>
                <AutocompleteInput value={editing?.uomLarge || ""} onChange={(v) => setEditing((prev) => ({ ...(prev as any), uomLarge: v }))} source="/api/products/uoms" placeholder="Nhập ĐVT lớn" />
              </div>
              <div>
                <label className="block text-sm mb-1">Tỷ lệ nhỏ→trung</label>
                <input value={editing?.ratioSmallToMedium || ""} onChange={(e) => setEditing((prev) => ({ ...(prev as any), ratioSmallToMedium: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="block text-sm mb-1">Tỷ lệ trung→lớn</label>
                <input value={editing?.ratioMediumToLarge || ""} onChange={(e) => setEditing((prev) => ({ ...(prev as any), ratioMediumToLarge: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm mb-1">Quy cách</label>
                <input value={editing?.spec || ""} onChange={(e) => setEditing((prev) => ({ ...(prev as any), spec: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm mb-1">Mô tả</label>
                <textarea value={editing?.description || ""} onChange={(e) => setEditing((prev) => ({ ...(prev as any), description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" rows={3} />
              </div>
              {editing?.rowIndex ? (
                <div className="md:col-span-3">
                  <label className="block text-sm mb-2">Trạng thái</label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={editingDisabled} onChange={(e) => setEditingDisabled(e.target.checked)} />
                    Ngưng sử dụng sản phẩm này
                  </label>
                </div>
              ) : null}
              <div>
                <label className="block text-sm mb-1">Link hình 1</label>
                <input value={editing?.imageUrl || ""} onChange={(e) => setEditing((prev) => ({ ...(prev as any), imageUrl: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" placeholder="https://drive.google.com/..." />
              </div>
              <div>
                <label className="block text-sm mb-1">Link hình 2</label>
                <input value={editing?.imageUrl2 || ""} onChange={(e) => setEditing((prev) => ({ ...(prev as any), imageUrl2: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" placeholder="https://drive.google.com/..." />
              </div>
              <div>
                <label className="block text-sm mb-1">Link hình 3</label>
                <input value={editing?.imageUrl3 || ""} onChange={(e) => setEditing((prev) => ({ ...(prev as any), imageUrl3: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" placeholder="https://drive.google.com/..." />
              </div>
              </div>
            </div>
            <div className="sticky bottom-0 z-10 bg-white dark:bg-zinc-900 px-4 md:px-6 pt-3 pb-4 border-t border-zinc-200/70 dark:border-zinc-800/70 flex items-center justify-end gap-2">
              <button onClick={() => { setShowModal(false); setEditing(null); }} className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">Hủy</button>
              <button disabled={saving} onClick={async () => {
                if (saving) return;
                setSaving(true);
                if (!editing?.code || !editing?.name) { alert("Vui lòng nhập Mã SP và Tên sản phẩm"); setSaving(false); return; }
                if (editing?.rowIndex) {
                  // 1) Cập nhật dữ liệu sản phẩm
                  const res = await fetch("/api/products", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...editing }) });
                  const js = await res.json();
                  if (!js?.ok) { alert(js?.error || "Cập nhật thất bại"); setSaving(false); return; }
                  // 2) Đồng bộ trạng thái ngưng/khôi phục nếu thay đổi
                  try {
                    const currentCode = editing.code;
                    // Nếu đổi code trong khi đang ngưng, vẫn dùng mã gốc để khôi phục/ngưng phù hợp
                    const codeForStatus = originalCode || currentCode;
                    if (editingDisabled !== originalDisabled) {
                      if (editingDisabled) {
                        // chuyển sang ngưng
                        await fetch("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: codeForStatus }) });
                      } else {
                        // khôi phục
                        await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: codeForStatus, action: "restore" }) });
                      }
                    }
                  } catch {}
                } else {
                  const res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...editing }) });
                  const js = await res.json();
                  if (!js?.ok) { alert(js?.error || "Thêm thất bại"); setSaving(false); return; }
                }
                setShowModal(false);
                setEditing(null);
                setOriginalCode(null);
                await load();
                setSaving(false);
              }} className={`px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-2 ${saving ? "opacity-80" : ""}`}>
                {saving && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" className="opacity-25" />
                    <path d="M12 2a10 10 0 0 1 10 10" className="opacity-75" />
                  </svg>
                )}
                {saving ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewing(null)} />
          <div className="relative w-full max-w-2xl mx-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white dark:bg-zinc-900 p-5 md:p-6 shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Thông tin sản phẩm</h3>
              <button onClick={() => setViewing(null)} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">×</button>
            </div>
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Thông tin */}
              <div className="rounded-xl border border-sky-200 dark:border-sky-800/60 p-4 bg-sky-50/40 dark:bg-sky-900/10">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center rounded-md bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 p-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><line x1="12" y1="10" x2="12" y2="16"/><circle cx="12" cy="7" r="1"/></svg>
                  </span>
                  <span className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Thông tin</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-zinc-500">Mã SP</div>
                    <div className="font-medium">{viewing.code || "—"}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Nhóm sản phẩm</div>
                    <div className="font-medium">{viewing.group || "—"}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Tên sản phẩm</div>
                    <div className="font-medium">{viewing.name || "—"}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Quy cách</div>
                    <div className="font-medium whitespace-pre-wrap">{viewing.spec || "—"}</div>
                  </div>
                  <div className="md:col-span-2">
                    <div className="text-zinc-500">Mô tả</div>
                    <div className="font-medium whitespace-pre-wrap">{viewing.description || "—"}</div>
                  </div>
                </div>
              </div>

              {/* Đơn vị đo lường */}
              <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 p-4 bg-amber-50/40 dark:bg-amber-900/10">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 p-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="7" width="18" height="6" rx="1"/><path d="M7 7v6M11 7v6M15 7v6M19 7v6"/></svg>
                  </span>
                  <span className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Đơn vị đo lường</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-zinc-500">ĐVT nhỏ</div>
                    <div className="font-medium">{viewing.uomSmall || "—"}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">ĐVT trung</div>
                    <div className="font-medium">{viewing.uomMedium || "—"}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500">ĐVT lớn</div>
                    <div className="font-medium">{viewing.uomLarge || "—"}</div>
                  </div>
                  <div className="md:col-start-2 md:col-span-1 text-left md:-mt-1">
                    <div className="text-zinc-500 whitespace-nowrap">Tỷ lệ nhỏ→trung</div>
                    <div className="font-medium">{viewing.ratioSmallToMedium || "—"}</div>
                  </div>
                  <div className="md:col-start-3 md:col-span-1 text-left md:-mt-1">
                    <div className="text-zinc-500 whitespace-nowrap">Tỷ lệ trung→lớn</div>
                    <div className="font-medium">{viewing.ratioMediumToLarge || "—"}</div>
                  </div>
                </div>
              </div>

              {/* Hình ảnh/Video */}
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 p-4 bg-emerald-50/40 dark:bg-emerald-900/10">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 p-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polygon points="10,8 16,12 10,16" fill="currentColor"/></svg>
                  </span>
                  <span className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Hình ảnh/Video</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[viewing.imageUrl, viewing.imageUrl2, viewing.imageUrl3].map((u) => (u || "").trim()).filter((u) => u.length > 0).length === 0 ? (
                    <div className="font-medium text-sm">—</div>
                  ) : (
                    [viewing.imageUrl, viewing.imageUrl2, viewing.imageUrl3]
                      .map((u) => (u || "").trim())
                      .filter((u) => u.length > 0)
                      .map((u, i) => (
                        <button key={i} type="button" onClick={() => { setPlayerUrl(u as string); setPlayerIndex(i); }} className="block focus:outline-none text-left">
                          <MediaWithFallback url={u as string} name={viewing.name} code={viewing.code} className="h-40 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 object-contain bg-black cursor-pointer" />
                        </button>
                      ))
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-zinc-200/70 dark:border-zinc-800/70 flex items-center justify-end gap-2">
              <button onClick={() => setViewing(null)} className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {playerUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPlayerUrl(null)} />
          <div className="relative w-full max-w-3xl md:max-w-4xl mx-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white dark:bg-zinc-900 p-3 md:p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base md:text-lg font-semibold truncate">Trình phát — {viewing?.name || viewing?.code}</h4>
              <button onClick={() => setPlayerUrl(null)} className="text-zinc-400 hover:text-zinc-200">×</button>
            </div>
            {(() => {
              const arr = [viewing?.imageUrl, viewing?.imageUrl2, viewing?.imageUrl3]
                .map((u) => (u || "").trim())
                .filter((u) => u.length > 0) as string[];
              const go = (dir: number) => {
                if (!arr.length) return;
                const next = (playerIndex + dir + arr.length) % arr.length;
                setPlayerIndex(next);
                setPlayerUrl(arr[next]);
              };
              return (
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => go(-1)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
                    <span>Trước</span>
                  </button>
                  <div className="text-sm text-zinc-500">{arr.length ? `Media ${playerIndex + 1}/${arr.length}` : ""}</div>
                  <button
                    onClick={() => go(1)}
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <span>Sau</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg>
                  </button>
                </div>
              );
            })()}
            <div className="rounded-lg overflow-hidden bg-black">
              {isLikelyVideo(playerUrl) ? (
                <VideoWithFallback url={playerUrl} title={viewing?.name || viewing?.code || "Media"} className="w-full h-[60vh]" />
              ) : getDriveIdFromUrl(playerUrl) ? (
                <iframe
                  src={`https://drive.google.com/file/d/${getDriveIdFromUrl(playerUrl)}/preview`}
                  title={viewing?.name || viewing?.code || "Media"}
                  className="w-full h-[60vh]"
                  allow="autoplay; fullscreen"
                  loading="lazy"
                />
              ) : (
                <ImgWithFallback url={playerUrl} alt={viewing?.name || viewing?.code || "Media"} className="w-full max-h-[60vh] object-contain bg-black" />
              )}
            </div>
            <div className="mt-3 text-right">
              <a href={playerUrl} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline text-sm dark:text-emerald-400">Mở media gốc</a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
