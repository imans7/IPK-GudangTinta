"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { uploadImage } from "@/lib/cloudinary";
import { unitBerat } from "@/lib/berat";
import { cekLokasi, formatLokasi } from "@/lib/rak";
import { round3 } from "@/lib/utils";
import { bersihkanKomposisi, simpanKomposisi, type KomposisiInput } from "@/lib/komposisi";

export type BarisKaleng = { jumlah: number; berat: number; batch: string; expired: string; lokasi: { x: string; y: string; z: string } };
export type MasukPayload = {
  tanggal: string; kode: string; keterangan: string;
  nama_baru?: string; satuan_baru?: string; lacak_baru?: boolean;
  komposisi?: KomposisiInput[]; // OPSIONAL, hanya dipakai bila kode barang baru dibuat
  jumlah_nonqr?: number; // hanya untuk barang tanpa kaleng
  kaleng: BarisKaleng[]; // satu baris = N kaleng dengan berat/batch/rak yang sama
};
export type CanInfo = { id_kaleng: string; kode: string; nama: string; satuan: string; batch: string; exp: string; berat: number; lokasi: string };
export type MasukResult = { ok: true; cans: CanInfo[]; pesan: string } | { ok: false; error: string };

/**
 * Inbound multi-batch: satu submit = satu TransaksiMasuk + banyak DetailKaleng (UUID unik per kaleng fisik).
 * total_berat_masuk = jumlah semua kaleng, lalu ditambahkan ke total_berat_tinta barang.
 */
export async function createMasuk(fd: FormData): Promise<MasukResult> {
  const user = await getUser();
  if (!user || user.role !== "ADMIN") return { ok: false, error: "Hanya ADMIN yang dapat mencatat barang masuk." };
  let p: MasukPayload;
  try { p = JSON.parse(String(fd.get("payload"))); } catch { return { ok: false, error: "Data form tidak terbaca." }; }

  const kode = String(p.kode ?? "").trim().toUpperCase();
  const keterangan = String(p.keterangan ?? "").trim() || "Barang masuk";
  if (!kode || !p.tanggal) return { ok: false, error: "Tanggal dan kode barang wajib diisi." };

  // Kode diketik manual & belum ada di katalog -> buat barang baru.
  let barang = await prisma.masterKatalog.findUnique({ where: { kode } });
  let baru = false;
  if (!barang) {
    const nama = String(p.nama_baru ?? "").trim(), satuan = String(p.satuan_baru ?? "").trim();
    if (!nama || !satuan) return { ok: false, error: `Kode ${kode} belum ada di katalog. Isi nama barang dan satuan.` };
    const komp = bersihkanKomposisi(p.komposisi); // opsional: kosong = dilewati
    if (!komp.ok) return { ok: false, error: komp.error };
    barang = await prisma.$transaction(async (tx) => {
      const b0 = await tx.masterKatalog.create({ data: { kode, nama_barang: nama, satuan, lacak_qr: p.lacak_baru !== false } });
      if (komp.rows.length > 0) await simpanKomposisi(tx, kode, komp.rows);
      return b0;
    });
    baru = true;
  }
  const b = barang;

  let foto_url: string | null = null;
const foto = fd.get("foto");

// Ganti 'foto instanceof File' dengan pengecekan object dan ketersediaan atribut size
const isFile = foto !== null && typeof foto === "object" && "size" in foto;

if (isFile && (foto as Blob).size > 0) {
    try { 
        foto_url = await uploadImage(foto as File, "nota-masuk"); 
    }
    catch (e) { 
        return { ok: false, error: e instanceof Error ? e.message : "Upload foto gagal." } 
    }
}
  const tgl = new Date(p.tanggal);
  const awalan = baru ? `Barang baru ${kode} dibuat. ` : "";

  // ---- barang tanpa kaleng ----
  if (!b.lacak_qr) {
    const jml = round3(Number(p.jumlah_nonqr));
    if (!Number.isFinite(jml) || jml <= 0) return { ok: false, error: "Jumlah harus lebih dari 0." };
    await prisma.$transaction([
      prisma.transaksiMasuk.create({ data: { tanggal_masuk: tgl, kode_barang: kode, keterangan, jumlah_kaleng_masuk: 0, total_berat_masuk: jml, foto_url, admin_id: user.id } }),
      prisma.masterKatalog.update({ where: { kode }, data: { total_berat_tinta: { increment: jml } } }),
    ]);
    refresh();
    return { ok: true, cans: [], pesan: `${awalan}${jml} ${b.satuan} ${b.nama_barang} tercatat (tanpa QR).` };
  }

  // ---- barang berkaleng: validasi semua baris ----
  const rows = Array.isArray(p.kaleng) ? p.kaleng : [];
  if (rows.length === 0) return { ok: false, error: "Tambahkan minimal satu baris kaleng." };
  const bersih: { n: number; berat: number; batch: string; exp: string; L: { x: string; y: string; z: number } }[] = [];
  for (const [i, r] of rows.entries()) {
    const n = Math.floor(Number(r.jumlah)), berat = round3(Number(r.berat)), batch = String(r.batch ?? "").trim(), exp = String(r.expired ?? "");
    const L = cekLokasi(r.lokasi);
    if (!(n >= 1 && n <= 100)) return { ok: false, error: `Baris ${i + 1}: jumlah kaleng 1-100.` };
    if (!(berat > 0)) return { ok: false, error: `Baris ${i + 1}: berat per kaleng harus lebih dari 0.` };
    if (!batch || !exp) return { ok: false, error: `Baris ${i + 1}: batch dan tanggal kedaluwarsa wajib.` };
    if (!L.ok) return { ok: false, error: `Baris ${i + 1}: pilih lokasi rak X, Y, dan Z.` };
    bersih.push({ n, berat, batch, exp, L });
  }
  const totalKaleng = bersih.reduce((a, r) => a + r.n, 0);
  if (totalKaleng > 300) return { ok: false, error: "Maksimal 300 kaleng per transaksi." };
  const totalBerat = round3(bersih.reduce((a, r) => a + r.n * r.berat, 0));

  const cans: CanInfo[] = [];
  await prisma.$transaction(async (tx) => {
    const m = await tx.transaksiMasuk.create({ data: { tanggal_masuk: tgl, kode_barang: kode, keterangan, jumlah_kaleng_masuk: totalKaleng, total_berat_masuk: totalBerat, foto_url, admin_id: user.id } });
    const data = [];
    for (const r of bersih) for (let i = 0; i < r.n; i++) {
      const id = randomUUID();
      data.push({ id_kaleng: id, kode_barang: kode, masuk_id: m.id, lokasi_x: r.L.x, lokasi_y: r.L.y, lokasi_z: r.L.z, batch_number: r.batch, tanggal_masuk: tgl, tanggal_kedaluwarsa: new Date(r.exp), berat_aktual: r.berat, status: "BARU" as const });
      cans.push({ id_kaleng: id, kode, nama: b.nama_barang, satuan: b.satuan, batch: r.batch, exp: r.exp, berat: r.berat, lokasi: formatLokasi(r.L.x, r.L.y, r.L.z) });
    }
    await tx.detailKaleng.createMany({ data });
    await tx.masterKatalog.update({ where: { kode }, data: { total_berat_tinta: { increment: totalBerat } } });
  });
  refresh();
  return { ok: true, cans, pesan: `${awalan}${totalKaleng} kaleng (${round3(totalBerat)} ${unitBerat(b.satuan).label}) tercatat. Cetak label QR dan tempel di tiap kaleng.` };
}

function refresh() { ["/", "/transaksi-masuk"].forEach((x) => revalidatePath(x)); }
