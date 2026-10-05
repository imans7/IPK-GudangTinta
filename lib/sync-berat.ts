import { prisma } from "./prisma";
import { resolvePeriode, rentang } from "./periode";

/**
 * Hitung ulang total_berat_tinta dari awal:
 *   stok awal berat (bulan terakhir) + total berat masuk - berat terpakai
 * berat terpakai = hasil pengembalian, atau berat_keluar untuk barang non-kaleng / data impor.
 */
export async function syncTotalBerat() {
  const periode = await resolvePeriode();
  const items = await prisma.masterKatalog.findMany();
  const sps = await prisma.stokPeriode.findMany({ where: { periode: { lte: periode } } });
  let n = 0;
  for (const it of items) {
    const sp = sps.filter((s) => s.kode_barang === it.kode).sort((a, b) => a.periode.localeCompare(b.periode)).at(-1);
    const from = sp ? rentang(sp.periode).start : new Date(0);
    const base = sp ? sp.stock_awal_berat : it.stock_awal_berat;
    const [m, k, p] = await Promise.all([
      prisma.transaksiMasuk.aggregate({ where: { kode_barang: it.kode, tanggal_masuk: { gte: from } }, _sum: { total_berat_masuk: true } }),
      prisma.transaksiKeluar.aggregate({ where: { kode_barang: it.kode, id_kaleng: null, tanggal_keluar: { gte: from } }, _sum: { berat_keluar: true } }),
      prisma.transaksiPengembalian.aggregate({ where: { kode_barang: it.kode, tanggal_kembali: { gte: from } }, _sum: { berat_terpakai_aktual: true } }),
    ]);
    const total = Math.round((base + (m._sum.total_berat_masuk ?? 0) - (k._sum.berat_keluar ?? 0) - (p._sum.berat_terpakai_aktual ?? 0)) * 1000) / 1000;
    await prisma.masterKatalog.update({ where: { kode: it.kode }, data: { total_berat_tinta: total } });
    n++;
  }
  return { periode, n };
}
