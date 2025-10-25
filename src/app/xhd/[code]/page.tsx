"use client";

import * as React from "react";
import PrintInboundPage from "../../print/inbound/page";
import { usePathname } from "next/navigation";

function XhdHeader() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  // Hide this interactive header when rendering for a snapshot (server screenshot)
  // The screenshot service requests /xhd/:slug?snapshot=1 — in that case we don't render the header
  // so it won't appear in the exported image.
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search || '');
      if (params.get('snapshot') === '1') return null;
    }
  } catch {}
  const handlePrint = () => {
    try { window.print(); } catch {}
  };
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 px-4 py-2 print:hidden">
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
  // Remove the top padding when rendering a snapshot so screenshots don't have extra blank space
  const isSnapshot = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('snapshot') === '1' : false;
  return (
    <div>
      <XhdHeader />
      <main className={isSnapshot ? "print:pt-0" : "pt-14 print:pt-0"}>
        <PrintInboundPage />
      </main>
    </div>
  );
}
