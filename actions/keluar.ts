"use server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { rekomendasiFifo, startOfToday } from "@/lib/fifo";
import { unitBerat } from "@/lib/berat";
import { formatLokasi } from "@/lib/rak";
import { fmtDate, round3 } from "@/lib/utils";

type KalengFull = Prisma.DetailKalengGetPayload<{ include: { katalog: true } }>;
export type KalengInfo = {
  id_kaleng: string; kode: string; nama: string; satuan: string; gambar: string | null;
  batch: string; exp: string; berat: number; status: string; lokasi: string; unit: string; ada_komposisi: boolean;
};
export type LookupResult = { ok: true; kaleng: KalengInfo } | { ok: false; error: string };
export type KomposisiRow = { kode_komponen: string | null; nama_komponen: string; is_base: boolean; jumlah: number | null; satuan: "GRAM" | "PERSEN" };

async function toInfo(k: KalengFull): Promise<KalengInfo> {
  return {
    id_kaleng: k.id_kaleng, kode: k.kode_barang, nama: k.katalog.nama_barang, satuan: k.katalog.satuan, gambar: k.katalog.gambar_url,
    batch: k.batch_number, exp: fmtDate(k.tanggal_kedaluwarsa), berat: k.berat_aktual, status: k.status,
    lokasi: formatLokasi(k.lokasi_x, k.lokasi_y, k.lokasi_z), unit: unitBerat(k.katalog.satuan).label,
    ada_komposisi: (await prisma.komposisiWarna.count({ where: { kode_barang: k.kode_barang } })) > 0,
  };
}

async function validasiFifo(id: string) {
  const k = await prisma.detailKaleng.findUnique({ where: { id_kaleng: id }, include: { katalog: true } });
  if (!k) return { error: "QR/ID tidak dikenal. Kaleng tidak ditemukan di sistem." } as const;
  if (k.status === "DIPINJAM") return { error: "Kaleng ini sedang dipinjam. Selesaikan dulu lewat menu Pengembalian." } as const;
  if (k.status === "HABIS" || k.berat_aktual <= 0) return { error: "Kaleng ini sudah HABIS." } as const;
  if (k.tanggal_kedaluwarsa < startOfToday()) return { error: `Kaleng sudah kedaluwarsa (${fmtDate(k.tanggal_kedaluwarsa)}). Jangan dipakai.` } as const;
  const rek = await rekomendasiFifo(k.kode_barang);
  if (rek && rek.id_kaleng !== k.id_kaleng) {
    return { error: `Bukan urutan FIFO. Pakai kaleng ${rek.status === "TERBUKA" ? "TERBUKA" : "BARU"} batch ${rek.batch_number} (exp ${fmtDate(rek.tanggal_kedaluwarsa)}, rak ${formatLokasi(rek.lokasi_x, rek.lokasi_y, rek.lokasi_z)}, kode ${rek.id_kaleng.slice(0, 8).toUpperCase()}).` } as const;
  }
  return { kaleng: k } as const;
}

/** Scan QR / ketik ID kaleng. */
export async function lookupKaleng(idRaw: string): Promise<LookupResult> {
  if (!(await getUser())) return { ok: false, error: "Sesi berakhir, silakan login ulang." };
  const id = idRaw.trim();
  if (!id) return { ok: false, error: "QR kosong." };
  const r = await validasiFifo(id);
  if ("error" in r) return { ok: false, error: r.error };
  return { ok: true, kaleng: await toInfo(r.kaleng) };
}

/** Pencarian manual (kaleng tanpa QR): pilih tinta, sistem menunjuk kaleng FIFO + lokasi raknya. */
export async function pilihTinta(kode: string): Promise<LookupResult> {
  if (!(await getUser())) return { ok: false, error: "Sesi berakhir, silakan login ulang." };
  const b = await prisma.masterKatalog.findUnique({ where: { kode: kode.trim() } });
  if (!b) return { ok: false, error: "Tinta tidak ditemukan di katalog." };
  if (!b.lacak_qr) return { ok: false, error: `${b.nama_barang} tidak berkaleng. Gunakan tab "Barang tanpa QR".` };
  const k = await rekomendasiFifo(b.kode);
  if (!k) return { ok: false, error: `Tidak ada kaleng ${b.nama_barang} yang tersedia (habis, kedaluwarsa, atau sedang dipinjam).` };
  return { ok: true, kaleng: await toInfo({ ...k, katalog: b }) };
}

export async function getKomposisi(kode: string): Promise<KomposisiRow[]> {
  if (!(await getUser())) return [];
  const rows = await prisma.komposisiWarna.findMany({ where: { kode_barang: kode }, orderBy: [{ is_base: "desc" }, { urutan: "asc" }] });
  return rows.map((r) => ({ kode_komponen: r.kode_komponen, nama_komponen: r.nama_komponen, is_base: r.is_base, jumlah: r.jumlah, satuan: r.satuan }));
}

