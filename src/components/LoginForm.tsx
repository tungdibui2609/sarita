"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  // State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const toastTimer = useRef<any>(null);
  const year = new Date().getFullYear();
  const router = useRouter();

  const showToast = (message: string, type: "error" | "success" = "error") => {
    try { if (toastTimer.current) clearTimeout(toastTimer.current); } catch {}
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (data && data.message) ? data.message : "Đăng nhập thất bại";
        showToast(msg, "error");
        return; // Không throw để tránh overlay đỏ
      }
      // Lưu thông tin người dùng từ API để Topbar hiển thị
      try {
        localStorage.setItem("userUsername", username);
        if (data?.name) localStorage.setItem("userName", data.name);
        if (data?.role) localStorage.setItem("userRole", data.role);
      } catch {}
      router.push("/dashboard");
    } catch {
      showToast("Không thể kết nối máy chủ. Vui lòng thử lại.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center px-4 overflow-hidden bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-900 dark:via-zinc-950 dark:to-black">
      {toast && (
        <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-3">
          <div
            className={`max-w-md w-full rounded-lg border px-3 py-2 text-sm shadow-md ${
              toast.type === "error"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200"
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        </div>
      )}
      {/* Accent blobs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-emerald-200/50 blur-3xl dark:bg-emerald-900/20" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl dark:bg-blue-900/20" />
  <div className="w-full max-w-sm">
        {/* Logo outside card */}
  <div className="text-center mb-6">
          <img
            src="/logo.png"
            alt="Logo công ty"
            className="mx-auto w-[220px] h-auto md:w-[260px]"
          />
        </div>
        {/* Card */}
  <div className="rounded-2xl border border-zinc-200/70 bg-white/80 dark:bg-zinc-900/70 dark:border-zinc-800/70 shadow-lg backdrop-blur-xl p-5 md:p-7 ring-1 ring-black/5 min-h-[360px]">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Hệ Thống Quản Lý Kho</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Đăng nhập bằng tài khoản đã được cấp để sử dụng</p>
          </div>
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Username */}
            <label htmlFor="username" className="sr-only">
              Tài khoản
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
                {/* user icon */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                placeholder="Tài khoản"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white/70 pl-10 pr-3 py-3 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
              />
            </div>

            {/* Password */}
            <label htmlFor="password" className="sr-only">
              Mật khẩu
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
                {/* lock icon */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="Mật khẩu"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white/70 pl-10 pr-10 py-3 text-sm text-zinc-900 placeholder-zinc-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
              />
              <button
                type="button"
                aria-label="Hiện/ẩn mật khẩu"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {showPassword ? (
                  // eye-off
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.88" />
                    <path d="M1 1l22 22" />
                    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.86 21.86 0 0 1-3.87 5.62" />
                    <path d="M14.12 9.88a3 3 0 1 1-4.24 4.24" />
                  </svg>
                ) : (
                  // eye
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-sm font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 dark:focus:ring-offset-zinc-900 disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
            >
              {loading ? "Đang xử lý..." : "Đăng nhập"}
            </button>
          </form>
          <div className="pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800 text-center">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">© {year} Sarita. Bảo lưu mọi quyền.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
