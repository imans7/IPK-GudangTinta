import type { Prisma } from "@prisma/client";

export type KomposisiInput = {
  kode_komponen: string | null; // kode di katalog, atau null bila ditulis bebas
  nama_komponen: string;
  is_base: boolean;
  jumlah: number | null; // null hanya untuk base = "sisanya"
  satuan: "GRAM" | "PERSEN";
};

/**
 * Bersihkan & validasi komposisi. Baris tanpa nama dibuang, jadi komposisi kosong = ok dengan rows [].
 * Komposisi bersifat OPSIONAL: pemanggil cukup melewati penyimpanan bila rows kosong.
 */
export function bersihkanKomposisi(raw: unknown): { ok: true; rows: KomposisiInput[] } | { ok: false; error: string } {
  if (raw == null || raw === "") return { ok: true, rows: [] };
  let arr: unknown = raw;
  if (typeof raw === "string") { try { arr = JSON.parse(raw); } catch { return { ok: false, error: "Data komposisi tidak terbaca." }; } }
  if (!Array.isArray(arr)) return { ok: false, error: "Data komposisi tidak valid." };

  const rows: KomposisiInput[] = [];
  for (const x of arr as Partial<KomposisiInput>[]) {
    const nama = String(x?.nama_komponen ?? "").trim();
    if (!nama) continue;
    rows.push({
      kode_komponen: x.kode_komponen ? String(x.kode_komponen) : null, nama_komponen: nama, is_base: !!x.is_base,
      jumlah: x.jumlah == null || (x.jumlah as unknown) === "" ? null : Number(x.jumlah), satuan: x.satuan === "PERSEN" ? "PERSEN" : "GRAM",
    });
  }
  if (rows.length === 0) return { ok: true, rows };
  if (rows.filter((r) => r.is_base).length > 1) return { ok: false, error: "Komposisi: base hanya boleh satu." };
  for (const r of rows) {
    if (r.is_base && r.jumlah == null) continue; // base = sisanya
    if (r.jumlah == null || !Number.isFinite(r.jumlah) || r.jumlah <= 0) return { ok: false, error: `Komposisi: jumlah "${r.nama_komponen}" harus lebih dari 0 (atau kosongkan seluruh komposisi).` };
  }
  const persen = rows.filter((r) => r.satuan === "PERSEN" && r.jumlah != null).reduce((a, r) => a + (r.jumlah ?? 0), 0);
  if (persen > 100.0001) return { ok: false, error: `Komposisi: total persen ${persen}% melebihi 100%.` };
  const adaBaseSisa = rows.some((r) => r.is_base && r.jumlah == null);
  if (rows.every((r) => r.satuan === "PERSEN") && !adaBaseSisa && Math.abs(persen - 100) > 0.01) return { ok: false, error: `Komposisi: total persen harus 100% (sekarang ${persen}%).` };
  return { ok: true, rows };
}

/** Ganti seluruh komposisi satu tinta. Tidak melakukan apa pun bila rows kosong dan tidak ada yang perlu dihapus. */
export async function simpanKomposisi(tx: Prisma.TransactionClient, kode: string, rows: KomposisiInput[]) {
  await tx.komposisiWarna.deleteMany({ where: { kode_barang: kode } });
  if (rows.length === 0) return;
  await tx.komposisiWarna.createMany({
    data: rows.map((r, i) => ({ kode_barang: kode, kode_komponen: r.kode_komponen, nama_komponen: r.nama_komponen, is_base: r.is_base, jumlah: r.jumlah, satuan: r.satuan, urutan: i })),
  });
}
