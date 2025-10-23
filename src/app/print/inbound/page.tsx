"use client";

import * as React from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Line = { product: string; code?: string; unit: string; qty: number; memo?: string; kg?: number | null };
type Doc = { code: string; date: string; time?: string; warehouse: string; createdBy?: string; receiver?: string; description?: string; lines: Line[] };

function _formatDateLineVN(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = d.getDate();
  const mm = d.getMonth() + 1;
  const yy = d.getFullYear();
  return `Ngày ${dd} tháng ${mm} năm ${yy}`;
}

function parseDMY(dateStr: string): { dd: number; mm: number; yy: number } | null {
  if (!dateStr) return null;
  const auto = new Date(dateStr);
  if (!isNaN(auto.getTime())) {
    return { dd: auto.getDate(), mm: auto.getMonth() + 1, yy: auto.getFullYear() };
  }
  const parts = (dateStr.match(/\d+/g) || []).map((p) => parseInt(p, 10));
  if (parts.length < 3) return null;
  let dd = 0, mm = 0, yy = 0;
  // Prefer formats: DD/MM/YYYY or YYYY-MM-DD
  if (("" + (dateStr.match(/\d+/)?.[0] || "")).length === 4) {
    // Year-first
    yy = parts[0]; mm = parts[1]; dd = parts[2];
  } else if (("" + (dateStr.match(/\d+/g)?.[2] || "")).length === 4) {
    // Day-first with 4-digit year last
    dd = parts[0]; mm = parts[1]; yy = parts[2];
  } else {
    // Fallback: assume day-first
    dd = parts[0]; mm = parts[1]; yy = parts[2];
  }
  // Basic normalization
  if (mm > 12 && dd <= 12) {
    const t = mm; mm = dd; dd = t;
  }
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yy < 100 || yy > 9999) return null;
  return { dd, mm, yy };
}

