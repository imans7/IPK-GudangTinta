import ExcelJS from "exceljs";
import { unitBerat } from "@/lib/berat";

export type BarisExcel = {
  baris: number; kode: string; nama: string; satuan: string;
  stock_kaleng: number | null; // null = kolom tidak ada di file
  stock_berat: number | null; // unit dasar (gram untuk kg/gram)
  lacak_qr: boolean; error?: string;
};

const norm = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const NON_KALENG = ["lembar", "roll"]; // sama dengan aturan data Excel pabrik

function nilai(v: ExcelJS.CellValue): string | number | boolean | null {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return null;
  const o = v as unknown as Record<string, unknown>;
  if ("result" in o) return nilai(o.result as ExcelJS.CellValue); // sel rumus: pakai hasilnya
  if ("richText" in o) return (o.richText as { text: string }[]).map((t) => t.text).join("");
  if ("text" in o) return String(o.text);
  return null; // sel error (#N/A, dll)
}

function angka(v: string | number | boolean | null): number | null | "BAD" {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : "BAD";
  const n = Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : "BAD";
}

function ya(v: string | number | boolean | null): boolean | null {
  if (v == null || v === "") return null;
  const s = String(v).trim().toLowerCase();
  if (["ya", "y", "yes", "true", "1"].includes(s)) return true;
  if (["tidak", "t", "no", "n", "false", "0"].includes(s)) return false;
  return null;
}

/**
 * Baca sheet katalog. Mendukung file Excel pabrik (judul di atas, header di baris 4: NO | KODE | NAMA BARANG | SATUAN | STOCK AWAL ...)
 * maupun template aplikasi. Header dicari otomatis di 20 baris pertama.
 * Kolom opsional: STOCK AWAL (dalam satuan, mis. kg), STOCK AWAL KALENG, STOCK AWAL BERAT (gram), BERKALENG (YA/TIDAK).
 */
export async function bacaKatalog(buf: ArrayBuffer): Promise<{ ok: true; sheet: string; rows: BarisExcel[]; adaStock: boolean } | { ok: false; error: string }> {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf); } catch { return { ok: false, error: "File tidak bisa dibaca. Gunakan format .xlsx (bukan .xls atau CSV)." }; }
  const ws = wb.worksheets.find((w) => norm(w.name).includes("KATALOG")) ?? wb.worksheets[0];
  if (!ws) return { ok: false, error: "File tidak berisi sheet." };

  let hr = 0;
  const col: { kode?: number; nama?: number; satuan?: number; sUmum?: number; sKaleng?: number; sBerat?: number; qr?: number } = {};
  for (let r = 1; r <= Math.min(20, ws.rowCount) && !hr; r++) {
    const heads: { c: number; h: string }[] = [];
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell, c) => heads.push({ c, h: norm(nilai(cell.value)) }));
    if (!heads.some((x) => x.h === "KODE") || !heads.some((x) => x.h.startsWith("NAMA"))) continue;
    hr = r;
    for (const { c, h } of heads) {
      if (h === "KODE") col.kode = c;
      else if (h.startsWith("NAMA")) col.nama ??= c;
      else if (h === "SATUAN") col.satuan = c;
      else if (h.includes("STOCKAWAL") || h.includes("STOKAWAL")) {
        if (h.includes("KALENG")) col.sKaleng = c; else if (h.includes("BERAT")) col.sBerat = c; else col.sUmum = c;
      } else if (h === "QR" || h.includes("BERKALENG") || h.includes("LACAKQR")) col.qr = c;
    }
  }
  if (!hr || !col.kode || !col.nama) return { ok: false, error: `Header tidak ditemukan di sheet "${ws.name}". Pastikan ada kolom KODE dan NAMA BARANG (unduh template bila perlu).` };
  if (!col.satuan) return { ok: false, error: `Kolom SATUAN tidak ditemukan di sheet "${ws.name}".` };

  const rows: BarisExcel[] = [];
  const dilihat = new Map<string, number>();
  for (let r = hr + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const kode = String(nilai(row.getCell(col.kode).value) ?? "").trim().toUpperCase();
    if (!kode) continue; // baris kosong / catatan kaki
    const nama = String(nilai(row.getCell(col.nama).value) ?? "").trim();
    const satuan = String(nilai(row.getCell(col.satuan).value) ?? "").trim().toLowerCase();
    const errs: string[] = [];
    if (!nama) errs.push("nama kosong");
    if (!satuan) errs.push("satuan kosong");
    if (dilihat.has(kode)) errs.push(`kode dobel dengan baris ${dilihat.get(kode)}`); else dilihat.set(kode, r);

    const faktor = unitBerat(satuan || "x").faktor;
    let sk: number | null = null, sb: number | null = null;
    if (col.sKaleng) { const a = angka(nilai(row.getCell(col.sKaleng).value)); if (a === "BAD" || (a != null && a < 0)) errs.push("stock awal kaleng tidak valid"); else sk = a; }
    if (col.sBerat) { const a = angka(nilai(row.getCell(col.sBerat).value)); if (a === "BAD" || (a != null && a < 0)) errs.push("stock awal berat tidak valid"); else sb = a; }
    else if (col.sUmum) { const a = angka(nilai(row.getCell(col.sUmum).value)); if (a === "BAD" || (a != null && a < 0)) errs.push("stock awal tidak valid"); else sb = a == null ? null : Math.round(a * faktor * 1000) / 1000; }

    const qr = col.qr ? ya(nilai(row.getCell(col.qr).value)) : null;
    rows.push({ baris: r, kode, nama, satuan, stock_kaleng: sk, stock_berat: sb, lacak_qr: qr ?? !NON_KALENG.includes(satuan), ...(errs.length ? { error: errs.join(", ") } : {}) });
  }
  if (rows.length === 0) return { ok: false, error: "Tidak ada baris data di bawah header." };
  return { ok: true, sheet: ws.name, rows, adaStock: !!(col.sUmum || col.sKaleng || col.sBerat) };
}
