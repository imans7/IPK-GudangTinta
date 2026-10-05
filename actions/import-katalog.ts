"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { isPeriode } from "@/lib/periode";
import { bacaKatalog } from "@/lib/import-katalog";

export type BarisHasil = {
  baris: number; kode: string; nama: string; satuan: string;
  stock_kaleng: number | null; stock_berat: number | null; lacak_qr: boolean;
  aksi: "BARU" | "PERBARUI" | "LEWATI" | "ERROR"; pesan?: string;
};
export type HasilImpor =
  | { ok: true; mode: "pratinjau" | "impor"; sheet: string; rows: BarisHasil[]; ringkas: { baru: number; perbarui: number; lewati: number; error: number } }
  | { ok: false; error: string };

/**
 * Import Master Katalog dari Excel (ADMIN).
 * mode "pratinjau": hanya membaca & menilai tiap baris. mode "impor": menyimpan dalam satu transaksi.
 * Kode baru -> dibuat (stock awal ikut menjadi total_berat_tinta). Kode sudah ada -> dilewati,
 * kecuali opsi "perbarui" dicentang (nama, satuan, QR, dan stock awal bulan terpilih diperbarui).
 */
export async function imporKatalog(fd: FormData): Promise<HasilImpor> {
  const u = await getUser();
  if (!u || u.role !== "ADMIN") return { ok: false, error: "Hanya ADMIN yang dapat import katalog." };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Pilih file Excel (.xlsx) dulu." };
  if (file.size > 4 * 1024 * 1024) return { ok: false, error: "File terlalu besar (maksimal 4 MB)." };
  if (!/\.xlsx$/i.test(file.name)) return { ok: false, error: "Format harus .xlsx." };
  const mode = fd.get("mode") === "impor" ? "impor" : "pratinjau";
  const perbarui = fd.get("perbarui") === "on";
  const periode = String(fd.get("periode") ?? "");

  const hasil = await bacaKatalog(await file.arrayBuffer());
  if (!hasil.ok) return hasil;

  const ada = new Map((await prisma.masterKatalog.findMany({ where: { kode: { in: hasil.rows.map((r) => r.kode) } } })).map((m) => [m.kode, m]));
  const rows: BarisHasil[] = [];
  for (const r of hasil.rows) {
    const base = { baris: r.baris, kode: r.kode, nama: r.nama, satuan: r.satuan, stock_kaleng: r.stock_kaleng, stock_berat: r.stock_berat, lacak_qr: r.lacak_qr };
    if (r.error) { rows.push({ ...base, aksi: "ERROR", pesan: r.error }); continue; }
    const m = ada.get(r.kode);
    if (!m) { rows.push({ ...base, aksi: "BARU" }); continue; }
    if (!perbarui) { rows.push({ ...base, aksi: "LEWATI", pesan: "sudah ada di katalog" }); continue; }
    let pesan: string | undefined;
    if (m.satuan !== r.satuan) {
      const [a, b, c] = await Promise.all([prisma.transaksiMasuk.count({ where: { kode_barang: r.kode } }), prisma.transaksiKeluar.count({ where: { kode_barang: r.kode } }), prisma.detailKaleng.count({ where: { kode_barang: r.kode } })]);
      if (a + b + c > 0) pesan = `satuan tetap "${m.satuan}" (sudah ada transaksi)`;
    }
    rows.push({ ...base, aksi: "PERBARUI", pesan });
  }
  const ringkas = {
    baru: rows.filter((r) => r.aksi === "BARU").length, perbarui: rows.filter((r) => r.aksi === "PERBARUI").length,
    lewati: rows.filter((r) => r.aksi === "LEWATI").length, error: rows.filter((r) => r.aksi === "ERROR").length,
  };
  if (mode === "pratinjau") return { ok: true, mode, sheet: hasil.sheet, rows, ringkas };

  if (ringkas.error > 0) return { ok: false, error: `Masih ada ${ringkas.error} baris bermasalah. Perbaiki di Excel lalu pratinjau ulang.` };
  if (ringkas.baru + ringkas.perbarui === 0) return { ok: false, error: "Tidak ada barang yang perlu diimpor." };

  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      if (r.aksi === "BARU") {
        const sk = r.stock_kaleng ?? 0, sb = r.stock_berat ?? 0;
        await tx.masterKatalog.create({ data: { kode: r.kode, nama_barang: r.nama, satuan: r.satuan, stock_awal_kaleng: sk, stock_awal_berat: sb, total_berat_tinta: sb, lacak_qr: r.lacak_qr } });
        if (isPeriode(periode)) await tx.stokPeriode.create({ data: { periode, kode_barang: r.kode, stock_awal_kaleng: sk, stock_awal_berat: sb } });
      } else if (r.aksi === "PERBARUI") {
        const tetapSatuan = r.pesan?.startsWith("satuan tetap");
        await tx.masterKatalog.update({ where: { kode: r.kode }, data: { nama_barang: r.nama, lacak_qr: r.lacak_qr, ...(tetapSatuan ? {} : { satuan: r.satuan }) } });
        if (isPeriode(periode) && (r.stock_kaleng != null || r.stock_berat != null)) {
          await tx.stokPeriode.upsert({
            where: { periode_kode_barang: { periode, kode_barang: r.kode } },
            update: { ...(r.stock_kaleng != null ? { stock_awal_kaleng: r.stock_kaleng } : {}), ...(r.stock_berat != null ? { stock_awal_berat: r.stock_berat } : {}) },
            create: { periode, kode_barang: r.kode, stock_awal_kaleng: r.stock_kaleng ?? 0, stock_awal_berat: r.stock_berat ?? 0 },
          });
        }
      }
    }
  }, { timeout: 60_000, maxWait: 10_000 });
  revalidatePath("/");
  return { ok: true, mode, sheet: hasil.sheet, rows, ringkas };
}
