"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { unitBerat } from "@/lib/berat";
import { round3 } from "@/lib/utils";

export type KembaliResult = { ok: true; terpakai: number; sisa: number; unit: string; stok: number } | { ok: false; error: string };

/**
 * Pengembalian: Berat Terpakai = Berat Keluar Awal - Berat Sisa.
 * Satu transaksi DB: buat TransaksiPengembalian, set berat_aktual kaleng = sisa (TERBUKA/HABIS),
 * dan kurangi total_berat_tinta sebesar berat terpakai (UPDATE atomik).
 */
export async function kembalikanTinta(fd: FormData): Promise<KembaliResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sesi berakhir, silakan login ulang." };
  const idKeluar = Number(fd.get("id_keluar"));
  const raw = String(fd.get("berat_sisa") ?? "");
  const namaOp = String(fd.get("nama_operator") ?? "").trim().slice(0, 80) || user.name; // default: akun yang login
  const sisa = round3(Number(raw));
  if (!Number.isInteger(idKeluar)) return { ok: false, error: "Pilih tinta yang sedang dipinjam." };
  if (raw === "" || !Number.isFinite(sisa) || sisa < 0) return { ok: false, error: "Berat sisa harus diisi (0 atau lebih)." };

  const k = await prisma.transaksiKeluar.findUnique({ where: { id: idKeluar }, include: { katalog: true, pengembalian: true } });
  if (!k || !k.id_kaleng) return { ok: false, error: "Data peminjaman tidak ditemukan." };
  if (k.pengembalian) return { ok: false, error: "Peminjaman ini sudah dikembalikan." };
  const label = unitBerat(k.katalog.satuan).label;
  if (sisa > k.berat_keluar + 0.0005) return { ok: false, error: `Berat sisa (${sisa} ${label}) tidak boleh lebih besar dari berat keluar (${k.berat_keluar} ${label}).` };
  const terpakai = round3(Math.max(0, k.berat_keluar - sisa));

  let stok = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const m = await tx.masterKatalog.update({ where: { kode: k.kode_barang }, data: { total_berat_tinta: { decrement: terpakai } } });
      stok = round3(m.total_berat_tinta);
      await tx.detailKaleng.update({ where: { id_kaleng: k.id_kaleng! }, data: { berat_aktual: sisa, status: sisa <= 0.0005 ? "HABIS" : "TERBUKA" } });
      await tx.transaksiPengembalian.create({
        data: { tanggal_kembali: new Date(), id_transaksi_keluar: k.id, kode_barang: k.kode_barang, id_kaleng: k.id_kaleng!, berat_sisa_dikembalikan: sisa, berat_terpakai_aktual: terpakai, stok_gudang_setelah: stok, pengembali_id: user.id, nama_operator: namaOp },
      }); // id_transaksi_keluar UNIQUE: dobel klik/dua operator ditolak database
    });
  } catch (e) {
    if (e instanceof Error && /Unique constraint/i.test(e.message)) return { ok: false, error: "Peminjaman ini sudah dikembalikan." };
    throw e;
  }
  ["/", "/pengembalian", "/transaksi-keluar"].forEach((x) => revalidatePath(x));
  return { ok: true, terpakai, sisa, unit: label, stok };
}
