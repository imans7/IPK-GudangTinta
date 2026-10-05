"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";
import { bersihkanKomposisi, simpanKomposisi, type KomposisiInput } from "@/lib/komposisi";

export async function saveKomposisi(kode: string, rows: KomposisiInput[]): Promise<{ ok: boolean; error?: string }> {
  const u = await getUser();
  if (!u || u.role !== "ADMIN") return { ok: false, error: "Hanya ADMIN yang dapat mengubah komposisi." };
  if (!(await prisma.masterKatalog.findUnique({ where: { kode } }))) return { ok: false, error: "Tinta tidak ditemukan di katalog." };
  const c = bersihkanKomposisi(rows);
  if (!c.ok) return { ok: false, error: c.error };
  if (c.rows.length === 0) return { ok: false, error: "Isi minimal satu komponen, atau pakai tombol Hapus komposisi." };
  await prisma.$transaction((tx) => simpanKomposisi(tx, kode, c.rows));
  revalidatePath("/komposisi");
  return { ok: true };
}

export async function hapusKomposisi(kode: string): Promise<{ ok: boolean; error?: string }> {
  const u = await getUser();
  if (!u || u.role !== "ADMIN") return { ok: false, error: "Hanya ADMIN." };
  await prisma.komposisiWarna.deleteMany({ where: { kode_barang: kode } });
  revalidatePath("/komposisi");
  return { ok: true };
}
