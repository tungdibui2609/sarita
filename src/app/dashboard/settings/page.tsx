"use client";

import * as React from "react";
export default function SettingsPage() {
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-semibold mb-4">Cài đặt</h1>
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200/70 dark:border-zinc-800/70">
        <SettingsTabs />
      </div>
    </div>
  );
}

function TabsHeader({ value, onChange }: { value: string; onChange: (_v: string) => void }) {
  const tabs = [
    { key: "general", label: "Chung" },
    { key: "inbound", label: "Phiếu nhập" },
  ];
  return (
    <div className="flex gap-1 p-2 border-b border-zinc-200/70 dark:border-zinc-800/70">
      {tabs.map(t => (
        <button
          key={t.key}
          className={`px-3 py-2 rounded-md text-sm ${value === t.key ? "bg-emerald-600 text-white" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function SettingsTabs() {
  const [tab, setTab] = React.useState("general");
  return (
    <div>
      <TabsHeader value={tab} onChange={setTab} />
      <div className="p-4">
        {tab === "general" && <div>Thiết lập chung sẽ có ở đây.</div>}
        {tab === "inbound" && (
          <InboundSettings />
        )}
      </div>
    </div>
  );
}

function InboundSettings() {
  const [loading, setLoading] = React.useState(true);
  const [receivers, setReceivers] = React.useState<Array<{ name: string; [k: string]: string }>>([]);
  const [showCreate, setShowCreate] = React.useState(false);
  const [createPayload, setCreatePayload] = React.useState<Record<string,string>>({ name: "", TEXT1: "", TEXT2: "", TEXT3: "", TEXT4: "", TEXT5: "", TEXT6: "", TEXT7: "" });
  const [editing, setEditing] = React.useState<null | { index: number; data: { name: string; [k: string]: string } }>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const resReceivers = await fetch("/api/settings/inbound/receivers", { cache: "no-store" });
        const rjs = await resReceivers.json().catch(() => ({ ok: false }));
        if (!alive) return;
        if (rjs?.ok && Array.isArray(rjs?.receivers)) {
          setReceivers(rjs.receivers as any);
        } else {
          setReceivers([]);
        }
      } catch {}
      finally { setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-4">
      {loading && (
        <div className="px-3 py-2 text-sm text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/20 rounded-md">Đang tải cài đặt…</div>
      )}
      {/* Receivers list (names only) + CRUD */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold">Người giao (Phiếu nhập)</h3>
          </div>
          <button onClick={() => {
            // Prefill create form from the last edited receiver or the first in list
            const base = (editing?.data as any) || (receivers.length ? receivers[0] : null);
            setCreatePayload({
              name: "",
              TEXT1: base?.TEXT1 || "",
              TEXT2: base?.TEXT2 || "",
              TEXT3: base?.TEXT3 || "",
              TEXT4: base?.TEXT4 || "",
              TEXT5: base?.TEXT5 || "",
              TEXT6: base?.TEXT6 || "",
              TEXT7: base?.TEXT7 || "",
            });
            setShowCreate(true);
          }} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700">Thêm mới</button>
        </div>

        {receivers.length === 0 ? (
          <div className="px-3 py-6 text-center text-zinc-500 border border-dashed rounded-lg">Không có dữ liệu Người nhận</div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200/70 dark:border-zinc-800/70 overflow-hidden bg-white dark:bg-zinc-900">
            {receivers.map((r, idx) => (
              <li key={idx} className="flex items-center justify-between px-3 py-2">
                <div className="font-medium text-sm">{r.name}</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditing({ index: idx, data: r })} className="px-2 py-1 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">Sửa</button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Xóa người nhận "${r.name}"?`)) return;
                      try {
                        const res = await fetch("/api/settings/inbound/receivers/delete", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ name: r.name }) });
                        const js = await res.json();
                        if (!js?.ok) throw new Error(js?.error || "DELETE_FAILED");
                        setReceivers(prev => prev.filter((_, i) => i !== idx));
                      } catch (e: any) {
                        alert(e?.message || "Không xóa được");
                      }
                    }}
                    className="px-2 py-1 text-sm rounded-md border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                  >Xóa</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal onClose={() => setShowCreate(false)} title="Thêm Người nhận">
          <div className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Tên người nhận</label>
              <input value={createPayload.name} onChange={(e)=>setCreatePayload(p=>({...p, name:e.target.value}))} className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base" />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {( ["TEXT1","TEXT2","TEXT3","TEXT4","TEXT5","TEXT6","TEXT7"] as const).map((k) => (
                <div key={k}>
                  <label className="block text-xs mb-1">{k}</label>
                  <input value={createPayload[k]} onChange={(e)=>setCreatePayload(p=>({...p, [k]: e.target.value}))} className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base" />
                </div>
              ))}
            </div>
            <div className="pt-2 text-right flex items-center justify-end gap-2">
              <button onClick={()=>setShowCreate(false)} className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700">Hủy</button>
              <button
                onClick={async ()=>{
                  try {
                    const res = await fetch("/api/settings/inbound/receivers/create", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(createPayload) });
                    const js = await res.json();
                    if (!res.ok || !js?.ok) throw new Error(js?.error || "CREATE_FAILED");
                    setReceivers(prev => [js.receiver, ...prev]);
                    setShowCreate(false);
                    setCreatePayload({ name: "", TEXT1: "", TEXT2: "", TEXT3: "", TEXT4: "", TEXT5: "", TEXT6: "", TEXT7: "" });
                  } catch (e: any) {
                    alert(e?.message || "Không tạo được");
                  }
                }}
                disabled={!createPayload.name.trim()}
                className="px-3 py-1.5 rounded-md bg-emerald-600 text-white"
              >Lưu</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {editing && (
        <Modal onClose={() => setEditing(null)} title={`Sửa: ${editing.data.name}`}>
          <EditReceiverForm
            data={editing.data}
            onCancel={() => setEditing(null)}
            onSaved={(updated) => {
              setReceivers(prev => prev.map((x, i) => i === editing.index ? { ...x, ...updated } : x));
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  React.useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[96vw] max-w-2xl max-h-[90vh] rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800/70 p-5 shadow-xl flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-semibold">{title}</div>
          <button onClick={onClose} className="px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800">×</button>
        </div>
        <div className="overflow-y-auto pr-2 max-h-[72vh]">
          {children}
        </div>
      </div>
    </div>
  );
}

function EditReceiverForm({ data, onSaved, onCancel }: { data: { name: string; [k: string]: string }; onSaved: (_u: Record<string,string>) => void; onCancel: () => void }) {
  const [local, setLocal] = React.useState<Record<string,string>>(() => ({
    name: data.name,
    TEXT1: (data as any).TEXT1 || "",
    TEXT2: (data as any).TEXT2 || "",
    TEXT3: (data as any).TEXT3 || "",
    TEXT4: (data as any).TEXT4 || "",
    TEXT5: (data as any).TEXT5 || "",
    TEXT6: (data as any).TEXT6 || "",
    TEXT7: (data as any).TEXT7 || "",
  }));
  const [saving, setSaving] = React.useState(false);

  async function save() {
    try {
      setSaving(true);
      const res = await fetch("/api/settings/inbound/receivers/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: local.name, updates: {
          TEXT1: local.TEXT1, TEXT2: local.TEXT2, TEXT3: local.TEXT3, TEXT4: local.TEXT4, TEXT5: local.TEXT5, TEXT6: local.TEXT6, TEXT7: local.TEXT7,
        } })
      });
      const js = await res.json();
      if (!js?.ok) throw new Error(js?.error || "UPDATE_FAILED");
      onSaved(js.receiver);
    } catch (e: any) {
      alert(e?.message || "Không lưu được");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-2">
        {( ["TEXT1","TEXT2","TEXT3","TEXT4","TEXT5","TEXT6","TEXT7"] as const).map((k) => (
          <div key={k}>
            <label className="block text-xs mb-1">{k}</label>
            <input value={local[k]} onChange={(e)=>setLocal(p=>({ ...p, [k]: e.target.value }))} className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-base" />
          </div>
        ))}
      </div>
      <div className="pt-2 text-right flex items-center justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700">Hủy</button>
        <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-md bg-emerald-600 text-white">{saving?"Đang lưu…":"Lưu"}</button>
      </div>
    </div>
  );
}
 
