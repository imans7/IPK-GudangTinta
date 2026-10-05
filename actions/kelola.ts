"use server";
// Edit & hapus data tabel. SEMUA fungsi hanya untuk ADMIN dan dicek ulang di server
// (menyembunyikan tombol di UI saja tidak cukup).
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { uploadImage } from "@/lib/cloudinary";
import { isPeriode } from "@/lib/periode";
import { syncTotalBerat } from "@/lib/sync-berat";
import { round3 } from "@/lib/utils";

type R = { ok: boolean; error?: string };
const TIDAK_BOLEH: R = { ok: false, error: "Hanya ADMIN yang dapat mengubah atau menghapus data." };
const isAdmin = async () => (await getUser())?.role === "ADMIN";
const refresh = () => ["/", "/transaksi-masuk", "/transaksi-keluar", "/pengembalian"].forEach((p) => revalidatePath(p));

// ===== KATALOG (dashboard) =====
export async function updateBarang(kode: string, periode: string, fd: FormData): Promise<R> {
  if (!(await isAdmin())) return TIDAK_BOLEH;
  const b = await prisma.masterKatalog.findUnique({ where: { kode } });
  if (!b) return { ok: false, error: "Barang tidak ditemukan." };
  const nama = String(fd.get("nama_barang") ?? "").trim();
  const satuan = String(fd.get("satuan") ?? "").trim();
  const sk = Number(fd.get("stock_awal_kaleng") || 0), sb = Number(fd.get("stock_awal_berat") || 0);
  if (!nama || !satuan || !(sk >= 0) || !(sb >= 0)) return { ok: false, error: "Nama, satuan wajib; stock awal tidak boleh negatif." };
  if (satuan !== b.satuan) {
    const [m, k, c] = await Promise.all([prisma.transaksiMasuk.count({ where: { kode_barang: kode } }), prisma.transaksiKeluar.count({ where: { kode_barang: kode } }), prisma.detailKaleng.count({ where: { kode_barang: kode } })]);
    if (m + k + c > 0) return { ok: false, error: "Satuan tidak bisa diubah karena barang sudah punya transaksi/kaleng." };
  }
  let gambar_url = b.gambar_url;
  const f = fd.get("gambar");
  if (f instanceof File && f.size > 0) {
    try { gambar_url = await uploadImage(f, "katalog"); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Upload gagal." }; }
  }
  await prisma.$transaction(async (tx) => {
    await tx.masterKatalog.update({ where: { kode }, data: { nama_barang: nama, satuan, gambar_url, lacak_qr: fd.get("lacak_qr") === "on" } });
    if (isPeriode(periode)) await tx.stokPeriode.upsert({
      where: { periode_kode_barang: { periode, kode_barang: kode } },
      update: { stock_awal_kaleng: sk, stock_awal_berat: sb }, create: { periode, kode_barang: kode, stock_awal_kaleng: sk, stock_awal_berat: sb },
    });
  });
  refresh();
  return { ok: true };
}

export async function deleteBarang(kode: string): Promise<R> {
  if (!(await isAdmin())) return TIDAK_BOLEH;
  const [m, k, c, dipakai] = await Promise.all([
    prisma.transaksiMasuk.count({ where: { kode_barang: kode } }), prisma.transaksiKeluar.count({ where: { kode_barang: kode } }),
    prisma.detailKaleng.count({ where: { kode_barang: kode } }), prisma.komposisiWarna.count({ where: { kode_komponen: kode } }),
  ]);
  if (m + k + c > 0) return { ok: false, error: `Tidak bisa dihapus: ada ${m} transaksi masuk, ${k} transaksi keluar, ${c} kaleng.` };
  if (dipakai > 0) return { ok: false, error: "Tidak bisa dihapus: dipakai sebagai komponen resep tinta lain." };
  await prisma.$transaction([
    prisma.komposisiWarna.deleteMany({ where: { kode_barang: kode } }),
    prisma.stokPeriode.deleteMany({ where: { kode_barang: kode } }),
    prisma.masterKatalog.delete({ where: { kode } }),
  ]);
  refresh();
  return { ok: true };
}

/** Hitung ulang total_berat_tinta dari stok awal + masuk - terpakai. */
export async function sinkronkanBerat(): Promise<R & { n?: number }> {
  if (!(await isAdmin())) return TIDAK_BOLEH;
  const r = await syncTotalBerat();
  refresh();
  return { ok: true, n: r.n };
}

// ===== RIWAYAT MASUK =====
export async function updateMasuk(id: number, fd: FormData): Promise<R> {
  if (!(await isAdmin())) return TIDAK_BOLEH;
  const tanggal = String(fd.get("tanggal") ?? "");
  const keterangan = String(fd.get("keterangan") ?? "").trim() || "Barang masuk";
  if (!tanggal) return { ok: false, error: "Tanggal wajib diisi." };
  if (!(await prisma.transaksiMasuk.findUnique({ where: { id } }))) return { ok: false, error: "Data tidak ditemukan." };
  await prisma.$transaction([
    prisma.transaksiMasuk.update({ where: { id }, data: { tanggal_masuk: new Date(tanggal), keterangan } }),
    prisma.detailKaleng.updateMany({ where: { masuk_id: id }, data: { tanggal_masuk: new Date(tanggal) } }),
  ]);
  refresh();
  return { ok: true };
}

export async function deleteMasuk(id: number): Promise<R> {
  if (!(await isAdmin())) return TIDAK_BOLEH;
  const m = await prisma.transaksiMasuk.findUnique({ where: { id } });
  if (!m) return { ok: false, error: "Data tidak ditemukan." };
  const terpakai = await prisma.detailKaleng.count({ where: { masuk_id: id, status: { not: "BARU" } } });
  if (terpakai > 0) return { ok: false, error: `Tidak bisa dihapus: ${terpakai} kaleng dari transaksi ini sudah pernah dipinjam/dipakai.` };
  await prisma.$transaction([
    prisma.detailKaleng.deleteMany({ where: { masuk_id: id } }),
    prisma.transaksiMasuk.delete({ where: { id } }),
    prisma.masterKatalog.update({ where: { kode: m.kode_barang }, data: { total_berat_tinta: { decrement: m.total_berat_masuk } } }),
  ]);
  refresh();
  return { ok: true };
}

// ===== RIWAYAT KELUAR =====
export async function updateKeluar(id: number, fd: FormData): Promise<R> {
  if (!(await isAdmin())) return TIDAK_BOLEH;
  const k = await prisma.transaksiKeluar.findUnique({ where: { id } });
  if (!k) return { ok: false, error: "Data tidak ditemukan." };
  const tanggal = String(fd.get("tanggal") ?? "");
  const spk = String(fd.get("no_spk_mesin") ?? "").trim();
  const ket = String(fd.get("keterangan") ?? "").trim();
  if (!tanggal || !spk || !ket) return { ok: false, error: "Tanggal, No. SPK/Mesin, dan keterangan wajib diisi." };
  const namaOp = fd.has("nama_operator") ? String(fd.get("nama_operator")).trim().slice(0, 80) || null : undefined;
  let delta = 0;
  if (!k.id_kaleng) { // baris tanpa kaleng (impor Excel / non-QR): berat boleh dikoreksi
    const berat = round3(Number(fd.get("berat_keluar")));
    if (!Number.isFinite(berat) || berat <= 0) return { ok: false, error: "Berat/jumlah keluar harus lebih dari 0." };
    delta = round3(berat - k.berat_keluar);
  }
  await prisma.$transaction(async (tx) => {
    await tx.transaksiKeluar.update({ where: { id }, data: { tanggal_keluar: new Date(tanggal), no_spk_mesin: spk, keterangan: ket, ...(namaOp !== undefined ? { nama_operator: namaOp } : {}), ...(delta !== 0 ? { berat_keluar: round3(k.berat_keluar + delta) } : {}) } });
    if (delta !== 0) await tx.masterKatalog.update({ where: { kode: k.kode_barang }, data: { total_berat_tinta: { decrement: delta } } });
  });
  refresh();
  return { ok: true };
}

export async function deleteKeluar(id: number): Promise<R> {
  if (!(await isAdmin())) return TIDAK_BOLEH;
  const k = await prisma.transaksiKeluar.findUnique({ where: { id } });
  if (!k) return { ok: false, error: "Data tidak ditemukan." };
  if (k.id_kaleng) return { ok: false, error: "Tidak bisa dihapus: peminjaman kaleng. Batalkan lewat menu Pengembalian (hapus pengembalian) atau koreksi tanggal/SPK/keterangan." };
  await prisma.$transaction([
    prisma.transaksiKeluar.delete({ where: { id } }),
    prisma.masterKatalog.update({ where: { kode: k.kode_barang }, data: { total_berat_tinta: { increment: k.berat_keluar } } }),
  ]);
  refresh();
  return { ok: true };
}

// ===== RIWAYAT PENGEMBALIAN =====
export async function updatePengembalian(id: number, fd: FormData): Promise<R> {
  if (!(await isAdmin())) return TIDAK_BOLEH;
  const p = await prisma.transaksiPengembalian.findUnique({ where: { id }, include: { keluar: true } });
  if (!p) return { ok: false, error: "Data tidak ditemukan." };
  const tanggal = String(fd.get("tanggal") ?? "");
  const sisa = round3(Number(fd.get("berat_sisa")));
  if (!tanggal || !Number.isFinite(sisa) || sisa < 0) return { ok: false, error: "Tanggal dan berat sisa (>= 0) wajib diisi." };
  if (sisa > p.keluar.berat_keluar + 0.0005) return { ok: false, error: "Berat sisa tidak boleh lebih besar dari berat keluar." };
  const namaOp = fd.has("nama_operator") ? String(fd.get("nama_operator")).trim().slice(0, 80) || null : undefined;
  const berubah = sisa !== p.berat_sisa_dikembalikan;
  if (berubah && (await prisma.transaksiKeluar.count({ where: { id_kaleng: p.id_kaleng, id: { gt: p.id_transaksi_keluar } } })) > 0)
    return { ok: false, error: "Berat sisa tidak bisa diubah: kaleng ini sudah dipinjam lagi setelahnya." };
  const terpakai = round3(p.keluar.berat_keluar - sisa);
  const delta = round3(terpakai - p.berat_terpakai_aktual);
  await prisma.$transaction(async (tx) => {
    if (berubah) {
      await tx.masterKatalog.update({ where: { kode: p.kode_barang }, data: { total_berat_tinta: { decrement: delta } } });
      await tx.detailKaleng.update({ where: { id_kaleng: p.id_kaleng }, data: { berat_aktual: sisa, status: sisa <= 0.0005 ? "HABIS" : "TERBUKA" } });
    }
    await tx.transaksiPengembalian.update({
      where: { id },
      data: { tanggal_kembali: new Date(tanggal), ...(namaOp !== undefined ? { nama_operator: namaOp } : {}), berat_sisa_dikembalikan: sisa, berat_terpakai_aktual: terpakai, ...(p.stok_gudang_setelah != null ? { stok_gudang_setelah: round3(p.stok_gudang_setelah - delta) } : {}) },
    });
  });
  refresh();
  return { ok: true };
}

/** Hapus = batalkan pengembalian: kaleng kembali berstatus DIPINJAM dan total berat dipulihkan. */
export async function deletePengembalian(id: number): Promise<R> {
  if (!(await isAdmin())) return TIDAK_BOLEH;
  const p = await prisma.transaksiPengembalian.findUnique({ where: { id }, include: { keluar: true } });
  if (!p) return { ok: false, error: "Data tidak ditemukan." };
  if ((await prisma.transaksiKeluar.count({ where: { id_kaleng: p.id_kaleng, id: { gt: p.id_transaksi_keluar } } })) > 0)
    return { ok: false, error: "Tidak bisa dibatalkan: kaleng ini sudah dipinjam lagi setelahnya." };
  await prisma.$transaction([
    prisma.transaksiPengembalian.delete({ where: { id } }),
    prisma.detailKaleng.update({ where: { id_kaleng: p.id_kaleng }, data: { berat_aktual: p.keluar.berat_keluar, status: "DIPINJAM" } }),
    prisma.masterKatalog.update({ where: { kode: p.kode_barang }, data: { total_berat_tinta: { increment: p.berat_terpakai_aktual } } }),
  ]);
  refresh();
  return { ok: true };
}