/** Peminjaman: kaleng -> DIPINJAM, catat berat_keluar (berat awal). Stok berkurang saat pengembalian. */
export async function submitPinjam(fd: FormData): Promise<{ ok: true; pesan: string } | { ok: false; error: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sesi berakhir, silakan login ulang." };
  const id = String(fd.get("id_kaleng") ?? "");
  const noSpk = String(fd.get("no_spk_mesin") ?? "").trim();
  const ket = String(fd.get("keterangan") ?? "").trim();
  const tanggal = String(fd.get("tanggal") ?? "");
  const awal = round3(Number(fd.get("berat_awal")));
  const namaOp = String(fd.get("nama_operator") ?? "").trim().slice(0, 80) || user.name; // default: akun yang login
  if (!id || !noSpk || !ket || !tanggal) return { ok: false, error: "No. SPK/Mesin, keterangan, dan tanggal wajib diisi." };
  if (!Number.isFinite(awal) || awal <= 0) return { ok: false, error: "Berat awal harus lebih dari 0." };

  const v = await validasiFifo(id);
  if ("error" in v) return { ok: false, error: v.error };
  const k = v.kaleng;
  const label = unitBerat(k.katalog.satuan).label;
  if (awal > k.berat_aktual + 0.0005) return { ok: false, error: `Berat awal melebihi sisa tercatat di kaleng (${k.berat_aktual} ${label}).` };

  try {
    await prisma.$transaction(async (tx) => {
      const upd = await tx.detailKaleng.updateMany({ where: { id_kaleng: id, berat_aktual: k.berat_aktual, status: { in: ["BARU", "TERBUKA"] } }, data: { status: "DIPINJAM" } });
      if (upd.count !== 1) throw new Error("KONFLIK");
      await tx.transaksiKeluar.create({ data: { tanggal_keluar: new Date(tanggal), kode_barang: k.kode_barang, id_kaleng: id, no_spk_mesin: noSpk, keterangan: ket, jumlah_kaleng_keluar: 1, berat_keluar: awal, operator_id: user.id, nama_operator: namaOp } });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "KONFLIK") return { ok: false, error: "Kaleng baru saja dipakai operator lain. Ulangi pencarian." };
    throw e;
  }
  ["/", "/pengembalian", "/transaksi-keluar"].forEach((x) => revalidatePath(x));
  return { ok: true, pesan: `${k.katalog.nama_barang} dipinjam (${awal} ${label}). Setelah selesai cetak, timbang sisa di menu Pengembalian.` };
}

/** Barang non-kaleng: langsung keluar, total_berat_tinta langsung berkurang. */
export async function submitKeluarTanpaQr(fd: FormData): Promise<{ ok: true; pesan: string } | { ok: false; error: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sesi berakhir, silakan login ulang." };
  const kode = String(fd.get("kode_barang") ?? "");
  const noSpk = String(fd.get("no_spk_mesin") ?? "").trim();
  const ket = String(fd.get("keterangan") ?? "").trim();
  const tanggal = String(fd.get("tanggal") ?? "");
  const jumlah = round3(Number(fd.get("jumlah_keluar")));
  const namaOp = String(fd.get("nama_operator") ?? "").trim().slice(0, 80) || user.name;
  if (!kode || !noSpk || !ket || !tanggal) return { ok: false, error: "Barang, No. SPK/Mesin, keterangan, dan tanggal wajib diisi." };
  if (!Number.isFinite(jumlah) || jumlah <= 0) return { ok: false, error: "Jumlah keluar harus lebih dari 0." };
  const b = await prisma.masterKatalog.findUnique({ where: { kode } });
  if (!b) return { ok: false, error: "Barang tidak ditemukan. Pilih dari daftar atau ketik kodenya dengan benar." };
  if (b.lacak_qr) return { ok: false, error: `${b.nama_barang} berkaleng: gunakan tab "Tinta berkaleng".` };
  await prisma.$transaction([
    prisma.transaksiKeluar.create({ data: { tanggal_keluar: new Date(tanggal), kode_barang: kode, id_kaleng: null, no_spk_mesin: noSpk, keterangan: ket, jumlah_kaleng_keluar: 0, berat_keluar: jumlah, operator_id: user.id, nama_operator: namaOp } }),
    prisma.masterKatalog.update({ where: { kode }, data: { total_berat_tinta: { decrement: jumlah } } }),
  ]);
  ["/", "/transaksi-keluar"].forEach((x) => revalidatePath(x));
  return { ok: true, pesan: `${jumlah} ${b.satuan} ${b.nama_barang} tercatat keluar.` };
}
