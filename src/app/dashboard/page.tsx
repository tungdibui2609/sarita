export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Tổng SKU", value: "1,284", delta: "+2.3%" },
          { label: "Tồn kho", value: "82,410", delta: "+0.8%" },
          { label: "Sắp hết hàng", value: "37", delta: "-" },
          { label: "Khoảng trống kệ", value: "12%", delta: "+1.2%" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-900/70 backdrop-blur p-4 ring-1 ring-black/5">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">{c.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{c.value}</div>
              <div className="text-xs text-emerald-600">{c.delta}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-900/70 backdrop-blur p-4 ring-1 ring-black/5 h-[280px] flex items-center justify-center text-zinc-500 text-sm">
          Biểu đồ luân chuyển kho (placeholder)
        </div>
        <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-900/70 backdrop-blur p-4 ring-1 ring-black/5 h-[280px] flex items-center justify-center text-zinc-500 text-sm">
          Tỷ lệ lấp đầy kệ (placeholder)
        </div>
      </div>

      {/* Tables placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-900/70 backdrop-blur p-4 ring-1 ring-black/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Nhập kho gần đây</h3>
            <button className="text-sm text-emerald-600">Xem tất cả</button>
          </div>
          <div className="text-sm text-zinc-500">Bảng dữ liệu (placeholder)</div>
        </div>
        <div className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/80 dark:bg-zinc-900/70 backdrop-blur p-4 ring-1 ring-black/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Xuất kho gần đây</h3>
            <button className="text-sm text-emerald-600">Xem tất cả</button>
          </div>
          <div className="text-sm text-zinc-500">Bảng dữ liệu (placeholder)</div>
        </div>
      </div>
    </div>
  );
}