function InboundContent() {
  const sp = useSearchParams();
  const codeParam = (sp.get("code") || "").trim();
  // Allow coming from pretty URL /xhd/:slug via middleware rewrite (query not visible in address bar)
  const pathFromWindow = typeof window !== "undefined" ? window.location.pathname : "";
  const slugFromPath = React.useMemo(() => {
    if (!pathFromWindow) return "";
    if (pathFromWindow.startsWith("/xhd/")) {
      const s = pathFromWindow.slice("/xhd/".length);
      return decodeURIComponent(s.split("/")[0] || "");
    }
    return "";
  }, [pathFromWindow]);
  const code = (codeParam || slugFromPath).trim(); // can be real code or slug from column N
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [receiverRows, setReceiverRows] = useState<Array<{ name: string; [k: string]: string }>>([]);
  const [storekeeper, setStorekeeper] = useState<string>("");
  const [printLink, setPrintLink] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [printed, setPrinted] = useState<boolean>(false);
  // For kg conversion, load full product info like dashboard does
  type PInfo = { uomSmall: string; uomMedium: string; uomLarge: string; rSM: number; rML: number };
  const [productMap, setProductMap] = useState<Record<string, PInfo>>({});
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [logs, setLogs] = useState<Array<any>>([]);
  const [versions, setVersions] = useState<Array<any>>([]);
  const [previewVersionSnapshot, setPreviewVersionSnapshot] = useState<any | null>(null);
  const [previewVersionNumber, setPreviewVersionNumber] = useState<number | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [mobileCollapseLogs, setMobileCollapseLogs] = useState(false);
  const [mobileCollapseVersions, setMobileCollapseVersions] = useState(false);
  // Offset (in mm) to nudge the right-side legal text downward; adjust as needed
  const LEGAL_TOP_MM: number = 2; // e.g., 6mm
  // Left margin (in mm) for the contact row (name/address). Use negatives to pull further left.
  const CONTACT_LEFT_MM: number = 0;
  // Use Tailwind classes instead of inline style; include literal options so JIT picks them up
  const LEGAL_TOP_CLASS = React.useMemo(() => {
    switch (LEGAL_TOP_MM) {
      case 0:
        return "top-0";
      case 2:
        return "top-[1.5mm]";
      case 3:
        return "top-[3mm]";
      case 4:
        return "top-[4mm]";
      case 6:
        return "top-[6mm]";
      default:
        return "top-[3mm]";
    }
  }, [LEGAL_TOP_MM]);

  const _CONTACT_LEFT_CLASS = React.useMemo(() => {
    switch (CONTACT_LEFT_MM) {
      case -8:
        return "-ml-[8mm]";
      case -6:
        return "-ml-[6mm]";
      case -4:
        return "-ml-[4mm]";
      case -3:
        return "-ml-[3mm]";
      case -2:
        return "-ml-[2mm]";
      case -1:
        return "-ml-[1mm]";
      case 0:
        return "ml-0";
      case 1:
        return "ml-[1mm]";
      case 2:
        return "ml-[2mm]";
      case 3:
        return "ml-[3mm]";
      case 4:
        return "ml-[4mm]";
      case 6:
        return "ml-[6mm]";
      case 8:
        return "ml-[8mm]";
      default:
        return "ml-0";
    }
  }, [CONTACT_LEFT_MM]);

  // Fine-tune only the right-side address by shifting it left via negative right margin
  const ADDRESS_LEFT_MM: number = 8;
  const ADDRESS_LEFT_CLASS = React.useMemo(() => {
    switch (ADDRESS_LEFT_MM) {
      case 1:
        return "mr-[1mm]";
      case 2:
        return "mr-[2mm]";
      case 3:
        return "mr-[3mm]";
      case 4:
        return "mr-[4mm]";
      case 6:
        return "mr-[6mm]";
      case 8:
        return "mr-[22mm]";
      default:
        return "mr-0";
    }
  }, [ADDRESS_LEFT_MM]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Client-side guard: block direct access to /print/inbound unless via=xhd or URL path is /xhd/
        try {
          const via = sp.get("via"); 
          const p = typeof window !== "undefined" ? window.location.pathname : ""; 
          // Allow when via=xhd or path starts with /xhd/ or when running on localhost (dev testing)
          const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
          const allowed = (via === "xhd") || (p.startsWith("/xhd/")) || isLocalhost; 
          if (!allowed) {
            setDoc(null);
            setLoading(false);
            return; // stop fetching/rendering the print content
          }
        } catch {}
        setLoading(true);
        // Map provided codeParam (could be slug) to actual doc code by scanning docs
        const effectiveCode = code;
        const [res, resCfg, resProducts, resUsers, resReceivers] = await Promise.all([
          fetch("/api/inbound", { cache: "no-store" }),
          fetch("/api/settings/inbound", { cache: "no-store" }),
          fetch("/api/products", { cache: "no-store" }),
          fetch("/api/users", { cache: "no-store" }),
          fetch("/api/settings/inbound/receivers", { cache: "no-store" }),
        ]);
        const js = await res.json();
        const cfg = await resCfg.json().catch(() => ({ ok: false }));
        const prods = await resProducts.json().catch(() => ({ ok: false }));
        const users = await resUsers.json().catch(() => ({ ok: false }));
        const receivers = await resReceivers.json().catch(() => ({ ok: false }));
        if (!alive) return;
        // Build map code -> PInfo consistent with dashboard's conversion logic
        try {
          if (prods?.ok && Array.isArray(prods?.products)) { 
            const map: Record<string, PInfo> = {}; 
            for (const p of prods.products as any[]) { 
              const code = (p?.code || "").toString().trim();
              if (!code) continue;
              map[code] = {
                uomSmall: (p?.uomSmall || "").toString(),
                uomMedium: (p?.uomMedium || "").toString(),
                uomLarge: (p?.uomLarge || "").toString(),
                rSM: parseFloat(((p?.ratioSmallToMedium || "").toString()).replace(/,/g, ".")) || 0,
                rML: parseFloat(((p?.ratioMediumToLarge || "").toString()).replace(/,/g, ".")) || 0,
              };
            }
            setProductMap(map);
          } else {
            setProductMap({});
          }
        } catch { setProductMap({}); }
  const docs = Array.isArray(js?.docs) ? js.docs : [];
  // Try to match by slug first
  let found = docs.find((d: any) => (d?.slug || "").toString().trim() === effectiveCode);
  if (!found) {
    found = docs.find((d: any) => (d?.code || "").toString().trim() === effectiveCode);
  }
        if (found) setDoc({
          code: found.code,
          date: found.date,
          time: found.time,
          warehouse: found.warehouse,
          createdBy: found.createdBy,
          description: found.description,
          lines: (found.lines || []).map((l: any) => ({ product: `${l.productCode || ""}${l.productName ? " - " + l.productName : ""}`.trim(), code: l.productCode, unit: l.unit, qty: Number(l.qty)||0, memo: l.memo || "" })),
        });
        if (cfg?.ok && cfg?.settings && typeof cfg.settings === "object") {
          setSettings(cfg.settings);
        } else {
          setSettings({});
        }
        // Build printLink for display as pretty URL /xhd/<slug|code>
        try {
          const origin = typeof window !== "undefined" ? window.location.origin : "";
          // Build a preview link (won't auto-print when opened because of ?preview=1)
          if (found?.slug) setPrintLink(`${origin}/xhd/${encodeURIComponent(found.slug)}?preview=1`);
          else if (code) setPrintLink(`${origin}/xhd/${encodeURIComponent(code)}?preview=1`);
          else if (found?.code) setPrintLink(`${origin}/xhd/${encodeURIComponent(found.code)}?preview=1`);
        } catch {}
        if (receivers?.ok && Array.isArray(receivers?.receivers)) {
          setReceiverRows(receivers.receivers as any);
        } else {
          setReceiverRows([]);
        }
        // Auto-detect storekeeper name from users list (fallback for signature)
        try {
          if (users?.ok && Array.isArray(users?.users)) {
            const list = users.users as any[];
            const match = list.find((u) => {
              const pos = ((u?.position || u?.role || "") as string).toString();
              const hay = pos.normalize?.("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase?.() || pos.toLowerCase();
              return hay.includes("thu kho") || hay.includes("thukho");
            });
            if (match) setStorekeeper((match.name || match.username || "").toString());
          }
        } catch {}
      } catch {}
      finally { setLoading(false); }
    })();
    return () => { alive = false; };
  }, [code, sp]);

  // When opened as preview, load logs and versions for this doc
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('');
        const previewMode = params.get('preview') === '1';
        if (previewMode && typeof window !== 'undefined') {
          setIsPreviewMode(true);
          // default collapse state on small screens: collapsed to save vertical space
          try {
            const mq = window.matchMedia && window.matchMedia('(max-width: 640px)');
            if (mq && mq.matches) {
              setMobileCollapseLogs(true);
              setMobileCollapseVersions(true);
            }
          } catch {}
        } else {
          setIsPreviewMode(false);
        }
        if (!previewMode) return;
        if (!doc?.code) return;
        const [rLogs, rVers] = await Promise.all([
          fetch(`/api/inbound/logs?code=${encodeURIComponent(doc.code)}`),
          fetch(`/api/inbound/versions?code=${encodeURIComponent(doc.code)}`),
        ]);
        const jLogs = await rLogs.json().catch(() => null);
        const jVers = await rVers.json().catch(() => null);
        if (!alive) return;
        if (jLogs && jLogs.ok && Array.isArray(jLogs.logs)) setLogs(jLogs.logs);
        else setLogs([]);
        if (jVers && jVers.ok && Array.isArray(jVers.versions)) setVersions(jVers.versions);
        else setVersions([]);
  } catch {
        /* ignore */
      }
    })();
    return () => { alive = false; };
  }, [doc?.code]);

  // Generate QR code for the printable link
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!printLink) { setQrDataUrl(""); return; }
        const mod: any = await import("qrcode");
        const api: any = mod?.toDataURL ? mod : (mod?.default || mod);
        const url = String(printLink);
        const dataUrl: string = await api.toDataURL(url, { margin: 1, width: 180 });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch { /* ignore QR failures */ }
    })();
    return () => { cancelled = true; };
  }, [printLink]);

  // Trigger window.print when content (including QR) is ready
  useEffect(() => {
    if (printed) return;
    if (loading) return;
    if (!doc) return;
    // If we intend to show a QR, wait for qrDataUrl; otherwise print immediately
    if (printLink && !qrDataUrl) return;
    // Do not auto-print when opened as a preview (preview=1 in query string)
    try {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      const params = new URLSearchParams(search);
      // Keep existing preview behavior. Additionally, support a separate `snapshot=1`
      // flag which is intended for server-side screenshot/render flows. `snapshot=1`
      // should prevent auto-printing but is not treated as a full "preview mode"
      // in the UI (so TEXT7 and other preview-only UI remain as before).
      const isPreview = params.get('preview') === '1';
      const isSnapshot = params.get('snapshot') === '1';
      if (isPreview || isSnapshot) return;
    } catch {}
    const t = setTimeout(() => { try { window.print(); setPrinted(true); } catch {} }, 150);
    return () => clearTimeout(t);
  }, [printed, loading, doc, printLink, qrDataUrl]);

  // (removed) downloadPreviewImage: preview download functionality intentionally removed

  // Load current version for this doc (show as suffix on code)
  useEffect(() => {
    let alive = true;
    if (!doc?.code) { setCurrentVersion(null); return; }
    (async () => {
      try {
        const res = await fetch(`/api/inbound/versions?code=${encodeURIComponent(doc.code)}`);
        const j = await res.json().catch(() => null);
        if (!alive) return;
        if (j && j.ok && Array.isArray(j.versions) && j.versions.length > 0) {
          const v = Number(j.versions[0].version) || 1;
          setCurrentVersion(v);
        } else {
          // default to 1 when no explicit versions found
          setCurrentVersion(1);
        }
  } catch {
        if (!alive) return;
        setCurrentVersion(1);
      }
    })();
    return () => { alive = false; };
  }, [doc?.code]);

  const effectiveSettings = useMemo(() => {
    const base: Record<string, string> = { ...(settings || {}) };
    // Try to resolve a receiver row by explicit doc.receiver (preferred)
    const name = (doc?.receiver || "").toString().trim().toLowerCase();
    let row: any | undefined;
    if (name) {
      row = receiverRows.find(r => (r?.name || "").toString().trim().toLowerCase() === name);
    }
    // Fallbacks when doc.receiver is empty or no exact match found
    if (!row) {
      try {
        // 1) If any value in settings matches a receiverRows.name, pick that row
        const settingNames = Object.values(settings || {}).map(v => (v || "").toString().trim().toLowerCase());
        if (settingNames.length > 0) {
          row = receiverRows.find(r => settingNames.includes(((r?.name || "") as string).toString().trim().toLowerCase()));
        }
      } catch {}
    }
    if (!row) {
      // 2) If there's only one receiver row configured, use it as a best-effort default
      if (receiverRows && receiverRows.length === 1) row = receiverRows[0];
    }
    if (row) {
      for (let i = 1; i <= 7; i++) {
        const key = `TEXT${i}`;
        const val = (row as any)[key];
        if (val != null && val !== "") base[key] = String(val);
      }
      if ((row as any).TEXT7) base.NGUOI_NHAN = String((row as any).TEXT7);
    }
    return base;
  }, [settings, receiverRows, doc?.receiver]);

  const resolvePlaceholders = React.useCallback((text: string) => {
    if (!text) return "";
    let out = String(text);
    // Resolve up to 3 passes to allow nested placeholders (e.g., TEXT7 contains {{link}})
    for (let i = 0; i < 3; i++) {
      const before = out;
      out = out.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_m, g1) => {
        const keyRaw = String(g1 || "").trim();
        const key = keyRaw.toUpperCase();
        // Built-in dynamic placeholders (case-insensitive)
        if (key === "CODE" || key === "MA_PHIEU") return doc?.code || "";
        if (key === "DATE" || key === "NGAY") return doc?.date || "";
        if (key === "WAREHOUSE" || key === "KHO") return doc?.warehouse || "";
        if (key === "LINK" || key === "PRINT_LINK" || key === "LINK_IN") {
          return printLink || "";
        }
        const val = (effectiveSettings?.[key] ?? effectiveSettings?.[keyRaw]);
        return (val ?? "");
      });
      if (out === before) break;
    }
    return out;
  }, [effectiveSettings, doc?.code, doc?.date, doc?.warehouse, printLink]);

  const normalizeUom = (u: string | undefined) => (u || "").toString().trim().toLowerCase();
  const _qtyTotal = useMemo(() => (doc?.lines || []).reduce((s, l) => s + (Number(l.qty) || 0), 0), [doc]);
  const qtyToKg = React.useCallback((line: Line): number | null => {
    const code = (line.code || (line.product || "").split(" - ")[0]).trim();
    if (!code) return null;
    const prod = productMap[code];
    if (!prod) return null;
    const uSmall = normalizeUom(prod.uomSmall);
    const uMed = normalizeUom(prod.uomMedium);
    const uLarge = normalizeUom(prod.uomLarge);
    const rSM = Number(prod.rSM) || 0;
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
  }, [productMap]);

  const _kgFor = React.useCallback((l: Line) => {
    const v = qtyToKg(l);
    return v == null ? "" : Number(v).toFixed(3);
  }, [qtyToKg]);
  const kgTotal = useMemo(() => (doc?.lines || []).reduce((s, l) => {
    const v = qtyToKg(l);
    return s + (v && Number.isFinite(v) ? Number(v) : 0);
  }, 0), [doc, qtyToKg]);

  // Cắt ngắn một placeholder để không hiển thị quá dài (ví dụ TEXT6)
  const truncate = React.useCallback((text: string, max = 100) => {
    const t = (text || "").toString();
    if (t.length <= max) return t;
    return t.slice(0, max).trimEnd() + "…";
  }, []);

  return (
    <div className="p-6 print:p-0 text-[13px] leading-relaxed text-zinc-900">
      {!doc && (loading ? <div>Đang tải…</div> : <div>Không tìm thấy phiếu</div>)}
      {doc && (
        <div>
          {/* DEBUG panel removed - cleaned up for production */}
          {/* Top bar: logo + company info (left) and legal header pinned far-right */}
          <div className="relative mb-2">
            <div className="flex items-start gap-3">
              <div className="shrink-0">
                <img src="/logo2.png" alt="Logo" className="h-11 w-auto" />
              </div>
              <div className="text-[10px] leading-tight font-bold">
                <div className="text-emerald-700 tracking-[0.03em] text-[15px]">CÔNG TY CP SẦU RIÊNG TÂY NGUYÊN</div>
                <div>Địa chỉ : Lô CN4, Cụm CN Tân An, P. Tân An, TP. Buôn Ma Thuột, Đắk Lắk</div>
                <div>Email : Saritadurian@gmail.com Ι Điện thoại : 0262 351 6668</div>
              </div>
            </div>
            <div className={`absolute right-0 text-center text-[10px] leading-tight font-bold ${LEGAL_TOP_CLASS} ${isPreviewMode ? 'hidden sm:block' : ''}`}>
              <div>Mẫu số 01 - VT</div>
              <div>(Ban hành theo Thông tư số 200/2014/TT-BTC</div>
              <div>Ngày 22/12/2014 của Bộ Tài chính)</div>
            </div>
          </div>
            <div className="text-center font-semibold text-[20px] mb-0 mt-9 [font-family:'Times_New_Roman',Times,serif]">PHIẾU NHẬP KHO</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 items-start mb-0">
            <div></div>
            <div className="text-center [font-family:'Times_New_Roman',Times,serif] text-[12px] font-bold">
              {(() => {
                const d = parseDMY(doc.date);
                if (!d) return <span>{doc.date}</span>;
                return <>Ngày {d.dd} Tháng {d.mm} Năm {d.yy}</>;
              })()}
              <div className="mt-0">Số: {doc.code}{currentVersion ? `-${currentVersion}` : ''}</div>
            </div>
            <div></div>
          </div>
          {/* Mobile: wrap top info in a subtle card and add a section heading to clarify content */}
          <div className="block sm:hidden text-sm font-semibold text-zinc-700 mt-3 mb-1">Thông tin phiếu</div>
          <div className={`p-3 sm:p-0 bg-white sm:bg-transparent rounded-md sm:rounded-none border border-zinc-100 sm:border-0 ${isPreviewMode ? 'shadow-sm sm:shadow-none' : ''}`}>
          <div className={`flex flex-col justify-between items-start gap-2 [font-family:'Times_New_Roman',Times,serif] text-[14px] font-normal mt-1`}>
            <div className="w-full sm:flex-1 min-w-0">
              <div className="flex items-start sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-col gap-2">
                    <div className="w-full truncate">- Họ và tên người giao: <span className="font-medium">{resolvePlaceholders("{{TEXT1}}")}</span></div>
                    <div className="w-full flex items-center gap-2 sm:max-w-[45%]">
                      <span className="whitespace-nowrap">- Địa chỉ (bộ phận):</span>
                      <span className="min-w-0 flex-1 truncate text-left">{resolvePlaceholders("{{TEXT2}}")}</span>
                    </div>
                  </div>
                  <div className="mt-1 text-[14px] text-zinc-640 truncate">{resolvePlaceholders("{{TEXT5}}")}</div>
                </div>
              </div>
            </div>
          </div>
                    {/* readiness marker for headless screenshot: render only after QR is ready so screenshots include QR */}
                    {qrDataUrl ? <div id="print-ready" className="hidden" aria-hidden="true"></div> : null}
          <div className="flex flex-col justify-between items-start [font-family:'Times_New_Roman',Times,serif] text-[14px] font-normal mt-1">
            <div className="w-full">- Nhập tại kho: {doc.warehouse}</div>
            <div className="w-full mt-1">
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-left">- Địa chỉ (bộ phận):</span>
                <span className="min-w-0 flex-1 truncate text-left">{resolvePlaceholders("{{TEXT6}}")}</span>
              </div>
            </div>
          </div>
          <div className="[font-family:'Times_New_Roman',Times,serif] text-[14px] font-normal mb-2 mt-1">- Diễn giải: {doc.description || ""}</div>
          </div>

          <div className="hidden sm:block">
          <table className="w-full border-collapse table-fixed text-[12px] [font-family:'Times_New_Roman',Times,serif] print-strong-border">
            <colgroup>
              <col className="w-[6%]" />
              <col className="w-[28%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[24%]" />
            </colgroup>
            <thead className="font-bold">
              <tr>
                <th className="border border-zinc-400 px-2 py-1 text-center" rowSpan={2}>STT</th>
                <th className="border border-zinc-400 px-2 py-1 text-center" rowSpan={2}>
                  <div className="leading-tight">
                    Tên, nhãn hiệu, quy cách, phẩm chất
                    <br />
                    vật tư, dụng cụ, sp, hàng hoá
                  </div>
                </th>
                <th className="border border-zinc-400 px-2 py-1 text-center" rowSpan={2}>Mã số</th>
                <th className="border border-zinc-400 px-2 py-1 text-center" rowSpan={2}>ĐVT</th>
                <th className="border border-zinc-400 px-2 py-1 text-center" colSpan={2}>Số Lượng</th>
                <th className="border border-zinc-400 px-2 py-1 text-center" rowSpan={2}>Ghi Chú</th>
              </tr>
              <tr>
                <th className="border border-zinc-400 px-2 py-1 text-center">Thực nhập</th>
                <th className="border border-zinc-400 px-2 py-1 text-center"><div className="leading-tight">Quy đổi<br />(Kg)</div></th>
              </tr>
              <tr>
                {['A','B','C','D','E','F','G'].map((h, i) => (
                  <th key={i} className="border border-zinc-400 px-2 py-1 text-center font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l, idx) => {
                const m = (l.product || "").match(/^(.*?)\s*-\s*(.+)$/);
                const code = l.code || (m ? (m[1]||"").trim() : "");
                const name = m ? (m[2]||"").trim() : (l.product || "").trim();
                return (
                  <tr key={idx}>
                    <td className="border border-zinc-400 px-2 py-1 text-center">{idx+1}</td>
                    <td className="border border-zinc-400 px-2 py-1 whitespace-normal break-words">{name}</td>
                    <td className="border border-zinc-400 px-2 py-1 text-center">{code}</td>
                    <td className="border border-zinc-400 px-2 py-1 text-center">{l.unit}</td>
                    <td className="border border-zinc-400 px-2 py-1 text-center">{l.qty}</td>
                    <td className="border border-zinc-400 px-2 py-1 text-center">
                      {(() => {
                        const v = qtyToKg(l);
                        if (v == null || !Number.isFinite(v)) return "";
                        const rounded = Math.round(Number(v) * 1000) / 1000;
                        return rounded.toLocaleString(undefined, { maximumFractionDigits: 3 });
                      })()}
                    </td>
                    <td className="border border-zinc-400 px-2 py-1 whitespace-normal break-words">{l.memo || ""}</td>
                  </tr>
                );
              })}
              <tr>
                <td className="border border-zinc-400 px-2 py-1"></td>
                <td className="border border-zinc-400 px-2 py-1 text-left font-bold">Cộng:</td>
                <td className="border border-zinc-400 px-2 py-1 text-center font-bold">x</td>
                <td className="border border-zinc-400 px-2 py-1 text-center font-bold">x</td>
                <td className="border border-zinc-400 px-2 py-1 text-center font-bold">x</td>
                <td className="border border-zinc-400 px-2 py-1 text-center font-bold">{(Math.round(kgTotal * 1000) / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                <td className="border border-zinc-400 px-2 py-1"></td>
              </tr>
            </tbody>
          </table>
          </div>

          {/* Mobile-friendly stacked list (visible only on small screens). This improves readability when scanning QR on phone. */}
          <div className="block sm:hidden mt-3">
            <div className="text-sm font-semibold text-zinc-700 mb-2">Chi tiết hàng hóa</div>
            <div className="space-y-3">
            {doc.lines.map((l, idx) => {
              const m = (l.product || "").match(/^(.*?)\s*-\s*(.+)$/);
              const code = l.code || (m ? (m[1]||"").trim() : "");
              const name = m ? (m[2]||"").trim() : (l.product || "").trim();
              const kg = (() => {
                const v = qtyToKg(l);
                if (v == null || !Number.isFinite(v)) return '';
                const rounded = Math.round(Number(v) * 1000) / 1000;
                return rounded.toLocaleString(undefined, { maximumFractionDigits: 3 });
              })();
                return (
                <div key={idx} className="rounded-lg border border-zinc-300 p-3 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="mr-2 flex items-center justify-center shrink-0 w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">{idx+1}</div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-zinc-900 leading-snug">{name}</div>
                      <div className="mt-1 text-xs text-zinc-600 flex items-center gap-2">
                        <span className="font-mono text-xs text-zinc-700">{code}</span>
                        <span className="inline-block px-2 py-0.5 text-[11px] bg-zinc-100 rounded text-zinc-700">{l.unit || ''}</span>
                      </div>
                      {l.memo ? <div className="mt-2 text-xs text-zinc-600 whitespace-pre-wrap">{l.memo}</div> : null}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-lg font-medium text-zinc-900 tabular-nums">{l.qty}</div>
                      <div className="text-xs text-zinc-600">{kg ? `${kg} kg` : ''}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          <div className="[font-family:'Times_New_Roman',Times,serif] text-[14px] font-normal mt-2">
            Số chứng từ gốc kèm theo:
          </div>

          {(() => {
            const text3 = resolvePlaceholders("{{TEXT3}}") || "";
            const text4 = resolvePlaceholders("{{TEXT4}}") || "";
            const hasExtra = Boolean(text3 || text4);
            return (
              <div className={`hidden sm:grid ${hasExtra ? "grid-cols-4" : "grid-cols-3"} gap-4 mt-8 text-center`}>
            <div>
              <div className="[font-family:'Times_New_Roman',Times,serif] text-[13px] font-bold">Người lập phiếu</div>
              <div className="[font-family:'Times_New_Roman',Times,serif] text-[12px] font-normal mt-1">(ký, họ tên)</div>
              <div className="mt-14 [font-family:'Times_New_Roman',Times,serif] text-[12px] font-bold">{doc.createdBy || ""}</div>
            </div>
            <div>
              <div className="[font-family:'Times_New_Roman',Times,serif] text-[13px] font-bold">Người giao hàng</div>
              <div className="[font-family:'Times_New_Roman',Times,serif] text-[12px] font-normal mt-1">(ký, họ tên)</div>
              
            </div>
            <div>
              <div className="[font-family:'Times_New_Roman',Times,serif] text-[13px] font-bold">Thủ kho</div>
              <div className="[font-family:'Times_New_Roman',Times,serif] text-[12px] font-normal mt-1">(ký, họ tên)</div>
              <div className="mt-14 [font-family:'Times_New_Roman',Times,serif] text-[12px] font-bold">{storekeeper || resolvePlaceholders("{{THU_KHO_TEN}}") || resolvePlaceholders("{{THU_KHO}}") || ""}</div>
            </div>
            {hasExtra && (
              <div>
                <div className="[font-family:'Times_New_Roman',Times,serif] text-[13px] font-bold">{text3}</div>
                <div className="[font-family:'Times_New_Roman',Times,serif] text-[12px] font-normal mt-1">(ký, họ tên, đóng dấu)</div>
                <div className="mt-14 [font-family:'Times_New_Roman',Times,serif] text-[12px] font-bold">{text4}</div>
              </div>
            )}
          </div>
            );
          })()}
          {/* Note below signatures: keep the block left-aligned; only the link+QR pair are stacked with QR under the link */}
          {(() => {
            const raw = resolvePlaceholders("{{TEXT7}}");
            let text = (raw || "").replace(/<code>/gi, doc.code || "");
            if (!text && !printLink) return null; // nothing to show at all
            // Replace any embedded print link with our canonical /xhd link
            if (printLink) {
              text = text
                .replace(/(?:https?:\/\/[^\s]+)?\/?print\/inbound\?code=[^\s]*/gi, printLink)
                .replace(/(?:https?:\/\/[^\s]+)?\/?xhd\/[A-Za-z0-9_-]+/gi, printLink);
            }
            // Detect a URL to render as clickable
            const linkMatch = (printLink ? { 0: printLink } as any : text.match(/https?:\/\/[^\s]+/i));
            const linkUrl = printLink || (linkMatch ? (linkMatch[0] as string) : "");
            // Hide the TEXT7 link/QR block when opened in preview mode (preview=1)
            try {
              const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('');
              const previewMode = params.get('preview') === '1';
              if (previewMode) return null;
            } catch {}
            return (
              <div className="mt-4 [font-family:'Times_New_Roman',Times,serif]">
                {/* Full-width bordered wrapper for TEXT7 (link) and QR with title */}
                <div className="w-full border-2 border-zinc-500 p-3 rounded-md bg-white">
                  <div className="text-[12px] font-semibold text-center mb-1">Kiểm Tra, đối chiếu, xem thông tin phiếu nhập tại :</div>
                  <div className="flex flex-col items-center">
                    {(text || linkUrl) ? (
                      <div className="text-[10px] text-zinc-600 break-all text-center">
                          {linkUrl ? (
                            <span>
                              {text ? (
                                <span>{(
                                  // Remove the link itself from the prefix, then strip any stray '?preview=1' tokens left before the link
                                  (text.replace(linkUrl, "")).replace(/\?preview=1\s*/g, "").trim()
                                ) + " "}</span>
                              ) : null}
                              <a href={linkUrl} className="underline" target="_blank" rel="noreferrer">{linkUrl}</a>
                            </span>
                          ) : text}
                        </div>
                    ) : null}
                    {qrDataUrl ? (
                      <div className="mt-2">
                        <img src={qrDataUrl} alt="QR" className="w-[28mm] h-[28mm] object-contain" />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })()}
          {/* Preview mode: show logs and versions if present */}
          {(() => {
            try {
              const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('');
              const previewMode = params.get('preview') === '1';
              if (!previewMode) return null;
            } catch { return null; }
            return (
              <div className="mt-6 space-y-4 text-[13px]">
                <div className="rounded-lg border border-zinc-400 p-3 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">Lịch sử thao tác</div>
                      <div className="hidden md:block text-xs text-zinc-500">(Logs)</div>
                      <div className="text-xs bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded">{logs.length}</div>
                    </div>
                    <button onClick={() => setMobileCollapseLogs((s) => !s)} className="md:hidden text-sm text-zinc-600 px-2 py-1">{mobileCollapseLogs ? 'Hiện' : 'Ẩn'}</button>
                  </div>
                  <div className={mobileCollapseLogs ? 'hidden md:block' : ''}>
                  {logs.length === 0 ? (
                    <div className="text-zinc-500">Không có bản ghi</div>
                  ) : (
                    <div className="space-y-2">
                      {logs.map((l, i) => {
                        // Normalize fields
                        const ts = l.ts || l.timestamp || l.time || "";
                        const actor = l.user || l.actor || l.who || "";
                        const rawAction = (l.action || l.msg || (l.data && l.data.action) || "").toString().toLowerCase();
                        // Decide color by action
                        let bg = "bg-white";
                        let border = "border-zinc-200";
                        if (rawAction.includes('create') || rawAction.includes('tạo') || rawAction.includes('tao')) { bg = 'bg-emerald-50'; border = 'border-emerald-200'; }
                        else if (rawAction.includes('update') || rawAction.includes('cập nhật') || rawAction.includes('cap nhat')) { bg = 'bg-amber-50'; border = 'border-amber-200'; }
                        else if (rawAction.includes('delete') || rawAction.includes('xóa') || rawAction.includes('xoa')) { bg = 'bg-red-50'; border = 'border-red-200'; }
                        return (
                          <div key={i} className={`flex items-center gap-3 p-2 border ${border} rounded ${bg}`}> 
                            <div className="w-36 text-xs text-zinc-600 break-words">
                              <div className="font-medium">{ts ? String(ts) : ''}</div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <div className="font-medium">{`${actor || '—'}${(l.action || l.msg || '') ? ' - ' + String(l.action || l.msg) : ''}`}</div>
                                <div className="text-xs text-zinc-500">{(l.ip || l.remote || '')}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-400 p-3 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">Phiên bản</div>
                      <div className="hidden md:block text-xs text-zinc-500">(Versions)</div>
                      <div className="text-xs bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded">{versions.length}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setMobileCollapseVersions((s) => !s)} className="md:hidden text-sm text-zinc-600 px-2 py-1">{mobileCollapseVersions ? 'Hiện' : 'Ẩn'}</button>
                    </div>
                  </div>
                  <div className={mobileCollapseVersions ? 'hidden md:block' : ''}>
                  {versions.length === 0 ? (
                    <div className="text-zinc-500">Không có phiên bản</div>
                  ) : (
                    <div className="grid gap-2">
                      {versions.map((v: any, idx: number) => {
                        const palettes = [
                          { border: 'border-emerald-400', dot: 'bg-emerald-400' },
                          { border: 'border-sky-400', dot: 'bg-sky-400' },
                          { border: 'border-amber-400', dot: 'bg-amber-400' },
                          { border: 'border-rose-400', dot: 'bg-rose-400' },
                          { border: 'border-indigo-400', dot: 'bg-indigo-400' },
                          { border: 'border-lime-400', dot: 'bg-lime-400' },
                        ];
                        const p = palettes[(Number(v.version) || idx) % palettes.length];
                        return (
                          <div key={idx} className={["flex items-center justify-between border-l-4 pl-3 py-2", p.border].join(' ')}>
                            <div className="flex items-center gap-3">
                              <span className={["w-3 h-3 rounded-full", p.dot].join(' ')} />
                              <div className="text-xs text-zinc-600">v{v.version} • {v.ts || v.timestamp || ''} • {v.user || v.actor || ''}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => {
                                try {
                                  // parse snapshot from v.data or v.doc
                                  const snap = (typeof v.data === 'string' ? JSON.parse(v.data) : (v.data || v.doc || null));
                                  setPreviewVersionSnapshot(snap);
                                  setPreviewVersionNumber(Number(v.version) || null);
                                  // scroll into view
                                  setTimeout(() => { try { const el = document.getElementById('version-preview'); if (el) el.scrollIntoView({ behavior: 'smooth' }); } catch {} }, 50);
                                } catch { setPreviewVersionSnapshot(null); setPreviewVersionNumber(null); }
                              }} className={['px-2 py-1 rounded bg-emerald-600 text-white text-xs', isPreviewMode ? 'md:px-2 md:py-1 lg:px-2 lg:py-1 sm:block sm:w-full' : ''].join(' ')}>Xem</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  </div>
                </div>

                {previewVersionSnapshot && (
                  <div id="version-preview" className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-3 text-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">Xem phiên bản {previewVersionNumber ? `• v${previewVersionNumber}` : ''}</div>
                      <button onClick={() => { setPreviewVersionSnapshot(null); setPreviewVersionNumber(null); }} className="text-sm text-zinc-600">Đóng</button>
                    </div>
                    <div className="text-xs text-zinc-500 mb-2">Dữ liệu xem trước — có thể khác với phiên bản hiện tại</div>
                    <div className="space-y-3 text-sm">
                      {(() => {
                        try {
                          const s = previewVersionSnapshot || {};
                          const pdoc: any = {
                            code: s.code || s.doc?.code || (s.docs?.[0]?.code) || doc.code,
                            date: s.date || s.doc?.date || s.docs?.[0]?.date || doc.date,
                            time: s.time || s.doc?.time || doc.time,
                            warehouse: s.warehouse || s.doc?.warehouse || doc.warehouse,
                            createdBy: s.createdBy || s.doc?.createdBy || doc.createdBy,
                            receiver: s.receiver || s.doc?.receiver || doc.receiver,
                            description: s.description || s.doc?.description || doc.description,
                            lines: Array.isArray(s.lines) ? s.lines : (Array.isArray(s.doc?.lines) ? s.doc.lines : (Array.isArray(s.docs?.[0]?.lines) ? s.docs[0].lines : doc.lines)),
                          };
                          return (
                            <div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <div>
                                  <div className="text-xs text-zinc-500">Số phiếu</div>
                                  <div className="font-medium">{pdoc.code}{previewVersionNumber ? `-v${previewVersionNumber}` : ''}</div>
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
                        } catch { return <pre className="text-xs">{String(previewVersionSnapshot)}</pre>; }
                      })()}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
  <style>{`@media print { @page { size: A4; margin: 8mm; } body { -webkit-print-color-adjust: exact; } }
  .print-strong-border th, .print-strong-border td { border-color: #404040 !important; border-width: 1.5px !important; }
  .print-strong-border thead th { border-width: 1.5px !important; }
  `}</style>
    </div>
  );
}

export default function PrintInboundPage() {
  return (
    <Suspense fallback={<div className="p-6">Đang tải…</div>}>
      <InboundContent />
    </Suspense>
  );
}
