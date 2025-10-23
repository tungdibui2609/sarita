"use client";

import { useMemo, useState } from "react";

type Loc = {
  id: number;
  code: string; // e.g., A-01-01
  zone: string; // A/B/C
  rack: string; // 01..nn
  shelf: string; // 01..nn
  capacity: number; // Suc chua
  occupied: number; // Dang chua
  status: "Đang dùng" | "Khóa";
  note?: string;
};

const ZONES = ["A", "B", "C", "D"];
const RACKS = Array.from({ length: 10 }).map((_, i) => String(i + 1).padStart(2, "0"));
const SHELVES = Array.from({ length: 5 }).map((_, i) => String(i + 1).padStart(2, "0"));

function genLocations(n = 60): Loc[] {
  const arr: Loc[] = [];
  for (let i = 1; i <= n; i++) {
    const zone = ZONES[i % ZONES.length];
    const rack = RACKS[i % RACKS.length];
    const shelf = SHELVES[i % SHELVES.length];
    arr.push({
      id: i,
      code: `${zone}-${rack}-${shelf}`,
      zone,
      rack,
      shelf,
      capacity: 100,
      occupied: (i * 7) % 100,
      status: i % 7 === 0 ? "Khóa" : "Đang dùng",
      note: i % 9 === 0 ? "Vị trí tạm giữ" : undefined,
    });
  }
  return arr;
}

export default function LocationsPage() {
  const [locs, setLocs] = useState<Loc[]>(() => genLocations());
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState<string | "Tất cả">("Tất cả");
  const [rack, setRack] = useState<string | "Tất cả">("Tất cả");
  const [status, setStatus] = useState<"Tất cả" | "Đang dùng" | "Khóa">("Tất cả");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Loc | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return locs.filter((l) => {
      const matchesQ = q ? [l.code, l.note ?? ""].some((v) => v.toLowerCase().includes(q)) : true;
      const matchesZone = zone === "Tất cả" ? true : l.zone === zone;
      const matchesRack = rack === "Tất cả" ? true : l.rack === rack;
      const matchesStatus = status === "Tất cả" ? true : l.status === status;
      return matchesQ && matchesZone && matchesRack && matchesStatus;
    });
  }, [locs, query, zone, rack, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  function onCreate() {
    setEditing({ id: 0, code: "", zone: ZONES[0], rack: RACKS[0], shelf: SHELVES[0], capacity: 100, occupied: 0, status: "Đang dùng", note: "" });
    setShowModal(true);
  }
  function onEdit(l: Loc) { setEditing({ ...l }); setShowModal(true); }
  function onDelete(l: Loc) { if (!confirm(`Xóa vị trí ${l.code}?`)) return; setLocs(prev => prev.filter(x => x.id !== l.id)); }
  function saveLoc() {
    if (!editing) return;
    if (!editing.code) {
      editing.code = `${editing.zone}-${editing.rack}-${editing.shelf}`;
    }
    setLocs(prev => {
      if (editing.id === 0) {
        const newId = prev.length ? Math.max(...prev.map(x => x.id)) + 1 : 1;
        return [{ ...editing, id: newId }, ...prev];
      }
      return prev.map(x => x.id === editing.id ? editing : x);
    });
    setShowModal(false);
    setEditing(null);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Vị trí kệ</h1>
        <button onClick={onCreate} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white text-sm px-3 py-2 hover:bg-emerald-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Thêm vị trí
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
              <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Tìm theo mã vị trí hoặc ghi chú" className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 bg-white/60 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100" />
            </div>
          </div>
          <select value={zone} onChange={(e) => { setZone(e.target.value); setPage(1); }} className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
            <option value="Tất cả">Tất cả zone</option>
            {ZONES.map((z) => (<option key={z} value={z}>{z}</option>))}
          </select>
          <select value={rack} onChange={(e) => { setRack(e.target.value); setPage(1); }} className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
            <option value="Tất cả">Tất cả rack</option>
            {RACKS.map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value as any); setPage(1); }} className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
            <option value="Tất cả">Tất cả trạng thái</option>
            <option value="Đang dùng">Đang dùng</option>
            <option value="Khóa">Khóa</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-900/70 backdrop-blur ring-1 ring-black/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50/70 dark:bg-zinc-800/50 text-zinc-500">
              <tr>
                <th className="text-left font-medium px-4 py-3">Mã vị trí</th>
                <th className="text-left font-medium px-4 py-3">Zone</th>
                <th className="text-left font-medium px-4 py-3">Rack</th>
                <th className="text-left font-medium px-4 py-3">Shelf</th>
                <th className="text-right font-medium px-4 py-3">Sức chứa</th>
                <th className="text-right font-medium px-4 py-3">Đang chứa</th>
                <th className="text-left font-medium px-4 py-3">Trạng thái</th>
                <th className="text-right font-medium px-4 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
              {items.map((l) => (
                <tr key={l.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{l.code}</td>
                  <td className="px-4 py-3">{l.zone}</td>
                  <td className="px-4 py-3">{l.rack}</td>
                  <td className="px-4 py-3">{l.shelf}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.capacity}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.occupied}</td>
                  <td className="px-4 py-3">
                    {l.status === "Đang dùng" ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Đang dùng</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">Khóa</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button onClick={() => onEdit(l)} className="px-2 py-1 rounded-md text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20">Sửa</button>
                      <button onClick={() => onDelete(l)} className="px-2 py-1 rounded-md text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20">Xóa</button>
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
          <div className="text-zinc-500">Trang {currentPage}/{totalPages} — {filtered.length} vị trí</div>
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
          <div className="relative w-full max-w-2xl mx-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white dark:bg-zinc-900 p-5 md:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editing.id ? "Sửa vị trí" : "Thêm vị trí"}</h3>
              <button onClick={() => { setShowModal(false); setEditing(null); }} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Zone</label>
                <select value={editing.zone} onChange={(e) => setEditing({ ...(editing as Loc), zone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                  {ZONES.map((z) => (<option key={z} value={z}>{z}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Rack</label>
                <select value={editing.rack} onChange={(e) => setEditing({ ...(editing as Loc), rack: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                  {RACKS.map((r) => (<option key={r} value={r}>{r}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Shelf</label>
                <select value={editing.shelf} onChange={(e) => setEditing({ ...(editing as Loc), shelf: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                  {SHELVES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Mã vị trí</label>
                <input value={editing.code} onChange={(e) => setEditing({ ...(editing as Loc), code: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" placeholder="A-01-01" />
              </div>
              <div>
                <label className="block text-sm mb-1">Sức chứa</label>
                <input type="number" min={0} value={editing.capacity} onChange={(e) => setEditing({ ...(editing as Loc), capacity: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="block text-sm mb-1">Đang chứa</label>
                <input type="number" min={0} value={editing.occupied} onChange={(e) => setEditing({ ...(editing as Loc), occupied: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
              </div>
              <div>
                <label className="block text-sm mb-1">Trạng thái</label>
                <select value={editing.status} onChange={(e) => setEditing({ ...(editing as Loc), status: e.target.value as any })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                  <option value="Đang dùng">Đang dùng</option>
                  <option value="Khóa">Khóa</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Ghi chú</label>
                <textarea value={editing.note ?? ""} onChange={(e) => setEditing({ ...(editing as Loc), note: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 min-h-[74px]" />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => { setShowModal(false); setEditing(null); }} className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">Hủy</button>
              <button onClick={saveLoc} className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
