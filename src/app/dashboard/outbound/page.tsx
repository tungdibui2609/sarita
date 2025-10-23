"use client";

import { useMemo, useState } from "react";

type Status = "Nháp" | "Đã duyệt" | "Đã hủy";
type Line = { id: number; product: string; unit: string; qty: number };
type Doc = {
  id: number;
  code: string;
  date: string; // YYYY-MM-DD
  partner: string; // Khách hàng/Đơn vị nhận
  warehouse: string;
  status: Status;
  items: number;
  quantity: number;
  note?: string;
  lines: Line[];
};

const WAREHOUSES = ["Kho Tổng", "Kho Nguyên liệu", "Kho Thành phẩm"];
const UNITS = ["Cái", "Thùng", "Kg", "Lít"];
const STATUSES: Status[] = ["Nháp", "Đã duyệt", "Đã hủy"];

function dateToStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function genDocs(n = 24): Doc[] {
  const today = new Date();
  const arr: Doc[] = [];
  for (let i = 1; i <= n; i++) {
    const daysAgo = Math.floor(Math.random() * 28);
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    const lines: Line[] = Array.from({ length: 1 + (i % 3) }).map((_, idx) => ({
      id: idx + 1,
      product: `SP-${(i * 5 + idx + 7).toString().padStart(4, "0")}`,
      unit: UNITS[(i + idx) % UNITS.length],
      qty: 2 + ((i + idx) % 9),
    }));
    const qty = lines.reduce((s, l) => s + l.qty, 0);
    arr.push({
      id: i,
      code: `PXK${String(i).padStart(5, "0")}`,
      date: dateToStr(d),
      partner: `KH ${((i % 6) + 1).toString().padStart(2, "0")}`,
      warehouse: WAREHOUSES[i % WAREHOUSES.length],
      status: STATUSES[i % STATUSES.length],
      items: lines.length,
      quantity: qty,
      note: i % 4 === 0 ? "Phiếu xuất giao hàng" : undefined,
      lines,
    });
  }
  return arr;
}

