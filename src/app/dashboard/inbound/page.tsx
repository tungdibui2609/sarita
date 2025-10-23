"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { exportInboundExcel, type ExcelDoc } from "@/lib/excelExport";

type Line = { id: number; product: string; unit: string; qty: number; code?: string; memo?: string };
type Doc = {
  id: number;
  code: string;
  date: string; // YYYY-MM-DD
  time?: string;
  warehouse: string;
  createdBy?: string; // Người nhập
  receiver?: string; // Người nhận
  sender?: string; // Người gửi
  items: number;
  quantity: number;
  description?: string; // Diễn giải (J)
  source?: string; // Nguồn dữ liệu (L)
  slug?: string; // Link slug (sheet cột N)
  lines: Line[];
};

type Warehouse = { id?: string; name: string; isDefault?: boolean };
// Warehouses loaded from API
type SimpleProduct = { code: string; name: string; group?: string; description?: string; uomSmall?: string; uomMedium?: string; uomLarge?: string };
// Trạng thái đã bỏ theo yêu cầu; giữ cấu trúc đơn giản dựa vào dữ liệu nhập

function dateToStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Convert yyyy-mm-dd -> ddmmyy (for code segment)
function dateStrToDDMMYY(dateStr: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return "";
  return `${d.padStart(2, "0")}${m.padStart(2, "0")}${y.slice(-2)}`;
}

function makeInboundCodePrefix(dateStr: string) {
  const seg = dateStrToDDMMYY(dateStr);
  return `PNK${seg}`; // PNK + ddmmyy
}

function computeNextInboundCode(dateStr: string, docs: Doc[]) {
  const prefix = makeInboundCodePrefix(dateStr);
  let maxSeq = 0;
  for (const d of docs) {
    const code = (d.code || "").toString().trim();
    if (!code.startsWith(prefix)) continue;
    const m = code.slice(prefix.length).match(/^(\d{1,3})$/); // parse up to 3 digits suffix
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n)) maxSeq = Math.max(maxSeq, n);
    }
  }
  const next = maxSeq + 1;
  const suffix = String(next).padStart(2, "0"); // default width 2
  return prefix + suffix;
}

