"use client";

import * as React from "react";
import PrintInboundPage from "../../print/inbound/page";
import { usePathname } from "next/navigation";

function XhdHeader() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const handlePrint = () => {
    try { window.print(); } catch {}
  };
  const handleDownloadPdf = () => {
    // Fallback: open print dialog — user can select "Save as PDF". Server-side PDF export not implemented here.
    try { window.print(); } catch {}
  };
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 px-4 py-2">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="text-sm font-medium">Xem phiếu — Preview</div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700">In</button>
          <button onClick={handleDownloadPdf} className="px-3 py-1.5 rounded-md border border-zinc-200 text-sm hover:bg-zinc-50 dark:border-zinc-700">Tải PDF</button>
        </div>
      </div>
    </div>
  );
}

export default function XhdPage() {
  // keep client-only usage and ensure PrintInboundPage rendered below header
  return (
    <div>
      <XhdHeader />
      <main className="pt-14">
        <PrintInboundPage />
      </main>
    </div>
  );
}
