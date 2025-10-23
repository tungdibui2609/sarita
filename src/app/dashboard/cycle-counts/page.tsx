"use client";

import { useMemo, useState } from "react";

type Status = "Nháp" | "Đã khóa" | "Hoàn tất";
type Line = { id: number; location: string; product: string; unit: string; systemQty: number; countedQty: number };
type Session = {
  id: number;
  code: string; // KK00001
  date: string; // YYYY-MM-DD
  warehouse: string;
  status: Status;
  areas: string[]; // khu vực kiểm kê
  lines: Line[];
};

const WAREHOUSES = ["Kho Tổng", "Kho Nguyên liệu", "Kho Thành phẩm"];
const UNITS = ["Cái", "Thùng", "Kg", "Lít"];

function dateToStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function genSessions(n = 12): Session[] {
  const arr: Session[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i * 3);
    const lines: Line[] = Array.from({ length: 3 + (i % 3) }).map((_, idx) => ({
      id: idx + 1,
      location: `A-${String((i + idx) % 10 + 1).padStart(2, "0")}-${String((i + idx) % 5 + 1).padStart(2, "0")}`,
      product: `SP-${(i * 11 + idx + 5).toString().padStart(4, "0")}`,
      unit: UNITS[(i + idx) % UNITS.length],
      systemQty: 50 + ((i + idx) % 30),
      countedQty: 48 + ((i + idx) % 35),
    }));
    arr.push({
      id: i,
      code: `KK${String(i).padStart(5, "0")}`,
      date: dateToStr(d),
      warehouse: WAREHOUSES[i % WAREHOUSES.length],
      status: (i % 3 === 0 ? "Hoàn tất" : i % 2 === 0 ? "Đã khóa" : "Nháp"),
      areas: ["A", "B"].slice(0, (i % 2) + 1),
      lines,
    });
  }
  return arr;
}

