"use client";

import * as React from "react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Line = { product: string; unit: string; qty: number; memo?: string };
type Doc = { code: string; date: string; partner: string; warehouse: string; status?: string; note?: string; lines: Line[] };

function formatDateLineVN(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = d.getDate();
  const mm = d.getMonth() + 1;
  const yy = d.getFullYear();
  return `Ngày ${dd} tháng ${mm} năm ${yy}`;
}

function OutboundContent() {
  const sp = useSearchParams();
  const code = (sp.get("code") || "").trim();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let _alive = true;
    (async () => {
      try {
        setLoading(true);
        // Ưu tiên lấy dữ liệu từ localStorage (được ghi trước khi mở trang in)
        const ls = localStorage.getItem("qlk_print_outbound");
        if (ls) {
          try {
            const d: Doc = JSON.parse(ls);
            if (d && d.code === code) setDoc(d);
          } catch {}
        }
        // Also check in-memory store fallback; do this regardless of current `doc`
        const store = (window as any).__outbound_docs as Doc[] | undefined;
        if (store) {
          const found = store.find((d) => d.code === code);
          if (found) setDoc(found);
        }
      } catch {}
      finally { setLoading(false); setTimeout(() => { try { window.print(); } catch {} }, 200); }
    })();
    return () => { _alive = false; };
  }, [code]);

  const qtyTotal = useMemo(() => (doc?.lines || []).reduce((s, l) => s + (Number(l.qty) || 0), 0), [doc]);

  return (
    <div className="p-6 print:p-0 text-[13px] leading-relaxed text-zinc-900">
      {!doc && (loading ? <div>Đang tải…</div> : <div>Không tìm thấy phiếu</div>)}
      {doc && (
        <div>
          <div className="text-center font-semibold text-[18px] mb-2">PHIẾU XUẤT KHO</div>
          <div className="flex justify-between mb-1">
            <div>Số: {doc.code}</div>
            <div>{formatDateLineVN(doc.date)}</div>
          </div>
          <div>Xuất tại kho: {doc.warehouse}</div>
          <div>Đơn vị nhận: {doc.partner}</div>
          <div className="mb-2">Ghi chú: {doc.note || ""}</div>

          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                {['STT','Tên hàng','ĐVT','Số lượng','Ghi chú'].map((h, i) => (
                  <th key={i} className="border border-zinc-400 px-2 py-1 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l, idx) => (
                <tr key={idx}>
                  <td className="border border-zinc-400 px-2 py-1 text-center">{idx+1}</td>
                  <td className="border border-zinc-400 px-2 py-1">{l.product}</td>
                  <td className="border border-zinc-400 px-2 py-1 text-center">{l.unit}</td>
                  <td className="border border-zinc-400 px-2 py-1 text-right">{l.qty}</td>
                  <td className="border border-zinc-400 px-2 py-1">{l.memo || ""}</td>
                </tr>
              ))}
              <tr>
                <td className="border border-zinc-400 px-2 py-1"></td>
                <td className="border border-zinc-400 px-2 py-1 text-right" colSpan={2}>Cộng:</td>
                <td className="border border-zinc-400 px-2 py-1 text-right">{qtyTotal}</td>
                <td className="border border-zinc-400 px-2 py-1"></td>
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-3 gap-4 mt-8 text-center">
            <div>
              <div className="font-medium">Người lập phiếu</div>
              <div className="mt-14">&nbsp;</div>
            </div>
            <div>
              <div className="font-medium">Thủ kho</div>
              <div className="mt-14">&nbsp;</div>
            </div>
            <div>
              <div className="font-medium">Giám đốc</div>
              <div className="mt-14">&nbsp;</div>
            </div>
          </div>
        </div>
      )}
      <style>{`@media print { @page { size: A4; margin: 12mm; } body { -webkit-print-color-adjust: exact; } }`}</style>
    </div>
  );
}

export default function PrintOutboundPage() {
  return (
    <Suspense fallback={<div className="p-6">Đang tải…</div>}>
      <OutboundContent />
    </Suspense>
  );
}
