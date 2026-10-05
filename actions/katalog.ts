"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { uploadImage } from "@/lib/cloudinary";
import { isPeriode } from "@/lib/periode";
import { bersihkanKomposisi, simpanKomposisi } from "@/lib/komposisi";

/**
 * Tambah jenis tinta baru (ADMIN atau OPERATOR). Komposisi warna OPSIONAL:
 * kosong -> tidak ada yang disimpan dan proses tetap sukses; terisi -> disimpan ke KomposisiWarna
 * dalam transaksi yang sama dengan master tinta. Stok awal hanya bisa diisi ADMIN.
 */
export async function createBarang(fd: FormData): Promise<{ ok: boolean; error?: string; pesan?: string }> {
  const u = await getUser();
  if (!u) return { ok: false, error: "Sesi berakhir, silakan login ulang." };
  
  const admin = u.role === "ADMIN";
  const kode = String(fd.get("kode") ?? "").trim().toUpperCase();
  const nama = String(fd.get("nama_barang") ?? "").trim();
  const satuan = String(fd.get("satuan") ?? "").trim();
  const periode = String(fd.get("periode") ?? "");
  const sk = admin ? Number(fd.get("stock_awal_kaleng") || 0) : 0;
  const sb = admin ? Number(fd.get("stock_awal_berat") || 0) : 0;
  
  if (!kode || !nama || !satuan || !(sk >= 0) || !(sb >= 0)) return { ok: false, error: "Kode, nama, satuan wajib; stock awal tidak boleh negatif." };
  if (await prisma.masterKatalog.findUnique({ where: { kode } })) return { ok: false, error: `Kode ${kode} sudah ada.` };

  const komp = bersihkanKomposisi(fd.get("komposisi")); // dicek sebelum menyimpan apa pun
  if (!komp.ok) return { ok: false, error: komp.error };

  let gambar_url: string | null = null;
  const f = fd.get("gambar");
  
  // PERBAIKAN: Pengecekan objek File yang aman untuk Server Actions (Node.js)
  const isFile = f !== null && typeof f === "object" && "size" in f;
  
  if (isFile && (f as Blob).size > 0) {
    try { 
      gambar_url = await uploadImage(f as File, "katalog"); 
    } catch (e) { 
      return { ok: false, error: e instanceof Error ? e.message : "Upload gagal." }; 
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.masterKatalog.create({ 
      data: { 
        kode, 
        nama_barang: nama, 
        satuan, 
        stock_awal_kaleng: sk, 
        stock_awal_berat: sb, 
        total_berat_tinta: sb, 
        gambar_url, 
        lacak_qr: fd.get("lacak_qr") === "on" 
      } 
    });
    
    if (isPeriode(periode)) {
      await tx.stokPeriode.create({ 
        data: { periode, kode_barang: kode, stock_awal_kaleng: sk, stock_awal_berat: sb } 
      });
    }
    
    if (komp.rows.length > 0) {
      await simpanKomposisi(tx, kode, komp.rows);
    }
  });

  ["/", "/komposisi"].forEach((p) => revalidatePath(p));
  
  return { 
    ok: true, 
    pesan: komp.rows.length ? `${kode} ditambahkan dengan ${komp.rows.length} komponen komposisi.` : `${kode} ditambahkan (tanpa komposisi, bisa diisi nanti).` 
  };
}