import { prisma } from "@/lib/prisma";
import { PhoneScanner } from "@/components/phone-scanner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scanner HP - Ink Traceability" };

// Halaman ini dibuka dari HP lewat QR penghubung. Tanpa login: token acak di URL adalah izinnya,
// dan hanya bisa mengirim teks hasil scan ke sesi itu (tidak bisa membaca data apa pun).
export default async function ScanHp({ params }: { params: { token: string } }) {
  const s = await prisma.sesiScan.findFirst({ where: { token: params.token, ditutup: false, berlaku_hingga: { gt: new Date() } }, select: { token: true } });
  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <h1 className="text-xl font-semibold">Scanner Kaleng</h1>
      {s ? <PhoneScanner token={s.token} /> : <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">Sesi tidak berlaku atau sudah berakhir. Buat sesi baru dari layar PC (tombol "Scan via Smartphone").</p>}
    </main>
  );
}
