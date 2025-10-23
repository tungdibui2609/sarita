"use client";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/hooks/useTheme";

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showChangePw, setShowChangePw] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { isDark, toggle: toggleTheme } = useTheme();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const [displayName, setDisplayName] = useState<string>("Người dùng");
  const [userRole, setUserRole] = useState<string>("Nhân viên");
  const [username, setUsername] = useState<string>("username");

  async function logout() {
    try {
      const payload = username ? { username } : {};
      await fetch("/api/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {}
    try {
      // Clear local session info
      localStorage.removeItem("userName");
      localStorage.removeItem("userRole");
      localStorage.removeItem("userUsername");
    } catch {}
    window.location.href = "/";
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (avatarMenuOpen && menuRef.current && !menuRef.current.contains(target)) {
        setAvatarMenuOpen(false);
      }
      if (profileMenuOpen && profileRef.current && !profileRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [avatarMenuOpen, profileMenuOpen]);

  // Lấy thông tin người dùng từ localStorage (demo)
  useEffect(() => {
    try {
      const name = localStorage.getItem("userName");
      const role = localStorage.getItem("userRole");
      const uname = localStorage.getItem("userUsername");
      if (name) setDisplayName(name);
      if (role) setUserRole(role);
      if (uname) setUsername(uname);
    } catch {}
  }, []);

  function onPickAvatar() {
    fileRef.current?.click();
  }
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(reader.result as string);
    reader.readAsDataURL(f);
    setAvatarMenuOpen(false);
  }

  return (
    <>
    <header className="sticky top-0 z-30 backdrop-blur bg-white/70 dark:bg-zinc-900/70 border-b border-zinc-200/70 dark:border-zinc-800/70">
      <div className="flex items-center gap-3 px-4 h-14">
        {/* Hamburger first (mobile) */}
        <button
          onClick={onMenu}
          className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label="Mở menu"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>

        {/* Avatar next */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setAvatarMenuOpen((v) => !v)}
            className="relative w-11 h-11 rounded-full overflow-hidden ring-1 ring-black/5 dark:ring-white/10"
            aria-haspopup="menu"
            aria-expanded={avatarMenuOpen}
            title="Tài khoản (bấm để xem thêm)"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-blue-500" />
            )}
          </button>
          {avatarMenuOpen && (
            <div className="absolute left-0 mt-2 w-56 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg text-sm dark:border-zinc-700 dark:bg-zinc-900 z-50">
              {/* Header info: name + role from Google Sheet */}
              <div className="px-3 pt-3 pb-2">
                <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{displayName}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{userRole}</div>
              </div>
              <div className="h-px mx-2 bg-zinc-200 dark:bg-zinc-800" />
              <button onClick={onPickAvatar} className="w-full text-left px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
                Cập nhật avatar
              </button>
              <button onClick={() => { setShowChangePw(true); setAvatarMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11V7a4 4 0 1 1 8 0v4"/><rect x="3" y="11" width="18" height="10" rx="2"/></svg>
                Đổi mật khẩu
              </button>
              <button onClick={logout} className="w-full text-left px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center gap-2 text-red-600 dark:text-red-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Đăng xuất
              </button>
            </div>
          )}
        </div>

        {/* Chào mừng + chức vụ (hiện cả trên mobile, thu gọn để không tràn) */}
        <div className="flex flex-col min-w-0 leading-tight max-w-[42vw] sm:max-w-none">
          <span className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">Chào mừng, {displayName}</span>
          <span className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 truncate">{userRole}</span>
        </div>

        

        <div className="flex items-center gap-3 ml-auto">
          {/* Profile icon and dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileMenuOpen((v) => !v)}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              title="Hồ sơ"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </button>
            {profileMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg text-sm dark:border-zinc-700 dark:bg-zinc-900 z-50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-blue-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{displayName}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">@{username}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{userRole}</div>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  <button onClick={() => { onPickAvatar(); setProfileMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
                    Cập nhật avatar
                  </button>
                  <button onClick={() => { setShowChangePw(true); setProfileMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11V7a4 4 0 1 1 8 0v4"/><rect x="3" y="11" width="18" height="10" rx="2"/></svg>
                    Đổi mật khẩu
                  </button>
                  <button onClick={logout} className="w-full text-left px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center gap-2 text-red-600 dark:text-red-400">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notifications */}
          <button className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800" aria-label="Thông báo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          </button>

          {/* Theme toggle at far right */}
          <button
            onClick={toggleTheme}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Chuyển giao diện"
            title="Chuyển giao diện sáng/tối"
          >
            {isDark ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>

        </div>
      </div>

    </header>
    {/* Hidden file input for avatar */}
    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
    {/* Change password modal */}
    {showChangePw && (
      <ChangePasswordModal onClose={() => setShowChangePw(false)} />
    )}
    </>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);

  function submit() {
    if (!nextPw || nextPw.length < 6) { alert("Mật khẩu mới phải ≥ 6 ký tự"); return; }
    if (nextPw !== confirm) { alert("Xác nhận mật khẩu không khớp"); return; }
    // Demo: Thông báo thành công. Thực tế sẽ gọi API.
    alert("Đã đổi mật khẩu");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-sm mx-4 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white dark:bg-zinc-900 p-5 md:p-6 shadow-xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Đổi mật khẩu</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">×</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Mật khẩu hiện tại</label>
            <input autoFocus type={show ? "text" : "password"} value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
          </div>
          <div>
            <label className="block text-sm mb-1">Mật khẩu mới</label>
            <input type={show ? "text" : "password"} value={nextPw} onChange={(e) => setNextPw(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
          </div>
          <div>
            <label className="block text-sm mb-1">Xác nhận mật khẩu</label>
            <input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800" />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Hiện mật khẩu</label>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">Hủy</button>
          <button onClick={submit} className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Cập nhật</button>
        </div>
      </div>
    </div>
  );
}
