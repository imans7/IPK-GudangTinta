"use client";
import { useEffect, useRef, useState } from "react";
import { hpTerhubung, kirimScan } from "@/actions/scan";
import { Button } from "@/components/ui";

/** Kamera HP sebagai scanner jarak jauh. Kamera live butuh HTTPS; bila tidak tersedia, pakai "Ambil foto QR" (jalan juga di HTTP). */
export function PhoneScanner({ token }: { token: string }) {
  const [state, setState] = useState<"mulai" | "jalan" | "gagal" | "habis">("mulai");
  const [kirim, setKirim] = useState<{ id: string; ok: boolean; error?: string } | null>(null);
  const [jumlah, setJumlah] = useState(0);
  const last = useRef({ text: "", at: 0 });
  const foto = useRef<HTMLInputElement>(null);

  async function proses(text: string) {
    const now = Date.now();
    if (text === last.current.text && now - last.current.at < 3000) return; // cegah kirim ganda untuk QR yang sama
    last.current = { text, at: now };
    const r = await kirimScan(token, text);
    if (r.ok) { setJumlah((n) => n + 1); setKirim({ id: text, ok: true }); navigator.vibrate?.(120); }
    else { setKirim({ id: text, ok: false, error: r.error }); if (/berakhir/i.test(r.error)) setState("habis"); }
  }

  useEffect(() => {
    let batal = false;
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    (async () => {
      const h = await hpTerhubung(token);
      if (batal) return;
      if (!h.valid) return setState("habis");
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        scanner = new Html5Qrcode("qr-reader-hp");
        await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } }, (t) => { void proses(t); }, () => {});
        if (!batal) setState("jalan");
      } catch { if (!batal) setState("gagal"); }
    })();
    return () => { batal = true; scanner?.stop().then(() => scanner?.clear()).catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function dariFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const text = await new Html5Qrcode("qr-file-reader").scanFile(f, false);
      await proses(text);
    } catch { setKirim({ id: "", ok: false, error: "QR tidak terbaca di foto. Dekatkan dan pastikan terang, lalu ulangi." }); }
  }

  if (state === "habis") return <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">Sesi berakhir. Buat sesi baru dari layar PC.</p>;
  return (
    <div className="space-y-4">
      <div id="qr-reader-hp" className="overflow-hidden rounded-lg border border-slate-300" />
      <div id="qr-file-reader" className="hidden" />
      {state === "mulai" && <p className="text-sm text-slate-500">Membuka kamera...</p>}
      {state === "gagal" && (
        <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Kamera live tidak bisa dibuka (izin kamera ditolak, atau alamat tidak memakai HTTPS{typeof window !== "undefined" && !window.isSecureContext ? ", itu penyebabnya di sini" : ""}). Gunakan tombol Ambil foto QR di bawah.
        </p>
      )}
      <input ref={foto} type="file" accept="image/*" capture="environment" className="hidden" onChange={dariFoto} aria-label="Ambil foto QR" />
      <Button className="w-full py-4" variant={state === "gagal" ? "primary" : "outline"} onClick={() => foto.current?.click()}>Ambil foto QR</Button>
      <div aria-live="polite" className="text-sm">
        {kirim?.ok && <p className="rounded-md bg-green-50 p-3 text-green-800">Terkirim ke PC: <span className="font-mono">{kirim.id.slice(0, 8).toUpperCase()}</span>. Arahkan ke kaleng berikutnya jika perlu.</p>}
        {kirim && !kirim.ok && <p className="rounded-md bg-red-50 p-3 text-red-700">{kirim.error}</p>}
        {jumlah > 0 && <p className="mt-2 text-slate-500">{jumlah} scan terkirim di sesi ini.</p>}
      </div>
      <p className="text-xs text-slate-400">Hasil FIFO dan form peminjaman tampil di layar PC. HP ini hanya bertugas memindai.</p>
    </div>
  );
}
