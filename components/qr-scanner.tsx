"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

// Membungkus html5-qrcode. Memanggil onScan sekali lalu menutup kamera.
export function QrScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const [err, setErr] = useState("");
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);

  useEffect(() => {
    let cancelled = false;
    let done = false;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      const s = new Html5Qrcode("qr-reader");
      scannerRef.current = s;
      try {
        await s.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text) => { if (!done) { done = true; onScan(text); } },
          () => {},
        );
      } catch {
        setErr(`Kamera perangkat ini tidak bisa dibuka (izin ditolak, tidak ada kamera, atau bukan HTTPS). Coba "Scan via Smartphone", atau ketik ID kaleng manual.`);
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) s.stop().then(() => s.clear()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div id="qr-reader" className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-slate-300" />
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      <Button variant="outline" onClick={onClose}>Batal</Button>
    </div>
  );
}