export default function CycleCountsPage() {
  const [sessions, setSessions] = useState<Session[]>(() => genSessions());
  const [query, setQuery] = useState("");
  const [warehouse, setWarehouse] = useState<string | "Tất cả">("Tất cả");
  const [status, setStatus] = useState<Status | "Tất cả">("Tất cả");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Session | null>(null);
  const [selected, setSelected] = useState<number[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      const matchesQ = q ? [s.code, s.warehouse, s.areas.join(", ")].some((v) => v.toLowerCase().includes(q)) : true;
      const matchesWh = warehouse === "Tất cả" ? true : s.warehouse === warehouse;
      const matchesStatus = status === "Tất cả" ? true : s.status === status;
      const df = dateFrom ? new Date(dateFrom) : null;
      const dt = dateTo ? new Date(dateTo) : null;
      const dd = new Date(s.date);
      const matchesFrom = df ? dd >= df : true;
      const matchesTo = dt ? dd <= dt : true;
      return matchesQ && matchesWh && matchesStatus && matchesFrom && matchesTo;
    });
  }, [sessions, query, warehouse, status, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  function onCreate() {
    setEditing({ id: 0, code: "", date: dateToStr(new Date()), warehouse: WAREHOUSES[0], status: "Nháp", areas: [], lines: [] });
    setShowModal(true);
  }
  function onEdit(s: Session) { setEditing({ ...s, lines: s.lines.map(l => ({ ...l })) }); setShowModal(true); }
  function onDelete(s: Session) {
    if (s.status !== "Nháp") { alert("Chỉ được xóa đợt ở trạng thái Nháp"); return; }
    if (!confirm(`Xóa đợt kiểm kê ${s.code}?`)) return;
    setSessions(prev => prev.filter(x => x.id !== s.id));
  }
  function addLine() {
    if (!editing) return;
    const nextId = (editing.lines.at(-1)?.id ?? 0) + 1;
    setEditing({ ...editing, lines: [...editing.lines, { id: nextId, location: "", product: "", unit: UNITS[0], systemQty: 0, countedQty: 0 }] });
  }
  function removeLine(id: number) { if (!editing) return; setEditing({ ...editing, lines: editing.lines.filter(l => l.id !== id) }); }
  function saveSession() {
    if (!editing) return;
    if (!editing.code) {
      const nextNum = (sessions.length ? Math.max(...sessions.map((x) => x.id)) : 0) + 1;
      editing.code = `KK${String(nextNum).padStart(5, "0")}`;
    }
    if (!editing.date) { alert("Vui lòng nhập Ngày"); return; }
    setSessions(prev => {
      if (editing.id === 0) {
        const newId = prev.length ? Math.max(...prev.map(x => x.id)) + 1 : 1;
        return [{ ...editing, id: newId }, ...prev];
      }
      return prev.map(x => x.id === editing.id ? editing : x);
    });
    setShowModal(false);
    setEditing(null);
  }
  function lockSelected() {
    if (selected.length === 0) { alert("Vui lòng chọn ít nhất 1 đợt"); return; }
    setSessions(prev => prev.map(s => selected.includes(s.id) && s.status === "Nháp" ? { ...s, status: "Đã khóa" } : s));
  }
  function finalizeSelected() {
    if (selected.length === 0) { alert("Vui lòng chọn ít nhất 1 đợt"); return; }
    // Chỉ hoàn tất các đợt đã khóa
    setSessions(prev => prev.map(s => selected.includes(s.id) && s.status === "Đã khóa" ? { ...s, status: "Hoàn tất" } : s));
  }
  function toggleSelect(id: number) { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }
  function toggleSelectAllPage() {
    const pageIds = items.map(i => i.id);
    const allSelected = pageIds.every(id => selected.includes(id));
    if (allSelected) setSelected(prev => prev.filter(id => !pageIds.includes(id)));
    else setSelected(prev => Array.from(new Set([...prev, ...pageIds])));
  }
  function variance(s: Session) {
    const sumSys = s.lines.reduce((acc, l) => acc + (Number(l.systemQty) || 0), 0);
    const sumCnt = s.lines.reduce((acc, l) => acc + (Number(l.countedQty) || 0), 0);
    return { sumSys, sumCnt, diff: sumCnt - sumSys };
  }
  function exportCSV() {
    const dataSel = (selected.length ? sessions.filter((s) => selected.includes(s.id)) : items);
    if (dataSel.length === 0) { alert("Không có dữ liệu để xuất"); return; }
    const header = ["Dot","Ngay","Kho","TrangThai","KhuVuc","TongHeThong","TongKiem","ChenhLech"];
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = dataSel.map((s: Session) => {
      const v = variance(s);
      return [s.code, s.date, s.warehouse, s.status, s.areas.join(" "), v.sumSys, v.sumCnt, v.diff].map(esc).join(",");
    });
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = dateToStr(new Date());
    a.href = url; a.download = `kiem-ke-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Kiểm kê định kỳ</h1>
        <button onClick={onCreate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white text-sm px-3 py-2 hover:bg-emerald-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tạo đợt kiểm kê
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
              <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); setSelected([]); }} placeholder="Tìm theo số đợt, kho, khu vực" className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 bg-white/60 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
            </div>
          </div>
          <select value={warehouse} onChange={(e) => { setWarehouse(e.target.value); setPage(1); setSelected([]); }} className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
            <option value="Tất cả">Tất cả kho</option>
            {WAREHOUSES.map((w) => (<option key={w} value={w}>{w}</option>))}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value as Status | "Tất cả"); setPage(1); setSelected([]); }} className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
            <option value="Tất cả">Tất cả trạng thái</option>
            <option value="Nháp">Nháp</option>
            <option value="Đã khóa">Đã khóa</option>
            <option value="Hoàn tất">Hoàn tất</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); setSelected([]); }} className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); setSelected([]); }} className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />

          <div className="lg:col-span-6 flex flex-wrap items-center gap-2 pt-1 justify-start lg:justify-end">
            <button onClick={lockSelected} className="inline-flex items-center gap-2 rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 text-sm dark:border-amber-900/40 dark:text-amber-300 dark:bg-amber-900/10 dark:hover:bg-amber-900/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 10V7a6 6 0 1 1 12 0v3"/><rect x="4" y="10" width="16" height="10" rx="2"/></svg>
              Khóa đợt
            </button>
            <button onClick={finalizeSelected} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-sm dark:border-emerald-900/40 dark:text-emerald-300 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              Hoàn tất
            </button>
            <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 text-sm dark:border-zinc-700 dark:hover:bg-zinc-800">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Xuất Excel
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
                <th className="text-left font-medium px-4 py-3">Số đợt</th>
                <th className="text-left font-medium px-4 py-3">Ngày</th>
                <th className="text-left font-medium px-4 py-3">Kho</th>
                <th className="text-left font-medium px-4 py-3">Khu vực</th>
                <th className="text-right font-medium px-4 py-3">SL hệ thống</th>
                <th className="text-right font-medium px-4 py-3">SL kiểm</th>
                <th className="text-right font-medium px-4 py-3">Chênh lệch</th>
                <th className="text-left font-medium px-4 py-3">Trạng thái</th>
                <th className="text-right font-medium px-4 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
              {items.map((s) => {
                const v = variance(s);
                return (
                  <tr key={s.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3"><input type="checkbox" className="rounded" checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)} aria-label={`Chọn ${s.code}`} /></td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{s.code}</td>
                    <td className="px-4 py-3">{s.date}</td>
                    <td className="px-4 py-3">{s.warehouse}</td>
                    <td className="px-4 py-3">{s.areas.join(", ")}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{v.sumSys}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{v.sumCnt}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{v.diff}</td>
                    <td className="px-4 py-3">
                      {s.status === "Hoàn tất" ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Hoàn tất</span>
                      ) : s.status === "Đã khóa" ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Đã khóa</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">Nháp</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => onEdit(s)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                          aria-label={`Sửa ${s.code}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                          Sửa
                        </button>
                        <button
                          onClick={() => onDelete(s)}
                          disabled={s.status !== "Nháp"}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed dark:border-red-900/40 dark:text-red-300 dark:bg-red-900/10 dark:hover:bg-red-900/20"
                          aria-label={`Xóa ${s.code}`}
                          title={s.status !== "Nháp" ? "Chỉ được xóa ở trạng thái Nháp" : undefined}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-zinc-500">Không có dữ liệu phù hợp</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <div className="text-zinc-500">Trang {currentPage}/{totalPages} — {filtered.length} đợt</div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>Trước</button>
            <button className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Sau</button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowModal(false); setEditing(null); }} />
          <div className="relative w-full max-w-4xl mx-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white dark:bg-zinc-900 p-5 md:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editing.id ? "Sửa đợt kiểm kê" : "Tạo đợt kiểm kê"}</h3>
              <button onClick={() => { setShowModal(false); setEditing(null); }} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">×</button>
            </div>
            {(() => {
              const st = editing.status;
              return (
                <div className="mb-3 text-xs text-zinc-500">
                  {st === "Nháp" && "Trạng thái Nháp: cho phép chỉnh sửa danh sách dòng và thông tin đợt."}
                  {st === "Đã khóa" && "Đã khóa: cố định danh sách kiểm và số liệu hệ thống. Chỉ nhập số lượng thực kiểm."}
                  {st === "Hoàn tất" && "Hoàn tất: chỉ xem, không cho phép chỉnh sửa."}
                </div>
              );
            })()}
            {(() => { const isLocked = editing.status === "Đã khóa"; const isFinal = editing.status === "Hoàn tất"; const disableHeader = isLocked || isFinal; return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm mb-1">Số đợt</label>
                <input disabled={disableHeader} value={editing.code} onChange={(e) => setEditing({ ...(editing as Session), code: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-60" />
              </div>
              <div>
                <label className="block text-sm mb-1">Ngày</label>
                <input disabled={disableHeader} type="date" value={editing.date} onChange={(e) => setEditing({ ...(editing as Session), date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-60" />
              </div>
              <div>
                <label className="block text-sm mb-1">Kho</label>
                <select disabled={disableHeader} value={editing.warehouse} onChange={(e) => setEditing({ ...(editing as Session), warehouse: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-60">
                  {WAREHOUSES.map((w) => (<option key={w} value={w}>{w}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Trạng thái</label>
                <select disabled={isFinal} value={editing.status} onChange={(e) => setEditing({ ...(editing as Session), status: e.target.value as Status })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-60">
                  <option value="Nháp">Nháp</option>
                  <option value="Đã khóa">Đã khóa</option>
                  <option value="Hoàn tất">Hoàn tất</option>
                </select>
              </div>
              <div className="lg:col-span-4">
                <label className="block text-sm mb-1">Khu vực</label>
                <input disabled={disableHeader} value={editing.areas.join(", ")} onChange={(e) => setEditing({ ...(editing as Session), areas: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-60" placeholder="VD: A, B" />
              </div>
            </div>
            ); })()}

            <div className="mt-5">
              {(() => { const isLocked = editing.status === "Đã khóa"; const isFinal = editing.status === "Hoàn tất"; return (
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Chi tiết kiểm kê</h4>
                <button disabled={isLocked || isFinal} onClick={addLine} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 disabled:opacity-60">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Thêm dòng
                </button>
              </div>
              ); })()}
              <div className="rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50/70 dark:bg-zinc-800/50 text-zinc-500">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Vị trí</th>
                        <th className="text-left font-medium px-3 py-2">Sản phẩm</th>
                        <th className="text-left font-medium px-3 py-2">ĐVT</th>
                        <th className="text-right font-medium px-3 py-2">SL hệ thống</th>
                        <th className="text-right font-medium px-3 py-2">SL kiểm</th>
                        <th className="text-right font-medium px-3 py-2">Chênh lệch</th>
                        <th className="text-right font-medium px-3 py-2">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
                      {editing.lines.map((l) => { const isLocked = editing.status === "Đã khóa"; const isFinal = editing.status === "Hoàn tất"; return (
                        <tr key={l.id}>
                          <td className="px-3 py-2">
                            <input disabled={isLocked || isFinal} value={l.location} onChange={(e) => setEditing({ ...(editing as Session), lines: editing.lines.map(x => x.id === l.id ? { ...x, location: e.target.value } : x) })} className="w-full px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-60" placeholder="A-01-01" />
                          </td>
                          <td className="px-3 py-2">
                            <input disabled={isLocked || isFinal} value={l.product} onChange={(e) => setEditing({ ...(editing as Session), lines: editing.lines.map(x => x.id === l.id ? { ...x, product: e.target.value } : x) })} className="w-full px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-60" placeholder="Mã/Tên sản phẩm" />
                          </td>
                          <td className="px-3 py-2">
                            <select disabled={isLocked || isFinal} value={l.unit} onChange={(e) => setEditing({ ...(editing as Session), lines: editing.lines.map(x => x.id === l.id ? { ...x, unit: e.target.value } : x) })} className="w-full px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-60">
                              {UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input disabled={isLocked || isFinal} type="number" min={0} value={l.systemQty} onChange={(e) => setEditing({ ...(editing as Session), lines: editing.lines.map(x => x.id === l.id ? { ...x, systemQty: Number(e.target.value) } : x) })} className="w-28 text-right px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-60" />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input disabled={isFinal} type="number" min={0} value={l.countedQty} onChange={(e) => setEditing({ ...(editing as Session), lines: editing.lines.map(x => x.id === l.id ? { ...x, countedQty: Number(e.target.value) } : x) })} className="w-28 text-right px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 disabled:opacity-60" />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{(l.countedQty - l.systemQty) || 0}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              disabled={isLocked || isFinal}
                              onClick={() => removeLine(l.id)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed dark:border-red-900/40 dark:text-red-300 dark:bg-red-900/10 dark:hover:bg-red-900/20"
                              aria-label="Xóa dòng"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                              Xóa
                            </button>
                          </td>
                        </tr>
                      ); })}
                      {editing.lines.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">Chưa có dòng kiểm kê</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => { setShowModal(false); setEditing(null); }} className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">Hủy</button>
              <button onClick={saveSession} className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
