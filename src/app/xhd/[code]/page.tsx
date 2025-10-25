"use client";

import * as React from "react";
import PrintInboundPage from "../../print/inbound/page";
import { usePathname } from "next/navigation";

function XhdHeader() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  // Avoid returning null synchronously (causes hydration mismatch). Instead render header
  // and hide it after mount if snapshot=1 or preview=1 are present in the URL.
  const [hidden, setHidden] = React.useState(false);
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search || '');
      if (params.get('snapshot') === '1' || params.get('preview') === '1') setHidden(true);
    } catch {}
  }, []);
  const handlePrint = () => {
    try { window.print(); } catch {}
  };
  return (
    <div className={["fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 print:hidden", hidden ? "hidden" : ""].join(' ')}>
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="text-sm font-medium">Preview — nhấn In để mở hộp thoại in hoặc chọn máy in để “Lưu dưới dạng PDF”</div>
        <div className="flex items-center">
          <button
            onClick={handlePrint}
            aria-label="In hoá đơn"
            className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            In
          </button>
        </div>
      </div>
    </div>
  );
}

export default function XhdPage() {
  // keep client-only usage and ensure PrintInboundPage rendered below header
  // Use client-side effect to remove top padding when snapshot/preview is present to avoid
  // hydration mismatch (server and client must render the same DOM initially).
  const [isSnapshot, setIsSnapshot] = React.useState(false);
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search || '');
      if (params.get('snapshot') === '1' || params.get('preview') === '1') setIsSnapshot(true);
    } catch {}
  }, []);

  return (
    <div>
      <XhdHeader />
      <main className={isSnapshot ? "print:pt-0" : "pt-14 print:pt-0"}>
        <PrintInboundPage />
      </main>
    </div>
  );
}
