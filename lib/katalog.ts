import { prisma } from "@/lib/prisma";
import { rentang } from "@/lib/periode";

export type KatalogRow = {
  no: number; kode: string; nama_barang: string; satuan: string; lacak_qr: boolean; gambar_url: string | null;
  stock_awal_kaleng: number; stock_awal_berat: number; masuk: number; keluar: number; saldo_kaleng: number; total_berat: number;
};
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Hitungan kaleng per bulan:
 *   SALDO AKHIR = STOCK AWAL + MASUK - KELUAR + KEMBALI (kaleng yang dikembalikan masih berisi tinta)
 * STOCK AWAL = angka manual bulan itu (StokPeriode) atau otomatis saldo akhir bulan sebelumnya.
 * TOTAL BERAT = total_berat_tinta (real-time, bukan per bulan).
 */
export async function getKatalogRows(periode: string, q = ""): Promise<KatalogRow[]> {
  const { start, end } = rentang(periode);
  const where = q ? { OR: [{ kode: { contains: q } }, { nama_barang: { contains: q } }] } : {};
  const [items, sps, masuk, keluar, kembali] = await Promise.all([
    prisma.masterKatalog.findMany({ where, orderBy: { kode: "asc" } }),
    prisma.stokPeriode.findMany({ where: { periode: { lte: periode } } }),
    prisma.transaksiMasuk.findMany({ where: { tanggal_masuk: { lt: end } }, select: { kode_barang: true, tanggal_masuk: true, jumlah_kaleng_masuk: true } }),
    prisma.transaksiKeluar.findMany({ where: { tanggal_keluar: { lt: end } }, select: { kode_barang: true, tanggal_keluar: true, jumlah_kaleng_keluar: true } }),
    prisma.transaksiPengembalian.findMany({ where: { tanggal_kembali: { lt: end }, berat_sisa_dikembalikan: { gt: 0 } }, select: { kode_barang: true, tanggal_kembali: true } }),
  ]);
  const spBy = new Map<string, typeof sps>();
  for (const s of sps) (spBy.get(s.kode_barang) ?? spBy.set(s.kode_barang, []).get(s.kode_barang)!).push(s);

  return items.map((it, i) => {
    const list = (spBy.get(it.kode) ?? []).sort((a, b) => a.periode.localeCompare(b.periode));
    const manual = list.find((s) => s.periode === periode);
    const prev = list.filter((s) => s.periode < periode).at(-1);
    const baseDate = prev ? rentang(prev.periode).start : new Date(0);
    const base = prev ? prev.stock_awal_kaleng : it.stock_awal_kaleng;

    let mIn = 0, kOut = 0, bIn = 0, mPre = 0, kPre = 0, bPre = 0;
    for (const m of masuk) if (m.kode_barang === it.kode) { if (m.tanggal_masuk >= start) mIn += m.jumlah_kaleng_masuk; else if (m.tanggal_masuk >= baseDate) mPre += m.jumlah_kaleng_masuk; }
    for (const k of keluar) if (k.kode_barang === it.kode) { if (k.tanggal_keluar >= start) kOut += k.jumlah_kaleng_keluar; else if (k.tanggal_keluar >= baseDate) kPre += k.jumlah_kaleng_keluar; }
    for (const b of kembali) if (b.kode_barang === it.kode) { if (b.tanggal_kembali >= start) bIn += 1; else if (b.tanggal_kembali >= baseDate) bPre += 1; }

    const awal = manual ? manual.stock_awal_kaleng : r3(base + mPre - kPre + bPre);
    return {
      no: i + 1, kode: it.kode, nama_barang: it.nama_barang, satuan: it.satuan, lacak_qr: it.lacak_qr, gambar_url: it.gambar_url,
      stock_awal_kaleng: awal, stock_awal_berat: manual?.stock_awal_berat ?? it.stock_awal_berat,
      masuk: mIn, keluar: kOut, saldo_kaleng: r3(awal + mIn - kOut + bIn), total_berat: r3(it.total_berat_tinta),
    };
  });
}

const cari = (q: string, ...f: string[]) => (q ? { OR: [...f.map((x) => ({ [x]: { contains: q } })), { katalog: { nama_barang: { contains: q } } }] } : {});

export function getRiwayatMasuk(periode: string, q = "") {
  const { start, end } = rentang(periode);
  return prisma.transaksiMasuk.findMany({
    where: { tanggal_masuk: { gte: start, lt: end }, ...cari(q, "kode_barang", "keterangan") },
    orderBy: [{ tanggal_masuk: "asc" }, { id: "asc" }], include: { katalog: true, kaleng: { select: { status: true } } },
  });
}
export function getRiwayatKeluar(periode: string, q = "") {
  const { start, end } = rentang(periode);
  return prisma.transaksiKeluar.findMany({
    where: { tanggal_keluar: { gte: start, lt: end }, ...cari(q, "kode_barang", "keterangan", "no_spk_mesin") },
    orderBy: [{ tanggal_keluar: "asc" }, { id: "asc" }], include: { katalog: true, pengembalian: { select: { id: true } } },
  });
}
export function getRiwayatPengembalian(periode: string, q = "") {
  const { start, end } = rentang(periode);
  const w = q ? { OR: [{ kode_barang: { contains: q } }, { katalog: { nama_barang: { contains: q } } }, { keluar: { keterangan: { contains: q } } }, { keluar: { no_spk_mesin: { contains: q } } }] } : {};
  return prisma.transaksiPengembalian.findMany({
    where: { tanggal_kembali: { gte: start, lt: end }, ...w },
    orderBy: [{ tanggal_kembali: "asc" }, { id: "asc" }], include: { katalog: true, keluar: true },
  });
}