// Small component to fetch and display logs for a given inbound code
function LogsSection({ code }: { code: string }) {
  const [logs, setLogs] = useState<Array<{ timestamp: string; user: string; action: string; details: string; slug?: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/inbound/logs?code=${encodeURIComponent(code)}`);
        const j = await res.json();
        if (!mounted) return;
        if (j?.ok && Array.isArray(j.logs)) {
              setLogs(j.logs);
            } else {
              setLogs([]);
            }
      } catch {
        setLogs([]);
      } finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, [code]);

  return (
    <div className="mt-6">
      <h4 className="font-medium mb-2">Lịch sử (phieunhap_log)</h4>
      <div className="rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 p-3 text-sm">
        {loading && <div className="text-zinc-500">Đang tải lịch sử...</div>}
        {!loading && !logs.length && <div className="text-zinc-500">Không có lịch sử</div>}
        {!loading && logs.length > 0 && (
          <ul className="space-y-3">
            {logs.map((l, idx) => (
              <li key={idx} className="border-l-2 pl-3 py-1 border-zinc-200 dark:border-zinc-800">
                <div className="text-xs text-zinc-500">{l.timestamp} • {l.user} • {l.action}{l.slug ? ` • ${l.slug}` : ''}</div>
                <div className="whitespace-pre-line text-zinc-700 dark:text-zinc-200">{l.details}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Versions UI: fetch available versions and allow previewing a snapshot
function VersionsSection({ code, onPreview }: { code: string; onPreview: (_snapshot: any, _version?: number) => void }) {
  const [versions, setVersions] = useState<Array<{ version: number; timestamp: string; user: string; data: any }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/inbound/versions?code=${encodeURIComponent(code)}`);
        const j = await res.json();
        if (!mounted) return;
    if (j?.ok && Array.isArray(j.versions)) setVersions(j.versions);
    else setVersions([]);
  } catch { setVersions([]); }
      finally { if (mounted) setLoading(false); }
    }
    load();
    return () => { mounted = false; };
  }, [code]);

  return (
    <div className="mt-6">
      <h4 className="font-medium mb-2">Phiên bản (versions)</h4>
      <div className="rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 p-3 text-sm">
        {loading && <div className="text-zinc-500">Đang tải phiên bản...</div>}
        {!loading && !versions.length && <div className="text-zinc-500">Không có phiên bản</div>}
        {!loading && versions.length > 0 && (
          <ul className="space-y-2">
            {versions.map((v, i) => {
              const palettes = [
                { border: 'border-emerald-400', dot: 'bg-emerald-400' },
                { border: 'border-sky-400', dot: 'bg-sky-400' },
                { border: 'border-amber-400', dot: 'bg-amber-400' },
                { border: 'border-rose-400', dot: 'bg-rose-400' },
                { border: 'border-indigo-400', dot: 'bg-indigo-400' },
                { border: 'border-lime-400', dot: 'bg-lime-400' },
              ];
              const p = palettes[(v.version ?? i) % palettes.length];
              return (
                <li key={v.version} className={["flex items-center justify-between border-l-4 pl-3 py-2", p.border].join(' ')}>
                  <div className="flex items-center gap-3">
                    <span className={["w-3 h-3 rounded-full", p.dot].join(' ')} />
                    <div className="text-xs text-zinc-600">v{v.version} • {v.timestamp} • {v.user}</div>
                  </div>
                  <div>
                    <button onClick={() => onPreview(v.data, v.version)} className="px-2 py-1 rounded-md border border-zinc-200 text-sm mr-2">Xem</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function _genDocs(n = 24): Doc[] {
  const today = new Date();
  const arr: Doc[] = [];
  for (let i = 1; i <= n; i++) {
    const daysAgo = Math.floor(Math.random() * 28);
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    const lines: Line[] = Array.from({ length: 1 + (i % 3) }).map((_, idx) => ({
      id: idx + 1,
      product: `SP-${(i * 7 + idx + 3).toString().padStart(4, "0")}`,
      unit: "",
      qty: 5 + ((i + idx) % 7),
    }));
    const qty = lines.reduce((s, l) => s + l.qty, 0);
    arr.push({
      id: i,
      code: `PNK${String(i).padStart(5, "0")}`,
      date: dateToStr(d),
      warehouse: ["Kho Tổng", "Kho Nguyên liệu", "Kho Thành phẩm"][i % 3],
      createdBy: `NV${((i % 6) + 1).toString().padStart(2, "0")}`,
      items: lines.length,
      quantity: qty,
  description: i % 4 === 0 ? "Phiếu nhập hàng tuần" : undefined,
      source: undefined,
      lines,
    });
  }
  return arr;
}

export default function InboundPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [warehouse, setWarehouse] = useState<string | "Tất cả">("Tất cả");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [viewing, setViewing] = useState<Doc | null>(null);
  const [previewSnapshot, setPreviewSnapshot] = useState<any | null>(null);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const [imageModalLoading, setImageModalLoading] = useState(false);
  const [imageModalError, setImageModalError] = useState<string | null>(null);
  const imageModalRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imgScale, setImgScale] = useState(1);
  const [imgTranslate, setImgTranslate] = useState({ x: 0, y: 0 });
  // Cache blob ảnh theo mã phiếu
  const imageBlobCache = useRef<{ [code: string]: Blob }>({});

  // Reset zoom/translate each time modal opens/closes
  useEffect(() => {
    if (!imageModalOpen) {
      setImgScale(1);
      setImgTranslate({ x: 0, y: 0 });
      // exit fullscreen if open
      if (document.fullscreenElement) {
        try { document.exitFullscreen?.(); } catch {}
      }
      setIsFullscreen(false);
    }
  }, [imageModalOpen]);

  // Track fullscreen state changes
  useEffect(() => {
    function onFs() { setIsFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const [productMap, setProductMap] = useState<Map<string, any>>(new Map());
  const [products, setProducts] = useState<SimpleProduct[]>([]);
  const [uoms, setUoms] = useState<string[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [receiverRows, setReceiverRows] = useState<Array<{ name: string; [k: string]: string }>>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [openSuggestFor, setOpenSuggestFor] = useState<number | null>(null);
  const [suggestUp, setSuggestUp] = useState<boolean>(false);
  const [suggestWidth, setSuggestWidth] = useState<number | null>(null);

  // Build receiver options list from settings sheet (keys like NGUOI_NHAN, NGUOI_NHAN_1.., and TEXT7 fallback) and explicit receiver rows
  const receiverOptions = useMemo(() => {
    const seen = new Set<string>();
    const add = (v?: string) => {
      const s = (v || "").toString().trim();
      if (!s) return; const key = s.toLowerCase(); if (!seen.has(key)) { seen.add(key); out.push(s); }
    };
    const out: string[] = [];
    const s = settings || {};
    // Include names from receiver rows (column A)
    for (const r of receiverRows) { if (r && typeof r.name === "string") add(r.name); }
    const keys = Object.keys(s);
    for (const k of keys) {
      if (/^NGUOI_?NHAN(\d+)?$/i.test(k)) add((s as any)[k]);
    }
    // Also include TEXT7 if used as receiver in print placeholders
    if ((s as any).TEXT7) add((s as any).TEXT7);
    // Fallback: if nothing matched, include the first few values from column B
    if (out.length === 0) {
      for (const v of Object.values(s)) { add(v as string); if (out.length >= 5) break; }
    }
    return out;
  }, [settings, receiverRows]);

  // Load receiver rows mapping (B..I from caidatphieunhap; B = name, C..I = TEXT1..TEXT7)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/settings/inbound/receivers", { cache: "no-store" });
        const js = await res.json();
        if (!alive) return;
        const list = Array.isArray(js?.receivers) ? js.receivers : [];
        setReceiverRows(list);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/inbound", { cache: "no-store" });
        const js = await res.json();
        if (!alive) return;
        if (js?.ok && Array.isArray(js.docs)) {
          const mapped: Doc[] = js.docs.map((d: any, idx: number) => ({
            id: idx + 1,
            code: d.code || "",
            date: normalizeDate(d.date || ""),
            time: d.time || "",
            warehouse: d.warehouse || "",
            createdBy: d.createdBy || d.user || "",
            receiver: d.receiver || d.nguoiNhan || "",
            sender: d.sender || d.nguoiGui || "",
            items: Number(d.items || (d.lines?.length ?? 0)) || 0,
            quantity: Number(d.quantity || 0) || 0,
            description: d.description || d.note || "",
            source: d.source || "",
            slug: d.slug || "",
            lines: Array.isArray(d.lines)
              ? d.lines.map((l: any, i: number) => ({
                  id: i + 1,
                  product: `${l.productCode || ""}${l.productName ? " - " + l.productName : ""}`.trim(),
                  code: l.productCode || undefined,
                  unit: l.unit || "",
                  qty: Number(l.qty || 0),
                  memo: l.memo || "",
                }))
              : [],
          }));
          setDocs(mapped);
        }
      } catch {}
      finally { setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  // Load inbound settings from server (Google Sheets)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/settings/inbound", { cache: "no-store" });
        const js = await res.json();
        if (!alive) return;
        setSettings((js?.settings || {}) as Record<string, string>);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  // Load warehouses
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/warehouses", { cache: "no-store" });
        const js = await res.json();
        if (!alive) return;
        const list = Array.isArray(js?.warehouses) ? js.warehouses : [];
        setWarehouses(list);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  // Chỉ định kho lọc mặc định = kho có cờ default trong sheet
  useEffect(() => {
    const def = warehouses.find(w => w.isDefault)?.name;
    if (def) setWarehouse((cur) => (cur && cur !== "Tất cả" ? cur : def));
  }, [warehouses]);

  // Khi mở modal tạo mới và chưa có kho, tự chọn kho mặc định
  useEffect(() => {
    if (!showModal) return;
    if (!editing || editing.id !== 0) return; // chỉ áp cho phiếu mới
    if (editing.warehouse) return;
    const def = warehouses.find(w => w.isDefault)?.name;
    if (def) setEditing(prev => prev ? { ...(prev as Doc), warehouse: def } : prev);
  }, [showModal, editing, warehouses]);

  // Bỏ tự động set kho mặc định theo cài đặt; người dùng tự chọn khi tạo phiếu

  // Load products to build a conversion map for kg
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        const js = await res.json();
        if (!alive) return;
        const arr = Array.isArray(js?.products) ? js.products : [];
        const map = new Map<string, any>();
        const list: SimpleProduct[] = [];
        for (const p of arr) {
          const code = (p.code || "").toString().trim();
          if (!code) continue;
          map.set(code, {
            uomSmall: (p.uomSmall || "").toString().trim(),
            uomMedium: (p.uomMedium || "").toString().trim(),
            uomLarge: (p.uomLarge || "").toString().trim(),
            rSM: parseFloat((p.ratioSmallToMedium || "").toString().replace(/,/g, ".")) || 0,
            rML: parseFloat((p.ratioMediumToLarge || "").toString().replace(/,/g, ".")) || 0,
          });
          list.push({
            code,
            name: (p.name || "").toString(),
            group: (p.group || "").toString(),
            description: (p.description || "").toString(),
            uomSmall: p.uomSmall,
            uomMedium: p.uomMedium,
            uomLarge: p.uomLarge,
          });
        }
        setProductMap(map);
        setProducts(list);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  // Load UOMs (from Products column O via API)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/products/uoms", { cache: "no-store" });
        const js = await res.json();
        if (!alive) return;
        const arr = Array.isArray(js?.uoms) ? js.uoms : [];
        setUoms(arr);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  function normalizeUom(u: string | undefined) {
    return (u || "").toString().trim().toLowerCase();
  }
  function stripAccents(str: string) {
    try { return str.normalize("NFD").replace(/\p{Diacritic}+/gu, ""); } catch { return str; }
  }
  function filterProducts(query: string, limit = 8): SimpleProduct[] {
    const q = (query || "").trim().toLowerCase();
    if (!q) return products.slice(0, Math.min(limit, products.length));
    const q2 = stripAccents(q);
    const out: SimpleProduct[] = [];
    for (const p of products) {
      const code = (p.code || "").toString();
      const name = (p.name || "").toString();
      const grp = (p.group || "").toString();
      const desc = (p.description || "").toString();
      const hay = `${code} ${name} ${grp} ${desc}`.toLowerCase();
      const hay2 = stripAccents(hay);
      if (hay.includes(q) || hay2.includes(q2)) {
        out.push(p);
        if (out.length >= limit) break;
      }
    }
    return out;
  }
  function qtyToKg(line: Line): number | null {
    const code = (line.code || (line.product || "").split(" - ")[0]).trim();
    if (!code) return null;
    const prod = productMap.get(code);
    if (!prod) return null;
    const uSmall = normalizeUom(prod.uomSmall);
    const uMed = normalizeUom(prod.uomMedium);
    const uLarge = normalizeUom(prod.uomLarge);
    const rSM = Number(prod.rSM) || 0; // small per 1 medium
    const rML = Number(prod.rML) || 0; // medium per 1 large
    const unit = normalizeUom(line.unit);
    const isKgSmall = uSmall === normalizeUom("Kg");
    const isKgMed = uMed === normalizeUom("Kg");
    const isKgLarge = uLarge === normalizeUom("Kg");
    if (!isKgSmall && !isKgMed && !isKgLarge) return null;
    const qty = Number(line.qty) || 0;
    if (isKgSmall) {
      if (unit === uSmall) return qty;
      if (unit === uMed) return rSM > 0 ? qty * rSM : null;
      if (unit === uLarge) return rSM > 0 && rML > 0 ? qty * rSM * rML : null;
      return null;
    }
    if (isKgMed) {
      if (unit === uMed) return qty;
      if (unit === uSmall) return rSM > 0 ? qty / rSM : null;
      if (unit === uLarge) return rML > 0 ? qty * rML : null;
      return null;
    }
    // kg is large
    if (unit === uLarge) return qty;
    if (unit === uMed) return rML > 0 ? qty / rML : null;
    if (unit === uSmall) return rSM > 0 && rML > 0 ? qty / (rSM * rML) : null;
    return null;
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const nameToId = new Map<string, string>();
    for (const w of warehouses) {
      if (!w) continue;
      const nm = (w.name || "").toString();
      const id = (w.id || "").toString();
      if (nm) nameToId.set(nm, id);
    }
    return docs.filter((d) => {
      const whName = d.warehouse || "";
      const whId = nameToId.get(whName) || "";
      const matchesQ = q
        ? [d.code, d.createdBy ?? "", d.description ?? "", d.source ?? "", whName, whId]
            .some((v) => (v || "").toString().toLowerCase().includes(q))
        : true;
      const matchesWh = warehouse === "Tất cả" ? true : d.warehouse === warehouse;
      const df = dateFrom ? new Date(dateFrom) : null;
      const dt = dateTo ? new Date(dateTo) : null;
      const dd = new Date(d.date);
      const matchesFrom = df ? dd >= df : true;
      const matchesTo = dt ? dd <= dt : true;
      return matchesQ && matchesWh && matchesFrom && matchesTo;
    });
  }, [docs, query, warehouse, dateFrom, dateTo, warehouses]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  function onCreate() {
    const todayStr = dateToStr(new Date());
  const code = computeNextInboundCode(todayStr, docs);
    // Không tự đặt kho mặc định nữa; bắt buộc người dùng chọn
    const defaultWh = "";
    // Lấy người dùng hiện tại từ localStorage
    let currentUser = "";
    try {
      currentUser = localStorage.getItem("userName") || localStorage.getItem("userUsername") || "";
    } catch {}
    // Lấy giá trị mặc định cho Người nhận từ cột B (hàng 2) của sheet 'caidatphieunhap'
    // API /api/settings/inbound trả về object theo thứ tự chèn => Object.values(settings)[0] ~ ô B2
    const defaultReceiver = (receiverOptions[0] || (settings && (settings as any).NGUOI_NHAN) || (settings && (settings as any).TEXT7) || Object.values(settings || {})[0] || "");
    setEditing({
      id: 0,
      code,
      date: todayStr,
      warehouse: defaultWh,
      createdBy: currentUser,
      receiver: (defaultReceiver || "").toString(),
      items: 0,
      quantity: 0,
      description: "",
      source: "",
      lines: [],
    });
    setShowModal(true);
  }
  function onEdit(d: Doc) { setEditing({ ...d, lines: d.lines.map(l => ({ ...l })) }); setShowModal(true); }
  async function onDelete(d: Doc) {
    if (!confirm(`Xóa phiếu ${d.code}?`)) return;
    try {
      const currentUser = (() => { try { return localStorage.getItem('userName') || localStorage.getItem('userUsername') || ''; } catch { return ''; } })();
      const res = await fetch('/api/inbound', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: d.code, user: currentUser }) });
      const js = await res.json();
      if (!js?.ok) { alert('Xóa thất bại: ' + (js?.error || 'Lỗi server')); return; }
      // Remove from UI after successful server delete
      setDocs((prev) => prev.filter((x) => x.id !== d.id));
    } catch (e: any) { alert('Lỗi xóa: ' + (e?.message || e)); }
  }
  function addLine() {
    if (!editing) return;
    const nextId = (editing.lines.at(-1)?.id ?? 0) + 1;
    const defaultUnit = uoms[0] || "";
    setEditing({ ...editing, lines: [...editing.lines, { id: nextId, product: "", unit: defaultUnit, qty: 1 }] });
  }
  function removeLine(id: number) {
    if (!editing) return;
    setEditing({ ...editing, lines: editing.lines.filter((l) => l.id !== id) });
  }
  function saveDoc() {
    if (!editing || saving) return;
    // Auto-generate code for new doc based on selected date
    if (editing.id === 0) {
      // code will be generated server-side to avoid collisions; UI keeps showing client-estimate
    }
  if (!editing.date) { alert("Vui lòng nhập Ngày"); return; }
  if (!editing.warehouse) { alert("Vui lòng chọn Kho"); return; }
    // Ensure creator is present (fallback to local if missing)
    if (!editing.createdBy) {
      try {
        const fallback = localStorage.getItem("userName") || localStorage.getItem("userUsername") || "";
        if (fallback) editing.createdBy = fallback;
      } catch {}
    }
    // Validate line items
    const invalid = editing.lines.some((l) => {
      const code = (l.code || (l.product || "").split(" - ")[0]).trim();
      const qty = Number(l.qty) || 0;
      return !code || !l.unit || qty <= 0;
    });
    if (invalid) { alert("Vui lòng chọn sản phẩm, đơn vị và số lượng > 0 cho mỗi dòng"); return; }
    const qty = editing.lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    editing.items = editing.lines.length;
    editing.quantity = qty;
    (async () => {
      try {
        setSaving(true);
        if (editing.id === 0) {
          const payload = {
            date: editing.date,
            time: editing.time || "",
            warehouse: editing.warehouse,
            createdBy: editing.createdBy || "",
            // actor performing the request
            user: (() => { try { return localStorage.getItem('userName') || localStorage.getItem('userUsername') || editing.createdBy || ''; } catch { return editing.createdBy || ''; } })(),
            receiver: editing.receiver || "",
            description: editing.description || "",
            source: editing.source || "",
            lines: editing.lines.map(l => ({ code: l.code, product: l.product, unit: l.unit, qty: l.qty, memo: l.memo || "" })),
            // Add log entry for creation
            logEntry: (() => {
              try {
                const now = new Date();
                const hh = String(now.getHours()).padStart(2, '0');
                const mm = String(now.getMinutes()).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                const mo = String(now.getMonth() + 1).padStart(2, '0');
                const yyyy = now.getFullYear();
                const user = (editing.createdBy || localStorage.getItem('userName') || localStorage.getItem('userUsername') || '').toString();
                return `Lúc ${hh}:${mm} - ${dd}/${mo}/${yyyy} - ${user} - Đã tạo phiếu mới, chưa chỉnh sửa.`;
              } catch { return '' }
            })(),
          };
          const res = await fetch("/api/inbound", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          const js = await res.json();
          if (!js?.ok) throw new Error(js?.error || "Không lưu được phiếu");
          const d = js.doc;
          const mapped: Doc = {
            id: (docs.length ? Math.max(...docs.map((x) => x.id)) + 1 : 1),
            code: d.code,
            date: d.date,
            time: d.time,
            warehouse: d.warehouse,
            createdBy: d.createdBy,
            receiver: d.receiver || d.nguoiNhan || "",
        sender: d.sender || d.nguoiGui || "",
            slug: d.slug || "",
            items: Number(d.items || (d.lines?.length ?? 0)) || 0,
            quantity: Number(d.quantity || 0) || 0,
            description: d.description || d.note || "",
            source: d.source || "",
            lines: Array.isArray(d.lines) ? d.lines.map((l: any, i: number) => ({ id: i + 1, product: `${l.productCode || ""}${l.productName ? " - " + l.productName : ""}`.trim(), code: l.productCode || undefined, unit: l.unit || "", qty: Number(l.qty || 0), memo: l.memo || "" })) : [],
          };
          setDocs(prev => [mapped, ...prev]);
        } else {
          // For edit: prepare a log entry and send PATCH to update sheet rows
          try {
            // Compute a simple diff description for changed fields (date, warehouse, description, receiver, lines count)
            const current = docs.find(x => x.id === editing.id);
            const changes: string[] = [];
            if (current) {
              if ((current.date || '') !== (editing.date || '')) changes.push(`Thay đổi ngày: "${current.date}" => "${editing.date}"`);
              if ((current.warehouse || '') !== (editing.warehouse || '')) changes.push(`Thay đổi kho: "${current.warehouse}" => "${editing.warehouse}"`);
              if ((current.receiver || '') !== (editing.receiver || '')) changes.push(`Thay đổi người nhận: "${current.receiver}" => "${editing.receiver}"`);
              if ((current.description || '') !== (editing.description || '')) changes.push(`Thay đổi diễn giải`);
              if ((current.lines?.length || 0) !== (editing.lines?.length || 0)) changes.push(`Thay đổi số dòng: ${current.lines?.length || 0} => ${editing.lines?.length || 0}`);
            }
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const mo = String(now.getMonth() + 1).padStart(2, '0');
            const yyyy = now.getFullYear();
            const user = (editing.createdBy || localStorage.getItem('userName') || localStorage.getItem('userUsername') || '').toString();
            const logEntry = `Lúc ${hh}:${mm} - ${dd}/${mo}/${yyyy} - ${user} - ${changes.length ? changes.join('; ') : 'Đã cập nhật phiếu.'}`;

            const patchPayload = {
              code: editing.code,
              date: editing.date,
              time: editing.time || '',
              warehouse: editing.warehouse,
              createdBy: editing.createdBy || '',
              // actor performing this update
              user: (() => { try { return localStorage.getItem('userName') || localStorage.getItem('userUsername') || editing.createdBy || ''; } catch { return editing.createdBy || ''; } })(),
              receiver: editing.receiver || '',
              description: editing.description || '',
              source: editing.source || '',
              lines: editing.lines.map(l => ({ code: l.code, product: l.product, unit: l.unit, qty: l.qty, memo: l.memo || '' })),
              logEntry,
            };
            const res = await fetch('/api/inbound', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patchPayload) });
            const js = await res.json();
            if (!js?.ok) throw new Error(js?.error || 'Không cập nhật được phiếu');
            // Update UI
            setDocs((prev) => prev.map((x) => (x.id === editing.id ? editing : x)));
          } catch (err: any) {
            alert('Lỗi khi cập nhật phiếu: ' + (err?.message || err));
          }
        }
        setShowModal(false);
        setEditing(null);
      } catch (e: any) {
        alert(e?.message || "Lỗi không xác định khi lưu");
      } finally {
        setSaving(false);
      }
    })();
  }

  function toggleSelect(id: number) {
    setSelected((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }
  function toggleSelectAllPage() {
    const pageIds = items.map(i => i.id);
    const allSelected = pageIds.every(id => selected.includes(id));
    if (allSelected) setSelected(prev => prev.filter(id => !pageIds.includes(id)));
    else setSelected(prev => Array.from(new Set([...prev, ...pageIds])));
  }
  
  async function exportSelectedExcel() {
    if (selected.length === 0) { alert("Vui lòng chọn ít nhất 1 phiếu để xuất"); return; }
    if (downloading) return;
    const dataSel = docs.filter((d) => selected.includes(d.id));
    if (dataSel.length === 0) { alert("Không có dữ liệu phù hợp để xuất"); return; }
  const _senderName = settings.NGUOI_GUI || "";
  const _phDept = settings.BO_PHAN || "";
  const _phFullName = settings.HO_TEN || "";
    const docsPayload: ExcelDoc[] = dataSel.map((d) => ({
      code: d.code,
      date: d.date,
      time: d.time,
      warehouse: d.warehouse,
      createdBy: d.createdBy,
  receiver: d.receiver || (d as any).nguoiNhan,
  sender: d.sender,
      description: d.description,
      lines: d.lines.map((l) => ({
        product: l.product,
        code: l.code,
        unit: l.unit,
        qty: l.qty,
        memo: l.memo,
        kg: qtyToKg(l),
      })),
    }));
    setDownloading(true);
    try {
      // Nếu xuất 1 phiếu và có placeholder, gửi xuống API để thay thế trong template
      const single = docsPayload.length === 1;
      if (single) {
        const payload: any = { docs: docsPayload };
        // Build placeholders. Prefer receiver-specific TEXT1..TEXT7 from mapping rows
        const placeholders: Record<string, string> = {};
        for (const [k, v] of Object.entries(settings)) {
          if (!k) continue; placeholders[k] = String(v ?? "");
        }
        const only = dataSel[0];
        if (only?.receiver) {
          const row = receiverRows.find(r => (r?.name || "").toString().trim().toLowerCase() === (only.receiver || "").toString().trim().toLowerCase());
          if (row) {
            for (let i = 1; i <= 7; i++) {
              const key = `TEXT${i}`;
              const val = (row as any)[key];
              if (val != null && val !== "") placeholders[key] = String(val);
            }
          }
        }
        if (Object.keys(placeholders).length > 0) payload.placeholders = placeholders;
        const res = await fetch("/api/inbound/print-excel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const today = dateToStr(new Date());
        a.href = url; a.download = `phieu-nhap-${today}.xlsx`; a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const blob = await exportInboundExcel(single ? docsPayload[0] : docsPayload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = dateToStr(new Date());
      a.href = url; a.download = `phieu-nhap-${today}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "Xuất Excel thất bại");
    } finally {
      setDownloading(false);
    }
  }

  async function downloadSelectedImage() {
    if (selected.length !== 1) { alert("Vui lòng chọn đúng 1 phiếu để tải ảnh"); return; }
    const d = docs.find(x => x.id === selected[0]);
    if (!d) { alert("Không tìm thấy phiếu đã chọn"); return; }
    if (downloading) return;
    setDownloading(true);
    try {
      const slugOrCode = d.slug || d.code;
      const res = await fetch(`/api/inbound/print-image?code=${encodeURIComponent(slugOrCode)}`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `phieu-nhap-${(d.code || d.slug || "unnamed").toString()}.png`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "Tải ảnh thất bại");
    } finally {
      setDownloading(false);
    }
  }

  async function printSelectedHtml() {
    if (selected.length !== 1) { alert("Vui lòng chọn đúng 1 phiếu để in"); return; }
    const d = docs.find(x => x.id === selected[0]);
    if (!d) { alert("Không tìm thấy phiếu đã chọn"); return; }
    try {
  const slugOrCode = d.slug || d.code;
  const url = `/xhd/${encodeURIComponent(slugOrCode)}`;
      window.open(url, "_blank");
    } catch (e: any) {
      alert(e?.message || "Không mở được trang in");
    }
  }

  function normalizeDate(d: string) {
    // dd/mm/yyyy -> yyyy-mm-dd (Sheet mẫu đang như ảnh)
    const m = (d || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const dd = m[1].padStart(2, "0");
      const mm = m[2].padStart(2, "0");
      const yyyy = m[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    return d || "";
  }

  function _formatDMY(dateStr: string) {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }
  function _formatDateLine(dateStr: string) {
    const d = new Date(dateStr);
    return `Ngày ${d.getDate()} tháng ${d.getMonth() + 1} năm ${d.getFullYear()}`;
  }
  

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Nhập kho</h1>
        <button onClick={onCreate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white text-sm px-3 py-2 hover:bg-emerald-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tạo phiếu nhập
        </button>
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-900/70 backdrop-blur p-4 ring-1 ring-black/5">
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); setSelected([]); }} placeholder="Tìm theo số phiếu" className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 bg-white/60 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
            </div>
          </div>
          <select value={warehouse} onChange={(e) => { setWarehouse(e.target.value); setPage(1); setSelected([]); }} className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
            <option value="Tất cả">Tất cả kho</option>
            {warehouses.map((w) => (
              <option key={(w.id || w.name)} value={w.name}>{w.name}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); setSelected([]); }} className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); setSelected([]); }} className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
          <div className="lg:col-span-6 flex flex-wrap items-center gap-2 pt-1 justify-start lg:justify-end">
            
            <button onClick={printSelectedHtml} disabled={selected.length !== 1 || downloading} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 text-sm dark:border-zinc-700 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 3 18 3 18 9"/><rect x="6" y="13" width="12" height="8"/><line x1="6" y1="17" x2="6" y2="17"/></svg>
              In
            </button>
            <button onClick={downloadSelectedImage} disabled={selected.length !== 1 || downloading} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 text-sm dark:border-zinc-700 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              Tải ảnh
            </button>
            <button onClick={exportSelectedExcel} disabled={selected.length === 0 || downloading} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 text-sm dark:border-zinc-700 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {downloading ? 'Đang tải…' : 'Xuất Excel'}
            </button>
          </div>
        </div>
      </div>
      {/* Table */}
      <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-900/70 backdrop-blur ring-1 ring-black/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50/70 dark:bg-zinc-800/50 text-zinc-500">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" className="rounded" onChange={toggleSelectAllPage} checked={items.length > 0 && items.every(i => selected.includes(i.id))} aria-label="Chọn tất cả" />
                </th>
                <th className="text-left font-medium px-4 py-3">Số phiếu</th>
                <th className="text-left font-medium px-4 py-3">Ngày</th>
                <th className="text-left font-medium px-4 py-3">Người nhập</th>
                <th className="text-left font-medium px-4 py-3">Diễn giải</th>
                <th className="text-right font-medium px-4 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-sm text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/20">Đang tải dữ liệu…</td>
                </tr>
              )}
              {items.map((d) => (
                <tr key={d.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded" checked={selected.includes(d.id)} onChange={() => toggleSelect(d.id)} aria-label={`Chọn ${d.code}`} />
                  </td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                    <button onClick={() => setViewing(d)} className="text-emerald-700 hover:underline dark:text-emerald-300">
                      {d.code}
                    </button>
                  </td>
                  <td className="px-4 py-3">{d.date}</td>
                  <td className="px-4 py-3">{d.createdBy}</td>
                  <td className="px-4 py-3">{d.description}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button onClick={async () => {
                        const slugOrCode = d.slug || d.code;
                        setImageModalError(null);
                        setImageModalLoading(true);
                        setImageModalOpen(true);
                        // Kiểm tra cache trước
                        if (imageBlobCache.current[slugOrCode]) {
                          try {
                            const objUrl = URL.createObjectURL(imageBlobCache.current[slugOrCode]);
                            setImageModalUrl(objUrl);
                            return;
                          } finally {
                            setImageModalLoading(false);
                          }
                        }

                        const url = `/api/inbound/print-image?code=${encodeURIComponent(slugOrCode)}&view=inline`;
                        const controller = new AbortController();
                        const timeoutMs = 30000; // 30s client-side timeout
                        const to = setTimeout(() => controller.abort(), timeoutMs);
                        try {
                          const res = await fetch(url, { signal: controller.signal });
                          if (!res.ok) {
                            const txt = await res.text().catch(() => `HTTP ${res.status}`);
                            throw new Error(txt || `HTTP ${res.status}`);
                          }
                          const contentType = (res.headers.get('content-type') || '').toLowerCase();
                          // Read as ArrayBuffer to avoid streaming edge cases and construct blob explicitly
                          const ab = await res.arrayBuffer();
                          const blob = new Blob([ab], { type: contentType || 'image/png' });
                          if (blob.size === 0) throw new Error('Ảnh rỗng (0 byte)');
                          // Cache and show
                          imageBlobCache.current[slugOrCode] = blob;
                          const objUrl = URL.createObjectURL(blob);
                          setImageModalUrl(objUrl);
                        } catch (err: any) {
                          if (err && err.name === 'AbortError') {
                            setImageModalError('Quá thời gian chờ tải ảnh (timeout)');
                          } else {
                            setImageModalError(err?.message || 'Không tải được ảnh');
                          }
                          setImageModalUrl(null);
                        } finally {
                          clearTimeout(to);
                          setImageModalLoading(false);
                        }
                      }} className="px-2 py-1 rounded-md text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-900/20">Xem ảnh</button>
                      <button onClick={() => onEdit(d)} className="px-2 py-1 rounded-md text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20">Sửa</button>
                      <button onClick={() => onDelete(d)} className="px-2 py-1 rounded-md text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20">Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Không có dữ liệu phù hợp</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <div className="text-zinc-500">Trang {currentPage}/{totalPages} — {filtered.length} phiếu</div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>Trước</button>
            <button className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Sau</button>
          </div>
        </div>
      </div>

      {/* Modal Create/Edit */}
      {/* Downloading overlay */}
      {downloading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative z-50 pointer-events-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-6 py-4 shadow-xl flex items-center gap-3">
            <svg className="animate-spin text-emerald-600" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity="0.2" /><path d="M22 12a10 10 0 0 1-10 10" /></svg>
            <div className="text-sm font-medium">Đang tải tệp, vui lòng chờ…</div>
          </div>
        </div>
      )}
      {/* Image preview modal */}
      {imageModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => {
            // close and cleanup
            setImageModalOpen(false);
            if (imageModalUrl) { URL.revokeObjectURL(imageModalUrl); setImageModalUrl(null); }
            setImageModalError(null);
          }} />
          <div ref={imageModalRef} className="relative z-50 w-[95%] max-w-3xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-lg overflow-hidden shadow-xl p-4">
              <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium">Xem ảnh phiếu</div>
              <div className="flex items-center gap-2">
                <button onClick={async () => {
                  try {
                    const el = imageModalRef.current;
                    if (!el) return;
                    if (!document.fullscreenElement) {
                      await el.requestFullscreen?.();
                      setIsFullscreen(true);
                    } else {
                      await document.exitFullscreen?.();
                      setIsFullscreen(false);
                    }
                  } catch {}
                }} className="px-3 py-1 rounded border border-zinc-200 text-sm">{isFullscreen ? 'Thoát F.S' : 'Full screen'}</button>
                {imageModalUrl && (
                  <a href={imageModalUrl} download className="px-3 py-1 rounded border border-zinc-200 text-sm">Tải</a>
                )}
                <button onClick={() => {
                  setImageModalOpen(false);
                  if (imageModalUrl) { URL.revokeObjectURL(imageModalUrl); setImageModalUrl(null); }
                  setImageModalError(null);
                }} className="px-3 py-1 rounded border border-zinc-200 text-sm">Đóng</button>
              </div>
            </div>
            <div className="flex items-center justify-center w-full h-[70vh] bg-zinc-50 dark:bg-zinc-800 rounded touch-manipulation">
              {imageModalLoading ? (
                <div className="text-sm text-zinc-600">Đang tải ảnh…</div>
              ) : imageModalError ? (
                <div className="text-sm text-red-600">{imageModalError}</div>
              ) : imageModalUrl ? (
                <img
                  ref={imageRef}
                  src={imageModalUrl}
                  alt="Phiếu"
                  className="max-w-full max-h-full object-contain touch-none"
                  style={{ transform: `translate(${imgTranslate.x}px, ${imgTranslate.y}px) scale(${imgScale})` }}
                  onWheel={(e) => {
                    // zoom with wheel: ctrl+wheel to zoom
                    if (!e.ctrlKey) return;
                    e.preventDefault();
                    const delta = e.deltaY > 0 ? -0.1 : 0.1;
                    setImgScale((s) => Math.max(1, Math.min(5, +(s + delta).toFixed(2))));
                  }}
                  onMouseDown={(e) => {
                    if (imgScale <= 1) return;
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const init = { ...imgTranslate };
                    function onMove(ev: MouseEvent) {
                      setImgTranslate({ x: init.x + (ev.clientX - startX), y: init.y + (ev.clientY - startY) });
                    }
                    function onUp() { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }}
                  onTouchStart={(e) => {
                    if (!e.touches) return;
                    if (e.touches.length === 1) {
                      // pan start
                      const t0 = e.touches[0];
                      const sx = t0.clientX;
                      const sy = t0.clientY;
                      const init = { ...imgTranslate };
                      function onTouchMove(ev: TouchEvent) {
                        if (!ev.touches || ev.touches.length !== 1) return;
                        const t = ev.touches[0];
                        setImgTranslate({ x: init.x + (t.clientX - sx), y: init.y + (t.clientY - sy) });
                      }
                      function onTouchEnd() { window.removeEventListener('touchmove', onTouchMove); window.removeEventListener('touchend', onTouchEnd); }
                      window.addEventListener('touchmove', onTouchMove, { passive: false });
                      window.addEventListener('touchend', onTouchEnd);
                    } else if (e.touches.length === 2) {
                      // pinch start
                      const a = e.touches[0]; const b = e.touches[1];
                      const startDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
                      const startScale = imgScale;
                      function onTouchMove(ev: TouchEvent) {
                        if (!ev.touches || ev.touches.length !== 2) return;
                        const a2 = ev.touches[0]; const b2 = ev.touches[1];
                        const d = Math.hypot(a2.clientX - b2.clientX, a2.clientY - b2.clientY);
                        const ratio = d / startDist;
                        setImgScale(Math.max(1, Math.min(5, +(startScale * ratio).toFixed(2))));
                      }
                      function onTouchEnd() { window.removeEventListener('touchmove', onTouchMove); window.removeEventListener('touchend', onTouchEnd); }
                      window.addEventListener('touchmove', onTouchMove, { passive: false });
                      window.addEventListener('touchend', onTouchEnd);
                    }
                  }}
                />
              ) : (
                <div className="text-sm text-zinc-600">Không có ảnh</div>
              )}
            </div>
          </div>
        </div>
      )}
      {showModal && editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowModal(false); setEditing(null); }} />
          <div className="relative w-full max-w-3xl mx-4 my-8 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white dark:bg-zinc-900 p-5 md:p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editing.id ? "Sửa phiếu nhập" : "Tạo phiếu nhập"}</h3>
              <button onClick={() => { setShowModal(false); setEditing(null); }} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-1">Số phiếu</label>
                <input value={editing.code} readOnly={editing.id === 0} onChange={(e) => setEditing({ ...(editing as Doc), code: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-200" />
              </div>
              <div>
                <label className="block text-sm mb-1">Ngày</label>
                <input type="date" value={editing.date} onChange={(e) => {
                  const v = e.target.value;
                  if ((editing as Doc).id === 0) {
                    const newCode = computeNextInboundCode(v, docs);
                    setEditing({ ...(editing as Doc), date: v, code: newCode });
                  } else {
                    setEditing({ ...(editing as Doc), date: v });
                  }
                }} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="block text-sm mb-1">Kho</label>
                <select value={editing.warehouse} onChange={(e) => setEditing({ ...(editing as Doc), warehouse: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                  <option value="">— Chọn kho —</option>
                  {warehouses.map((w) => (
                    <option key={(w.id || w.name)} value={w.name}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Người nhập</label>
                <input value={editing.createdBy ?? ""} readOnly className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-200" />
              </div>
              <div>
                <label className="block text-sm mb-1">Người nhận</label>
                {receiverOptions.length > 0 ? (
                  <select value={editing.receiver ?? ""} onChange={(e) => setEditing({ ...(editing as Doc), receiver: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                    {editing.receiver && !receiverOptions.includes(editing.receiver) && (
                      <option value={editing.receiver}>{editing.receiver}</option>
                    )}
                    <option value="">— Chọn người nhận —</option>
                    {receiverOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input value={editing.receiver ?? ""} onChange={(e) => setEditing({ ...(editing as Doc), receiver: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" placeholder="Tên người nhận hàng" />
                )}
              </div>
              <div>
                <label className="block text-sm mb-1">Nguồn dữ liệu</label>
                <input value={editing.source ?? ""} onChange={(e) => setEditing({ ...(editing as Doc), source: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm mb-1">Diễn giải</label>
                <textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...(editing as Doc), description: e.target.value })} className="w-full h-[40px] min-h-[40px] px-2 py-0 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 resize-none text-sm leading-[38px]" />
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Chi tiết hàng hóa</h4>
              </div>
              <div className="rounded-xl border-0 md:border border-zinc-200/70 dark:border-zinc-800/70 overflow-visible">
                {/* Mobile stacked list */}
                <div className="block md:hidden">
                  {editing.lines.map((l, idx) => (
                    <div
                      key={l.id}
                      className={`mb-2 rounded-xl px-3 py-3 border shadow-sm ${idx % 2 === 1 ? 'bg-emerald-50/80 dark:bg-emerald-900/30 border-emerald-100 dark:border-emerald-900' : 'bg-sky-50/80 dark:bg-sky-900/30 border-sky-100 dark:border-sky-900'}`}
                    >
                      <div className="text-xs text-zinc-500 mb-1">Sản phẩm</div>
                      <div className="relative">
                        <input
                          value={l.product}
                          onFocus={(e) => {
                            setOpenSuggestFor(l.id);
                            try {
                              const rect = (e.target as HTMLInputElement).getBoundingClientRect();
                              const spaceBelow = window.innerHeight - rect.bottom;
                              setSuggestUp(spaceBelow < 280);
                              setSuggestWidth(Math.ceil(rect.width));
                            } catch {}
                          }}
                          onBlur={() => setTimeout(() => setOpenSuggestFor((id) => (id === l.id ? null : id)), 150)}
                          onChange={(e) => {
                            const v = e.target.value;
                            const next = { ...l, product: v } as Line;
                            const m = v.match(/^([^\s-]+)\s*-\s*(.+)$/);
                            if (m) {
                              const code = m[1].trim();
                              const prod = products.find(p => p.code.toLowerCase() === code.toLowerCase());
                              next.code = code;
                              const pref = (prod?.uomSmall || prod?.uomMedium || prod?.uomLarge || '').toString();
                              if (!next.unit && pref) next.unit = pref;
                            } else {
                              const byCode = products.find(p => p.code.toLowerCase() === v.trim().toLowerCase());
                              if (byCode) {
                                next.code = byCode.code;
                                const pref = (byCode.uomSmall || byCode.uomMedium || byCode.uomLarge || '').toString();
                                if (!next.unit && pref) next.unit = pref;
                              } else {
                                next.code = undefined;
                              }
                            }
                            setOpenSuggestFor(l.id);
                            setEditing({ ...(editing as Doc), lines: editing.lines.map(x => x.id === l.id ? next : x) });
                          }}
                          className="w-full px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                          placeholder="Tìm theo mã hoặc tên sản phẩm"
                          inputMode="search"
                        />
                        {openSuggestFor === l.id && (
                          <div
                            className="absolute z-50 rounded-md border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800 max-h-96 overflow-auto whitespace-nowrap"
                            style={{
                              ...(suggestUp ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }),
                              minWidth: (suggestWidth ? Math.max(240, suggestWidth) : 240) + 'px',
                              maxWidth: 'calc(100vw - 48px)',
                              left: 0,
                              right: 'auto'
                            }}
                          >
                            {(() => {
                              const list = filterProducts(l.product, 8);
                              if (!list.length) return (
                                <div className="px-3 py-2 text-sm text-zinc-500">Không có kết quả</div>
                              );
                              return (
                                <ul className="py-1 text-sm">
                                  {list.map((p, i2) => (
                                    <li
                                      key={`${p.code}-${i2}`}
                                      className="px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer leading-6"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        const pref = (p.uomSmall || p.uomMedium || p.uomLarge || '').toString();
                                        const next: Line = { ...l, product: `${p.code} - ${p.name}`, code: p.code, unit: l.unit || pref || '' };
                                        setEditing({ ...(editing as Doc), lines: editing.lines.map(x => x.id === l.id ? next : x) });
                                        setOpenSuggestFor(null);
                                      }}
                                      onTouchStart={(e) => {
                                        e.preventDefault();
                                        const pref = (p.uomSmall || p.uomMedium || p.uomLarge || '').toString();
                                        const next: Line = { ...l, product: `${p.code} - ${p.name}`, code: p.code, unit: l.unit || pref || '' };
                                        setEditing({ ...(editing as Doc), lines: editing.lines.map(x => x.id === l.id ? next : x) });
                                        setOpenSuggestFor(null);
                                      }}
                                    >
                                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{p.code} — {p.name}</div>
                                    </li>
                                  ))}
                                </ul>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs text-zinc-500 mb-1">Đơn vị</div>
                          <select
                            value={l.unit}
                            onChange={(e) => setEditing({ ...(editing as Doc), lines: editing.lines.map(x => x.id === l.id ? { ...x, unit: e.target.value } : x) })}
                            className="w-full px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                          >
                            <option value="">— Chọn đơn vị —</option>
                            {uoms.map((u) => (<option key={u} value={u}>{u}</option>))}
                          </select>
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500 mb-1">Số lượng</div>
                          <input type="number" min={0} value={l.qty} onChange={(e) => setEditing({ ...(editing as Doc), lines: editing.lines.map(x => x.id === l.id ? { ...x, qty: Number(e.target.value) } : x) })} className="w-full text-right px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
                        </div>
                      </div>

                      <div className="mt-2">
                        <div className="text-xs text-zinc-500 mb-1">Ghi chú</div>
                        <input value={l.memo ?? ''} onChange={(e) => setEditing({ ...(editing as Doc), lines: editing.lines.map(x => x.id === l.id ? { ...x, memo: e.target.value } : x) })} className="w-full px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
                      </div>

                      <div className="mt-2 text-right">
                        <button onClick={() => removeLine(l.id)} className="inline-flex px-2 py-1 rounded-md text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20">Xóa</button>
                      </div>
                    </div>
                  ))}
                  {editing.lines.length === 0 && (
                    <div className="px-3 py-6 text-center text-zinc-500">Chưa có dòng hàng hóa</div>
                  )}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-visible">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50/70 dark:bg-zinc-800/50 text-zinc-500">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Sản phẩm</th>
                        <th className="text-left font-medium px-3 py-2">Đơn vị</th>
                        <th className="text-right font-medium px-3 py-2">Số lượng</th>
                        <th className="text-left font-medium px-3 py-2">Ghi chú</th>
                        <th className="text-right font-medium px-3 py-2">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
                      {editing.lines.map((l, idx) => (
                        <tr key={l.id} className={idx % 2 === 1 ? 'bg-emerald-50/60 dark:bg-emerald-900/30' : 'bg-sky-50/60 dark:bg-sky-900/30'}>
                          <td className="px-3 py-2">
                            <div className="relative">
                              <input
                                value={l.product}
                                onFocus={(e) => {
                                  setOpenSuggestFor(l.id);
                                  try {
                                    const rect = (e.target as HTMLInputElement).getBoundingClientRect();
                                    const spaceBelow = window.innerHeight - rect.bottom;
                                    setSuggestUp(spaceBelow < 280);
                                    setSuggestWidth(Math.ceil(rect.width));
                                  } catch {}
                                }}
                                onBlur={() => setTimeout(() => setOpenSuggestFor((id) => (id === l.id ? null : id)), 150)}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const next = { ...l, product: v } as Line;
                                  // Try parse "CODE - Name"
                                  const m = v.match(/^([^\s-]+)\s*-\s*(.+)$/);
                                  if (m) {
                                    const code = m[1].trim();
                                    const prod = products.find(p => p.code.toLowerCase() === code.toLowerCase());
                                    next.code = code;
                                    const pref = (prod?.uomSmall || prod?.uomMedium || prod?.uomLarge || "").toString();
                                    if (!next.unit && pref) next.unit = pref;
                                  } else {
                                    // If user types exact code, DO NOT overwrite input; only set internal code + default unit
                                    const byCode = products.find(p => p.code.toLowerCase() === v.trim().toLowerCase());
                                    if (byCode) {
                                      next.code = byCode.code;
                                      const pref = (byCode.uomSmall || byCode.uomMedium || byCode.uomLarge || "").toString();
                                      if (!next.unit && pref) next.unit = pref;
                                    } else {
                                      next.code = undefined;
                                    }
                                  }
                                  setOpenSuggestFor(l.id);
                                  setEditing({ ...(editing as Doc), lines: editing.lines.map(x => x.id === l.id ? next : x) });
                                }}
                                className="w-full px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                                placeholder="Tìm theo mã hoặc tên sản phẩm"
                              />
                              {openSuggestFor === l.id && (
                                <div
                                  className="absolute z-50 rounded-md border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800 max-h-96 overflow-auto whitespace-nowrap"
                                  style={{
                                    ...(suggestUp ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }),
                                    minWidth: (suggestWidth ? Math.max(240, suggestWidth) : 240) + 'px',
                                    maxWidth: 'calc(100vw - 48px)',
                                    left: 0,
                                    right: 'auto'
                                  }}
                                >
                                  {(() => {
                                    const list = filterProducts(l.product, 8);
                                    if (!list.length) return (
                                      <div className="px-3 py-2 text-sm text-zinc-500">Không có kết quả</div>
                                    );
                                    return (
                                      <ul className="py-1 text-sm">
                                        {list.map((p, idx) => (
                                          <li
                                            key={`${p.code}-${idx}`}
                                            className="px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer leading-6"
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              const pref = (p.uomSmall || p.uomMedium || p.uomLarge || "").toString();
                                              const next: Line = {
                                                ...l,
                                                product: `${p.code} - ${p.name}`,
                                                code: p.code,
                                                unit: l.unit || pref || "",
                                              };
                                              setEditing({ ...(editing as Doc), lines: editing.lines.map(x => x.id === l.id ? next : x) });
                                              setOpenSuggestFor(null);
                                            }}
                                            onTouchStart={(e) => {
                                              e.preventDefault();
                                              const pref = (p.uomSmall || p.uomMedium || p.uomLarge || "").toString();
                                              const next: Line = { ...l, product: `${p.code} - ${p.name}`, code: p.code, unit: l.unit || pref || "" };
                                              setEditing({ ...(editing as Doc), lines: editing.lines.map(x => x.id === l.id ? next : x) });
                                              setOpenSuggestFor(null);
                                            }}
                                          >
                                            <div className="font-medium text-zinc-900 dark:text-zinc-100">{p.code} — {p.name}</div>
                                          </li>
                                        ))}
                                      </ul>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={l.unit}
                              onChange={(e) => setEditing({ ...(editing as Doc), lines: editing.lines.map(x => x.id === l.id ? { ...x, unit: e.target.value } : x) })}
                              className="w-full px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                            >
                              <option value="">— Chọn đơn vị —</option>
                              {uoms.map((u) => (<option key={u} value={u}>{u}</option>))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input type="number" min={0} value={l.qty} onChange={(e) => setEditing({ ...(editing as Doc), lines: editing.lines.map(x => x.id === l.id ? { ...x, qty: Number(e.target.value) } : x) })} className="w-28 text-right px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={l.memo ?? ""} onChange={(e) => setEditing({ ...(editing as Doc), lines: editing.lines.map(x => x.id === l.id ? { ...x, memo: e.target.value } : x) })} className="w-full px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => removeLine(l.id)} className="px-2 py-1 rounded-md text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20">Xóa</button>
                          </td>
                        </tr>
                      ))}
                      {editing.lines.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">Chưa có dòng hàng hóa</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-3 text-center">
                <button onClick={addLine} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Thêm dòng
                </button>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => { setShowModal(false); setEditing(null); }} className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">Hủy</button>
              <button onClick={saveDoc} disabled={saving} className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? "Đang lưu..." : "Lưu"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal View (read-only) */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewing(null)} />
          <div className="relative w-full max-w-3xl mx-4 my-8 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white dark:bg-zinc-900 p-5 md:p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Phiếu nhập • {viewing.code}</h3>
              <button onClick={() => setViewing(null)} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-zinc-500">Số phiếu</div>
                <div className="font-medium">{viewing.code}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Ngày</div>
                <div className="font-medium">{viewing.date}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Giờ</div>
                <div className="font-medium">{viewing.time || ""}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Kho</div>
                <div className="font-medium">{viewing.warehouse}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Người nhập</div>
                <div className="font-medium">{viewing.createdBy || ""}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Người nhận</div>
                <div className="font-medium">{viewing.receiver || ""}</div>
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <div className="text-sm text-zinc-500">Diễn giải</div>
                <div className="font-medium whitespace-pre-line">{viewing.description || ""}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-500">Nguồn</div>
                <div className="font-medium whitespace-pre-line">{viewing.source || ""}</div>
              </div>
            </div>

            <div className="mt-5">
              <h4 className="font-medium mb-2">Chi tiết hàng hóa</h4>
              <div className="rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50/70 dark:bg-zinc-800/50 text-zinc-500">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">#</th>
                        <th className="text-left font-medium px-3 py-2">Sản phẩm</th>
                        <th className="text-left font-medium px-3 py-2">Đơn vị</th>
                        <th className="text-right font-medium px-3 py-2">Số lượng</th>
                        <th className="text-left font-medium px-3 py-2">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
                      {viewing.lines.map((l, idx) => (
                        <tr key={l.id}>
                          <td className="px-3 py-2">{idx + 1}</td>
                          <td className="px-3 py-2">{l.product}</td>
                          <td className="px-3 py-2">{l.unit}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{l.qty}</td>
                          <td className="px-3 py-2">{l.memo || ""}</td>
                        </tr>
                      ))}
                      {viewing.lines.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">Không có dòng hàng hóa</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
              {/* Totals above Logs and Versions */}
              <div className="mt-6 mb-4 mr-auto">
                {(() => {
                  const kg = viewing.lines.reduce((sum, l) => {
                    const v = qtyToKg(l);
                    return sum + (v && Number.isFinite(v) ? v : 0);
                  }, 0);
                  const show = Number.isFinite(kg) ? kg : 0;
                  return (
                    <div className="inline-flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200">
                      <div className="font-medium">Tổng dòng: <span className="ml-1">{viewing.items}</span></div>
                      <div className="text-zinc-600 dark:text-zinc-300">•</div>
                      <div className="">Tổng SL (kg): <strong className="ml-1">{show.toLocaleString(undefined, { maximumFractionDigits: 3 })}</strong></div>
                    </div>
                  );
                })()}
              </div>

              {/* Logs then Versions area: stacked vertically for readability */}
              <div className="mt-6 space-y-4">
                <div>
                  <LogsSection code={viewing.code} />
                </div>
                <div>
                  <VersionsSection code={viewing.code} onPreview={(snap, ver) => {
                    try { setPreviewSnapshot(snap || null); setPreviewVersion(typeof ver === 'number' ? ver : null); } catch { setPreviewSnapshot(null); setPreviewVersion(null); }
                  }} />
                </div>
              </div>

              {previewSnapshot && (
                <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/40 p-3 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">Xem phiên bản {previewVersion ? `• v${previewVersion}` : ''}</div>
                    <button onClick={() => { setPreviewSnapshot(null); setPreviewVersion(null); }} className="text-sm text-zinc-600">Đóng</button>
                  </div>
                  <div className="text-xs text-zinc-500 mb-2">Dữ liệu xem trước — có thể khác với phiên bản hiện tại</div>
                  {/* Render snapshot using same simplified layout as viewing */}
                  <div className="space-y-3 text-sm">
                    {(() => {
                      try {
                        const s = previewSnapshot || {};
                        const pdoc: any = {
                          code: s.code || s.doc?.code || (s.docs?.[0]?.code) || viewing.code,
                          date: s.date || s.doc?.date || s.docs?.[0]?.date || viewing.date,
                          time: s.time || s.doc?.time || viewing.time,
                          warehouse: s.warehouse || s.doc?.warehouse || viewing.warehouse,
                          createdBy: s.createdBy || s.doc?.createdBy || viewing.createdBy,
                          receiver: s.receiver || s.doc?.receiver || viewing.receiver,
                          description: s.description || s.doc?.description || viewing.description,
                          lines: Array.isArray(s.lines) ? s.lines : (Array.isArray(s.doc?.lines) ? s.doc.lines : (Array.isArray(s.docs?.[0]?.lines) ? s.docs[0].lines : viewing.lines)),
                        };
                        return (
                          <div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <div>
                                <div className="text-xs text-zinc-500">Số phiếu</div>
                                <div className="font-medium">{pdoc.code}{previewVersion ? `-v${previewVersion}` : ''}</div>
                              </div>
                              <div>
                                <div className="text-xs text-zinc-500">Ngày</div>
                                <div className="font-medium">{pdoc.date}</div>
                              </div>
                              <div>
                                <div className="text-xs text-zinc-500">Kho</div>
                                <div className="font-medium">{pdoc.warehouse}</div>
                              </div>
                            </div>
                            <div className="mt-2">
                              <div className="text-xs text-zinc-500">Diễn giải</div>
                              <div className="font-medium whitespace-pre-line">{pdoc.description || ''}</div>
                            </div>
                            <div className="mt-2">
                              <div className="text-xs text-zinc-500 mb-1">Chi tiết hàng hóa</div>
                              <div className="rounded-xl border border-zinc-200 p-2 bg-white">
                                <table className="min-w-full text-sm">
                                  <thead className="text-zinc-500 text-xs">
                                    <tr>
                                      <th className="text-left px-2">#</th>
                                      <th className="text-left px-2">Sản phẩm</th>
                                      <th className="text-left px-2">ĐVT</th>
                                      <th className="text-right px-2">SL</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {((pdoc.lines || []) as any[]).map((l: any, i: number) => (
                                      <tr key={i} className="border-t">
                                        <td className="px-2 py-1">{i+1}</td>
                                        <td className="px-2 py-1">{(l.product || l.productName || `${l.productCode || ''} - ${l.productName || ''}`).toString()}</td>
                                        <td className="px-2 py-1">{l.unit || ''}</td>
                                        <td className="px-2 py-1 text-right">{l.qty ?? l.quantity ?? ''}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        );
                      } catch { return <pre className="text-xs">{String(previewSnapshot)}</pre>; }
                    })()}
                  </div>
                </div>
              )}
            {/* (duplicate totals removed) */}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setViewing(null)} className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
