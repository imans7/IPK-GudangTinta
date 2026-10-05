"use server";
// Pairing scanner lintas perangkat (PC <-> HP) lewat database + polling pendek.
// Dipilih daripada WebSocket karena aplikasi di Vercel/serverless tidak bisa menahan koneksi WebSocket;
// cara ini jalan sama di cloud maupun jaringan lokal.
import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/session";

const MENIT = 15; // masa berlaku sesi, diperpanjang tiap ada aktivitas scan
const aktif = (token: string) => ({ token, ditutup: false, berlaku_hingga: { gt: new Date() } });
const perpanjang = () => new Date(Date.now() + MENIT * 60_000);

/** PC: buat sesi baru. Mengembalikan token rahasia + alamat aplikasi yang dipakai untuk QR penghubung. */
export async function buatSesiScan(): Promise<{ ok: true; token: string; origin: string; lokal: boolean } | { ok: false; error: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sesi login berakhir." };
  await prisma.sesiScan.deleteMany({ where: { OR: [{ berlaku_hingga: { lt: new Date() } }, { user_id: user.id, ditutup: true }] } }); // bersih-bersih
  const token = randomBytes(24).toString("base64url"); // 192-bit, tidak bisa ditebak
  await prisma.sesiScan.create({ data: { token, user_id: user.id, berlaku_hingga: perpanjang() } });

  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.|\d+\.\d+\.\d+\.\d+)/.test(host) ? "http" : "https");
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`).replace(/\/$/, "");
  let lokal = false;
  try { const n = new URL(origin).hostname; lokal = n === "localhost" || n.startsWith("127.") || n === "::1" || n === "[::1]"; } catch { /* abaikan */ }
  return { ok: true, token, origin, lokal };
}

/** PC: tanya sesi. Mengembalikan scan baru (id_kaleng) bila seq lebih besar dari yang sudah diterima. */
export async function pantauSesiScan(token: string, sejakSeq: number): Promise<{ aktif: false } | { aktif: true; hp: boolean; seq: number; id: string | null }> {
  const user = await getUser();
  if (!user) return { aktif: false };
  const s = await prisma.sesiScan.findFirst({ where: { ...aktif(token), user_id: user.id } }); // hanya pemilik sesi
  if (!s) return { aktif: false };
  return { aktif: true, hp: s.hp_terhubung, seq: s.seq, id: s.seq > sejakSeq ? s.hasil_id : null };
}

export async function tutupSesiScan(token: string): Promise<void> {
  const user = await getUser();
  if (!user) return;
  await prisma.sesiScan.updateMany({ where: { token, user_id: user.id }, data: { ditutup: true } });
}

/** HP: halaman scanner dibuka (token dari QR penghubung). Tidak butuh login: token rahasia = izin. */
export async function hpTerhubung(token: string): Promise<{ valid: boolean }> {
  const s = await prisma.sesiScan.findFirst({ where: aktif(token) });
  if (!s) return { valid: false };
  if (!s.hp_terhubung) await prisma.sesiScan.update({ where: { token }, data: { hp_terhubung: true } });
  return { valid: true };
}

/** HP: kirim hasil scan ke PC. Hanya menyimpan teks id; tidak membocorkan data apa pun ke HP. */
export async function kirimScan(token: string, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const kode = String(id ?? "").trim().slice(0, 100);
  if (!kode) return { ok: false, error: "QR kosong." };
  const s = await prisma.sesiScan.findFirst({ where: aktif(token) });
  if (!s) return { ok: false, error: "Sesi berakhir. Buat sesi baru dari layar PC." };
  await prisma.sesiScan.update({ where: { token }, data: { hasil_id: kode, seq: { increment: 1 }, hp_terhubung: true, berlaku_hingga: perpanjang() } });
  return { ok: true };
}
