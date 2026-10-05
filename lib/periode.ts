import { prisma } from "@/lib/prisma";

export const GUDANG = process.env.NEXT_PUBLIC_GUDANG ?? "88A&84";
const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export const isPeriode = (s?: string | null): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

/** Batas bulan (UTC, sama dengan cara tanggal disimpan dari input type=date). */
export function rentang(p: string) {
  const [y, m] = p.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}
export function labelPeriode(p: string) {
  const [y, m] = p.split("-").map(Number);
  return `${NAMA_BULAN[m - 1]} ${y}`;
}
export const periodeIni = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }).slice(0, 7);

/** Pakai ?bulan= bila valid; kalau tidak, bulan terakhir yang punya data; kalau kosong, bulan ini. */
export async function resolvePeriode(q?: string | null): Promise<string> {
  if (isPeriode(q)) return q;
  const [sp, m, k] = await Promise.all([
    prisma.stokPeriode.findFirst({ orderBy: { periode: "desc" }, select: { periode: true } }),
    prisma.transaksiMasuk.findFirst({ orderBy: { tanggal_masuk: "desc" }, select: { tanggal_masuk: true } }),
    prisma.transaksiKeluar.findFirst({ orderBy: { tanggal_keluar: "desc" }, select: { tanggal_keluar: true } }),
  ]);
  const c = [sp?.periode, m?.tanggal_masuk.toISOString().slice(0, 7), k?.tanggal_keluar.toISOString().slice(0, 7)].filter(Boolean) as string[];
  return c.length ? c.sort().at(-1)! : periodeIni();
}
