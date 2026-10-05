import { prisma } from "@/lib/prisma";

const uniq = (a: string[], n = 150) => Array.from(new Set(a.map((s) => s.trim()).filter(Boolean))).slice(0, n);

/** Isian yang pernah dipakai, jadi saran saat mengetik manual (boleh tetap tulis teks baru). */
export async function getSaran() {
  const [spk, ketK, ketM, sat, batch, users, opK, opP] = await Promise.all([
    prisma.transaksiKeluar.findMany({ orderBy: { id: "desc" }, select: { no_spk_mesin: true }, take: 800 }),
    prisma.transaksiKeluar.findMany({ orderBy: { id: "desc" }, select: { keterangan: true }, take: 800 }),
    prisma.transaksiMasuk.findMany({ orderBy: { id: "desc" }, select: { keterangan: true }, take: 300 }),
    prisma.masterKatalog.findMany({ select: { satuan: true } }),
    prisma.detailKaleng.findMany({ orderBy: { tanggal_masuk: "desc" }, select: { batch_number: true }, take: 300 }),
    prisma.user.findMany({ select: { nama_lengkap: true } }),
    prisma.transaksiKeluar.findMany({ where: { nama_operator: { not: null } }, orderBy: { id: "desc" }, select: { nama_operator: true }, take: 300 }),
    prisma.transaksiPengembalian.findMany({ where: { nama_operator: { not: null } }, orderBy: { id: "desc" }, select: { nama_operator: true }, take: 300 }),
  ]);
  return {
    spk: uniq(spk.map((x) => x.no_spk_mesin)),
    ketKeluar: uniq(ketK.map((x) => x.keterangan)),
    ketMasuk: uniq(ketM.map((x) => x.keterangan), 50),
    satuan: uniq(sat.map((x) => x.satuan), 50),
    batch: uniq(batch.map((x) => x.batch_number)),
    operator: uniq([...users.map((u) => u.nama_lengkap), ...opK.map((x) => x.nama_operator ?? ""), ...opP.map((x) => x.nama_operator ?? "")], 100),
  };
}
