import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { syncTotalBerat } from "../lib/sync-berat";
import { unitBerat } from "../lib/berat";

const prisma = new PrismaClient();

type Data = {
  periode: string; gudang: string;
  katalog: { kode: string; nama: string; satuan: string; stock_awal: number; lacak_qr: boolean }[];
  masuk: { tanggal: string; kode: string; keterangan: string; jumlah: number }[];
  keluar: { tanggal: string; kode: string; no_spk_mesin: string; keterangan: string; jumlah: number }[];
};

async function main() {
  const admin = await prisma.user.upsert({
    where: { username: "admin" }, update: {},
    create: { username: "admin", password: await bcrypt.hash("admin123", 10), nama_lengkap: "Administrator", role: "ADMIN" },
  });
  await prisma.user.upsert({
    where: { username: "operator" }, update: {},
    create: { username: "operator", password: await bcrypt.hash("operator123", 10), nama_lengkap: "Operator Cetak", role: "OPERATOR" },
  });

  // Data asli dari STOCK_TINTA_88A&84_AGUSTUS_2026.xlsx (hasil konversi, tanggal sudah diperbaiki)
  const d: Data = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "agustus-2026.json"), "utf8"));
  const faktor = new Map(d.katalog.map((c) => [c.kode, unitBerat(c.satuan).faktor]));
  for (const c of d.katalog) {
    // Data Excel hanya berisi kg/jumlah, bukan hitungan kaleng -> stock awal kaleng 0, berat dalam unit dasar (gram).
    const berat = c.stock_awal * (faktor.get(c.kode) ?? 1);
    await prisma.masterKatalog.upsert({
      where: { kode: c.kode }, update: {},
      create: { kode: c.kode, nama_barang: c.nama, satuan: c.satuan, stock_awal_kaleng: 0, stock_awal_berat: berat, lacak_qr: c.lacak_qr },
    });
    await prisma.stokPeriode.upsert({
      where: { periode_kode_barang: { periode: d.periode, kode_barang: c.kode } }, update: {},
      create: { periode: d.periode, kode_barang: c.kode, stock_awal_kaleng: 0, stock_awal_berat: berat },
    });
  }
  if ((await prisma.transaksiMasuk.count()) === 0) {
    await prisma.transaksiMasuk.createMany({
      data: d.masuk.map((m) => ({ tanggal_masuk: new Date(m.tanggal), kode_barang: m.kode, keterangan: m.keterangan, jumlah_kaleng_masuk: 0, total_berat_masuk: m.jumlah * (faktor.get(m.kode) ?? 1), admin_id: admin.id })),
    });
    await prisma.transaksiKeluar.createMany({
      data: d.keluar.map((k) => ({ tanggal_keluar: new Date(k.tanggal), kode_barang: k.kode, no_spk_mesin: k.no_spk_mesin, keterangan: k.keterangan, jumlah_kaleng_keluar: 0, berat_keluar: k.jumlah * (faktor.get(k.kode) ?? 1), operator_id: admin.id })),
    });
  }
  const sync = await syncTotalBerat();
  console.log(`total_berat_tinta terisi untuk ${sync.n} barang.`);
  console.log(`Seed selesai: ${d.katalog.length} barang, ${d.masuk.length} masuk, ${d.keluar.length} keluar (${d.periode}).`);
  console.log("Login: admin / admin123 | operator / operator123 (segera ganti password!)");
}
main().finally(() => prisma.$disconnect());
