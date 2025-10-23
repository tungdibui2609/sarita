"use client";

import { useEffect, useMemo, useState } from "react";

type User = {
  id: number;
  name?: string;
  username: string;
  position?: string; // Chức vụ hiển thị (cột F)
  status?: string;
  lastseen?: string;
  isOnline?: boolean;
  roleCodes?: string[]; // Phân quyền (cột D)
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<string | "Tất cả">("Tất cả");
  const [allRoleCodes, setAllRoleCodes] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<(User & { password?: string; originalUsername?: string }) | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadUsers(abortFlag?: { aborted: boolean }) {
    try {
      setLoading(true);
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = await res.json();
      if (!(abortFlag?.aborted) && data?.ok) {
        const list = (data.users as any[]).map((u, idx) => ({
          id: idx + 1,
          name: u.name || "",
          username: u.username,
          position: u.position || u.role || "",
          status: u.status,
          lastseen: u.lastseen,
          isOnline: Boolean(u.isOnline),
          roleCodes: Array.isArray(u.roles) ? u.roles : [],
        })) as User[];
        setUsers(list);
      }
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => {
    const flag = { aborted: false };
    loadUsers(flag);
    // Lấy danh sách code-role từ API (cột J)
    (async () => {
      try {
        const res = await fetch("/api/users", { method: "OPTIONS" });
        const js = await res.json();
        if (js?.ok && Array.isArray(js.roleCodes)) setAllRoleCodes(js.roleCodes);
      } catch {}
    })();
    return () => {
      flag.aborted = true;
    };
  }, []);

  // Auto-refresh mỗi 30s khi đang ở trang Users (component đang mounted)
  useEffect(() => {
    const id = setInterval(() => {
      // Chỉ refresh khi tab đang visible để tiết kiệm tài nguyên
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        loadUsers();
      }
    }, 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const matchesQ = q
        ? [u.username, u.name || ""].some((v) => v.toLowerCase().includes(q))
        : true;
      const matchesPosition = positionFilter === "Tất cả" ? true : (u.position || "") === positionFilter;
      return matchesQ && matchesPosition;
    });
  }, [users, query, positionFilter]);

  const uniquePositions = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.position) set.add(u.position);
    });
    return Array.from(set.values());
  }, [users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  function resetForm() {
    setEditing(null);
    setShowModal(false);
  }

  function onCreate() {
    setEditing({
      id: 0,
      name: "",
      username: "",
      position: "",
      password: "",
      roleCodes: [],
    } as any);
    setShowModal(true);
  }

  function onEdit(u: User) {
    setEditing({ ...u, password: "", originalUsername: u.username });
    setShowModal(true);
  }

  function onDelete(u: User) {
    if (!confirm(`Vô hiệu hóa tài khoản “${u.username}”?\n(Bạn có thể bật lại sau bằng cách khôi phục)`)) return;
    (async () => {
      try {
        const res = await fetch("/api/users", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: u.username }),
        });
        const js = await res.json();
        if (!res.ok || !js.ok) throw new Error(js.error || "Vô hiệu hóa thất bại");
        await loadUsers();
      } catch (e: any) {
        alert(e?.message || "Có lỗi khi vô hiệu hóa tài khoản");
      }
    })();
  }

  async function restoreUser(username: string) {
    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, status: "offline" }),
    });
    const js = await res.json();
    if (!res.ok || !js.ok) throw new Error(js.error || "Khôi phục thất bại");
    await loadUsers();
  }

  async function saveUser() {
    if (!editing) return;
    const { id, username, password = "", name = "", position = "", roleCodes = [] } = editing as any;
    if (!username) {
      alert("Vui lòng nhập tài khoản");
      return;
    }
    if (id === 0) {
      if (!password || password.length < 6) {
        alert("Mật khẩu phải có ít nhất 6 ký tự");
        return;
      }
    }
    try {
      if (id === 0) {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, name, position, roleCodes }),
        });
        const js = await res.json();
        if (!res.ok || !js.ok) throw new Error(js.error || "Tạo người dùng thất bại");
      } else {
        const res = await fetch("/api/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ originalUsername: editing.originalUsername || username, username, password, name, position, roleCodes }),
        });
        const js = await res.json();
        if (!res.ok || !js.ok) throw new Error(js.error || "Cập nhật người dùng thất bại");
      }
      await loadUsers();
      resetForm();
    } catch (e: any) {
      alert(e?.message || "Có lỗi khi lưu người dùng");
    }
  }

  function parseLastSeen(s?: string): Date | null {
    if (!s) return null;
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return new Date(t);
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      const [_, dd, mm, yyyy, hh, min, ss] = m;
      const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), ss ? Number(ss) : 0);
      return d;
    }
    return null;
  }

  function formatRelativeLastActive(s?: string): string {
    const d = parseLastSeen(s);
    if (!d) return "—";
    const now = Date.now();
    const diff = Math.max(0, now - d.getTime());
    const sec = Math.floor(diff / 1000);
    if (sec < 5) return "now";
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}d ago`;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold inline-flex items-center gap-2">
          Quản lý người dùng
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white text-sm px-3 py-2 hover:bg-emerald-700"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Thêm người dùng
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-900/70 backdrop-blur p-4 ring-1 ring-black/5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <div className="flex-1">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 bg-white/60 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                placeholder="Tìm theo tài khoản"
              />
            </div>
          </div>
          <select
            value={positionFilter}
            onChange={(e) => { setPositionFilter(e.target.value as string | "Tất cả"); setPage(1); }}
            className="rounded-lg border border-zinc-200 bg-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
          >
            <option value="Tất cả">Tất cả chức vụ</option>
            {uniquePositions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
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
                <th className="text-left font-medium px-4 py-3">Họ tên</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Chức vụ</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Vai trò</th>
                <th className="text-left font-medium px-4 py-3">Trạng thái</th>
                <th className="text-right font-medium px-4 py-3">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
              {items.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-3">{u.name || u.username}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {u.position || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {u.roleCodes && u.roleCodes.length > 0 ? (
                      (() => {
                        const roles = u.roleCodes || [];
                        const row1 = roles.slice(0, 3);
                        const row2 = roles.slice(3, 6);
                        const extra = Math.max(0, roles.length - 6);
                        const Badge = ({ value }: { value: string }) => (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{value}</span>
                        );
                        return (
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap gap-1">
                              {row1.map((code) => (
                                <Badge key={`r1-${code}`} value={code} />
                              ))}
                            </div>
                            {row2.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {row2.map((code) => (
                                  <Badge key={`r2-${code}`} value={code} />
                                ))}
                                {extra > 0 && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">+{extra}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {String(u.status || "").toLowerCase() === "disabled" ? (
                      <span className="inline-flex items-center gap-1 text-red-500 text-xs">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Disabled
                      </span>
                    ) : u.isOnline ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Online
                      </span>
                    ) : (
                      <div className="flex flex-col items-start text-zinc-400 text-xs">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-zinc-400" />
                          Offline
                        </span>
                        <span className="text-[11px] text-zinc-400 mt-0.5">{formatRelativeLastActive(u.lastseen)}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      {String(u.status || "").toLowerCase() === "disabled" && (
                        <button
                          onClick={async () => {
                            try {
                              await restoreUser(u.username);
                            } catch (e: any) {
                              alert(e?.message || "Có lỗi khi khôi phục tài khoản");
                            }
                          }}
                          className="px-2 py-1 rounded-md text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                        >
                          Khôi phục
                        </button>
                      )}
                      <button onClick={() => onEdit(u)} className="px-2 py-1 rounded-md text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20">Sửa</button>
                      {String(u.status || "").toLowerCase() !== "disabled" && (
                        <button onClick={() => onDelete(u)} className="px-2 py-1 rounded-md text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20">Xóa</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Không có dữ liệu phù hợp</td>
                </tr>
              )}
            </tbody>
          </table>
          )}
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200/70 dark:border-zinc-800/70 text-sm">
          <div className="text-zinc-500">Trang {currentPage}/{totalPages} — {filtered.length} người dùng</div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
            >
              Trước
            </button>
            <button
              className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      {/* Modal Create/Edit */}
      {showModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={resetForm} />
          <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white dark:bg-zinc-900 p-5 md:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editing.id ? "Sửa người dùng" : "Thêm người dùng"}</h3>
              <button onClick={resetForm} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">×</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Họ tên */}
              <div>
                <label className="block text-sm mb-1">Họ tên</label>
                <input
                  value={(editing as any).name ?? ""}
                  onChange={(e) => setEditing({ ...(editing as User & { password?: string }), name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                  placeholder="Nhập họ tên"
                />
              </div>
              {/* Tài khoản */}
              <div>
                <label className="block text-sm mb-1">Tài khoản</label>
                <input
                  value={editing.username}
                  onChange={(e) => setEditing({ ...(editing as User & { password?: string }), username: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                />
              </div>
              {/* Chức vụ (hiển thị) */}
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Chức vụ (hiển thị)</label>
                <input
                  value={(editing as any).position ?? ""}
                  onChange={(e) => setEditing({ ...(editing as User & { password?: string }), position: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                  placeholder="Nhập chức vụ"
                />
              </div>
              {/* Mật khẩu */}
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Mật khẩu {editing.id !== 0 && <span className="text-xs text-zinc-500">(để trống nếu không đổi)</span>}</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={editing.password ?? ""}
                    onChange={(e) => setEditing({ ...(editing as User & { password?: string }), password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                    placeholder={editing.id === 0 ? "Nhập mật khẩu" : "Để trống nếu không đổi"}
                  />
                  <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute inset-y-0 right-2 my-auto h-8 w-8 inline-flex items-center justify-center text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                    {showPwd ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.62-1.46 1.57-2.78 2.77-3.86"/><path d="M10.58 10.58a2 2 0 1 0 2.83 2.83"/><path d="M23 1 1 23"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>
              {/* Phân quyền (cột D) - chọn nhiều từ code-role ở cột J */}
              <div className="md:col-span-2">
                <label className="block text-sm mb-1">Phân quyền (cột D) — chọn nhiều</label>
                <div className="flex flex-wrap gap-2">
                  {allRoleCodes.map((code) => {
                    const checked = (editing?.roleCodes || []).includes(code);
                    return (
                      <label key={code} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs cursor-pointer ${checked ? "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300" : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const cur = new Set(editing?.roleCodes || []);
                            if (e.target.checked) cur.add(code); else cur.delete(code);
                            setEditing({ ...(editing as any), roleCodes: Array.from(cur.values()) });
                          }}
                        />
                        {code}
                      </label>
                    );
                  })}
                  {allRoleCodes.length === 0 && (
                    <span className="text-xs text-zinc-500">Không có code-role nào trong cột J</span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={resetForm} className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">Hủy</button>
              <button onClick={saveUser} className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

