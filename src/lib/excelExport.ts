export type ExcelLine = { product: string; code?: string; unit: string; qty: number; memo?: string; kg?: number | null };
export type ExcelDoc = { code: string; date: string; time?: string; warehouse: string; createdBy?: string; sender?: string; description?: string; lines: ExcelLine[] };

export async function exportInboundExcel(docs: ExcelDoc | ExcelDoc[]): Promise<Blob> {
  const payload = Array.isArray(docs) ? { docs } : docs;
  const res = await fetch("/api/inbound/print-excel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `Export failed (${res.status})`);
  }
  return await res.blob();
}
