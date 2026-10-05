import { prisma } from "@/lib/prisma";

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Aturan FIFO: kaleng TERBUKA dipakai lebih dulu (expired terdekat),
 * jika tidak ada baru kaleng BARU dengan expired terdekat. Kaleng kedaluwarsa dilewati.
 */
export async function rekomendasiFifo(kode: string) {
  const base = { kode_barang: kode, berat_aktual: { gt: 0 }, tanggal_kedaluwarsa: { gte: startOfToday() } };
  const order = [{ tanggal_kedaluwarsa: "asc" as const }, { tanggal_masuk: "asc" as const }];
  const terbuka = await prisma.detailKaleng.findFirst({ where: { ...base, status: "TERBUKA" }, orderBy: order });
  if (terbuka) return terbuka;
  return prisma.detailKaleng.findFirst({ where: { ...base, status: "BARU" }, orderBy: order });
}