export default function OutboundPage() {
  const [docs, setDocs] = useState<Doc[]>(() => genDocs());
  const [query, setQuery] = useState("");
  const [warehouse, setWarehouse] = useState<string | "Tất cả">("Tất cả");
  const [status, setStatus] = useState<Status | "Tất cả">("Tất cả");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [selected, setSelected] = useState<number[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      const matchesQ = q ? [d.code, d.partner].some((v) => v.toLowerCase().includes(q)) : true;
      const matchesWh = warehouse === "Tất cả" ? true : d.warehouse === warehouse;
      const matchesStatus = status === "Tất cả" ? true : d.status === status;
      const df = dateFrom ? new Date(dateFrom) : null;
      const dt = dateTo ? new Date(dateTo) : null;
      const dd = new Date(d.date);
      const matchesFrom = df ? dd >= df : true;
      const matchesTo = dt ? dd <= dt : true;
      return matchesQ && matchesWh && matchesStatus && matchesFrom && matchesTo;
    });
  }, [docs, query, warehouse, status, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  function onCreate() {
    setEditing({
      id: 0,
      code: "",
      date: dateToStr(new Date()),
      partner: "",
      warehouse: WAREHOUSES[0],
      status: "Nháp",
      items: 0,
      quantity: 0,
      note: "",
      lines: [],
    });
    setShowModal(true);
  }
  function onEdit(d: Doc) { setEditing({ ...d, lines: d.lines.map(l => ({ ...l })) }); setShowModal(true); }
  function onDelete(d: Doc) { if (!confirm(`Xóa phiếu ${d.code}?`)) return; setDocs((prev) => prev.filter((x) => x.id !== d.id)); }
  function addLine() {
    if (!editing) return;
    const nextId = (editing.lines.at(-1)?.id ?? 0) + 1;
    setEditing({ ...editing, lines: [...editing.lines, { id: nextId, product: "", unit: UNITS[0], qty: 1 }] });
  }
  function removeLine(id: number) {
    if (!editing) return;
    setEditing({ ...editing, lines: editing.lines.filter((l) => l.id !== id) });
  }
  function saveDoc() {
    if (!editing) return;
    if (!editing.code) {
      const nextNum = (docs.length ? Math.max(...docs.map((x) => x.id)) : 0) + 1;
      editing.code = `PXK${String(nextNum).padStart(5, "0")}`;
    }
    if (!editing.date || !editing.partner) { alert("Vui lòng nhập Ngày và Đơn vị nhận"); return; }
    const qty = editing.lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    editing.items = editing.lines.length;
    editing.quantity = qty;
    setDocs((prev) => {
      if (editing.id === 0) {
        const newId = prev.length ? Math.max(...prev.map((x) => x.id)) + 1 : 1;
        return [{ ...editing, id: newId }, ...prev];
      }
      return prev.map((x) => (x.id === editing.id ? editing : x));
    });
    setShowModal(false);
    setEditing(null);
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
  function approveSelected() {
    if (selected.length === 0) { alert("Vui lòng chọn ít nhất 1 phiếu"); return; }
    setDocs(prev => prev.map(d => selected.includes(d.id) && d.status === "Nháp" ? { ...d, status: "Đã duyệt" } : d));
  }
  async function exportSelectedExcel() {
    if (selected.length === 0) { alert("Vui lòng chọn ít nhất 1 phiếu để xuất"); return; }
    const dataSel = docs.filter((d) => selected.includes(d.id));
    if (dataSel.length === 0) { alert("Không có dữ liệu để xuất"); return; }
    const payload = dataSel.map((d) => ({
      code: d.code,
      date: d.date,
      partner: d.partner,
      warehouse: d.warehouse,
      status: d.status,
      note: d.note,
      lines: d.lines.map((l) => ({ product: l.product, unit: l.unit, qty: l.qty })),
    }));
    try {
      const res = await fetch("/api/outbound/print-excel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docs: payload }) });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = dateToStr(new Date());
      a.href = url; a.download = `phieu-xuat-${today}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "Xuất Excel thất bại");
    }
  }

  function printSelectedBrowser() {
    if (selected.length !== 1) { alert("Vui lòng chọn đúng 1 phiếu để in"); return; }
    const d = docs.find(x => x.id === selected[0]);
    if (!d) { alert("Không tìm thấy phiếu đã chọn"); return; }
    try {
      localStorage.setItem("qlk_print_outbound", JSON.stringify(d));
    } catch {}
    window.open(`/print/outbound?code=${encodeURIComponent(d.code)}`, "_blank");
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Xuất kho</h1>
        <button onClick={onCreate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white text-sm px-3 py-2 hover:bg-emerald-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tạo phiếu xuất
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-900/70 backdrop-blur p-4 ring-1 ring-black/5">
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); setSelected([]); }} placeholder="Tìm theo số phiếu hoặc đơn vị nhận" className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 bg-white/60 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
            </div>
          </div>
          <select value={warehouse} onChange={(e) => { setWarehouse(e.target.value); setPage(1); setSelected([]); }} className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
            <option value="Tất cả">Tất cả kho</option>
            {WAREHOUSES.map((w) => (<option key={w} value={w}>{w}</option>))}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value as Status | "Tất cả"); setPage(1); setSelected([]); }} className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
            <option value="Tất cả">Tất cả trạng thái</option>
            {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); setSelected([]); }} className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); setSelected([]); }} className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
          <div className="lg:col-span-6 flex flex-wrap items-center gap-2 pt-1 justify-start lg:justify-end">
            <button onClick={approveSelected} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-sm dark:border-emerald-900/40 dark:text-emerald-300 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              Duyệt phiếu
            </button>
            
            <button onClick={printSelectedBrowser} disabled={selected.length !== 1} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 text-sm dark:border-zinc-700 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 3 18 3 18 9"/><rect x="6" y="13" width="12" height="8"/><line x1="6" y1="17" x2="6" y2="17"/></svg>
              In
            </button>
            <button onClick={exportSelectedExcel} disabled={selected.length === 0} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 text-sm dark:border-zinc-700 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed">
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
                <th className="text-left font-medium px-4 py-3">Số phiếu</th>
                <th className="text-left font-medium px-4 py-3">Ngày</th>
                <th className="text-left font-medium px-4 py-3">Đơn vị nhận</th>
                <th className="text-left font-medium px-4 py-3">Kho</th>
                <th className="text-right font-medium px-4 py-3">Số dòng</th>
                <th className="text-right font-medium px-4 py-3">Số lượng</th>
                <th className="text-left font-medium px-4 py-3">Trạng thái</th>
                <th className="text-right font-medium px-4 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
              {items.map((d) => (
                <tr key={d.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded" checked={selected.includes(d.id)} onChange={() => toggleSelect(d.id)} aria-label={`Chọn ${d.code}`} />
                  </td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{d.code}</td>
                  <td className="px-4 py-3">{d.date}</td>
                  <td className="px-4 py-3">{d.partner}</td>
                  <td className="px-4 py-3">{d.warehouse}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{d.items}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{d.quantity}</td>
                  <td className="px-4 py-3">
                    {d.status === "Đã duyệt" ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Đã duyệt</span>
                    ) : d.status === "Nháp" ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">Nháp</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">Đã hủy</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      
                      <button onClick={() => onEdit(d)} className="px-2 py-1 rounded-md text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20">Sửa</button>
                      <button onClick={() => onDelete(d)} className="px-2 py-1 rounded-md text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20">Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">Không có dữ liệu phù hợp</td>
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
      {showModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => { setShowModal(false); setEditing(null); }} />
          <div className="relative w-full max-w-3xl mx-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white dark:bg-zinc-900 p-5 md:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editing.id ? "Sửa phiếu xuất" : "Tạo phiếu xuất"}</h3>
              <button onClick={() => { setShowModal(false); setEditing(null); }} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-1">Số phiếu</label>
                <input value={editing.code} onChange={(e) => setEditing({ ...(editing as Doc), code: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="block text-sm mb-1">Ngày</label>
                <input type="date" value={editing.date} onChange={(e) => setEditing({ ...(editing as Doc), date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="block text-sm mb-1">Kho</label>
                <select value={editing.warehouse} onChange={(e) => setEditing({ ...(editing as Doc), warehouse: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                  {WAREHOUSES.map((w) => (<option key={w} value={w}>{w}</option>))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Đơn vị nhận</label>
                <input value={editing.partner} onChange={(e) => setEditing({ ...(editing as Doc), partner: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="block text-sm mb-1">Trạng thái</label>
                <select value={editing.status} onChange={(e) => setEditing({ ...(editing as Doc), status: e.target.value as Status })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                  {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
              <div className="lg:col-span-3">
                <label className="block text-sm mb-1">Ghi chú</label>
                <textarea value={editing.note ?? ""} onChange={(e) => setEditing({ ...(editing as Doc), note: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 min-h-[74px]" />
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Chi tiết hàng hóa</h4>
                <button onClick={addLine} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Thêm dòng
                </button>
              </div>
              <div className="rounded-xl border border-zinc-200/70 dark:border-zinc-800/70 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50/70 dark:bg-zinc-800/50 text-zinc-500">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Sản phẩm</th>
                        <th className="text-left font-medium px-3 py-2">Đơn vị</th>
                        <th className="text-right font-medium px-3 py-2">Số lượng</th>
                        <th className="text-right font-medium px-3 py-2">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
                      {editing.lines.map((l) => (
                        <tr key={l.id}>
                          <td className="px-3 py-2">
                            <input value={l.product} onChange={(e) => setEditing({ ...(editing as Doc), lines: editing.lines.map(x => x.id === l.id ? { ...x, product: e.target.value } : x) })} className="w-full px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" placeholder="Mã/Tên sản phẩm" />
                          </td>
                          <td className="px-3 py-2">
                            <select value={l.unit} onChange={(e) => setEditing({ ...(editing as Doc), lines: editing.lines.map(x => x.id === l.id ? { ...x, unit: e.target.value } : x) })} className="w-full px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                              {UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input type="number" min={0} value={l.qty} onChange={(e) => setEditing({ ...(editing as Doc), lines: editing.lines.map(x => x.id === l.id ? { ...x, qty: Number(e.target.value) } : x) })} className="w-28 text-right px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => removeLine(l.id)} className="px-2 py-1 rounded-md text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20">Xóa</button>
                          </td>
                        </tr>
                      ))}
                      {editing.lines.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">Chưa có dòng hàng hóa</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => { setShowModal(false); setEditing(null); }} className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">Hủy</button>
              <button onClick={saveDoc} className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
