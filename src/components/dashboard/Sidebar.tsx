"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const nav = [
  { href: "/dashboard", label: "Tổng quan", icon: "overview" },
  { href: "/dashboard/users", label: "Quản lý người dùng", icon: "users" },
  { href: "/dashboard/products", label: "Quản lý sản phẩm", icon: "products" },
  { href: "/dashboard/inventory", label: "Tồn kho", icon: "inventory" },
  { href: "/dashboard/inbound", label: "Nhập kho", icon: "inbound" },
  { href: "/dashboard/outbound", label: "Xuất kho", icon: "outbound" },
  { href: "/dashboard/transfers", label: "Chuyển đổi", icon: "transfer" },
  { href: "/dashboard/locations", label: "Vị trí kệ", icon: "location" },
  { href: "/dashboard/cycle-counts", label: "Kiểm kê định kỳ", icon: "cycle" },
  { href: "/dashboard/settings", label: "Cài đặt", icon: "settings" },
];

function Icon({ name }: { name: string }) {
  const cls = "size-4";
  switch (name) {
    case "overview":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 13h8V3H3v10zM13 21h8V3h-8v18zM3 21h8v-6H3v6z"/></svg>
      );
    case "inventory":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
      );
    case "products":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <path d="M3.27 6.96L12 12l8.73-5.04"/>
          <path d="M12 22V12"/>
        </svg>
      );
    case "users":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      );
    case "inbound":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      );
    case "outbound":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9v6a2 2 0 0 0 2 2h6"/><path d="M21 15V9a2 2 0 0 0-2-2h-6"/><polyline points="17 8 21 12 17 16"/></svg>
      );
    case "transfer":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7h12l-4-4"/><path d="M16 17H4l4 4"/><path d="M18 19V5"/></svg>
      );
    case "location":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      );
    case "cycle":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10M1 14l5.36 4.36A9 9 0 0 0 20.49 15"/></svg>
      );
    case "settings":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 15a1.65 1.65 0 0 0-1.51-1H2a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 3.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 3.6a1.65 1.65 0 0 0 1-1.51V2a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c.36 0 .7.07 1 .2.3.13.64.2 1 .2a2 2 0 1 1 0 4c-.36 0-.7-.07-1-.2-.3-.13-.64-.2-1-.2z"/>
        </svg>
      );
    default:
      return null;
  }
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [startX, setStartX] = useState<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  function closeOnSmall() {
    try {
      if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 767px)").matches) {
        onClose();
      }
    } catch {}
  }

  function onTouchStart(e: React.TouchEvent) {
    if (!open) return;
    const x = e.touches[0]?.clientX ?? 0;
    setStartX(x);
    setDragging(true);
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!open || startX === null) return;
    const x = e.touches[0]?.clientX ?? 0;
    const delta = x - startX; // negative when swiping left
    const clamped = Math.max(-300, Math.min(0, delta));
    setDragX(clamped);
  }
  function onTouchEnd() {
    if (!open) return;
    // if swiped left beyond threshold, close
    if (dragX < -80) {
      onClose();
    }
    setStartX(null);
    setDragX(0);
    setDragging(false);
  }
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed z-40 inset-y-0 left-0 w-64 transform md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"} ${dragging ? "transition-none" : "transition-transform duration-200"} bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-r border-zinc-200/70 dark:border-zinc-800/70`}
        style={open ? { transform: `translateX(${dragX}px)` } : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      > 
        <div className="px-3 py-4 border-b border-zinc-200/70 dark:border-zinc-800/70 flex items-center justify-between">
          <Link href="/dashboard" className="block flex-1" onClick={closeOnSmall}>
            <img
              src="/logo.png"
              alt="Logo"
              className="w-full h-12 object-contain select-none"
            />
          </Link>
          <button
            onClick={onClose}
            className="md:hidden ml-2 inline-flex items-center justify-center w-9 h-9 rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Đóng menu"
            title="Đóng menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <nav className="p-3 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeOnSmall}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
