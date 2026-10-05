"use client";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { buatSesiScan, pantauSesiScan, tutupSesiScan } from "@/actions/scan";
import { Button, Input, Label } from "@/components/ui";

/**
 * PC: tampilkan QR penghubung. HP men-scan QR ini, membuka halaman scanner, lalu setiap kaleng yang
 * di-scan HP muncul di PC (onScan) hampir seketika lewat polling 1 detik. Sesi tetap terbuka untuk scan berikutnya.
 */
export function RemoteScanPanel({ onScan, onClose }: { onScan: (idKaleng: string) => void; onClose: () => void }) {
  const [token, setToken] = useState("");
  const [origin, setOrigin] = useState("");
  const [lokal, setLokal] = useState(false);
  const [hp, setHp] = useState(false);
  const [berakhir, setBerakhir] = useState(false);
  const [err, setErr] = useState("");
  const [terakhir, setTerakhir] = useState("");
  const seq = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let batal = false;
    let timer: ReturnType<typeof setTimeout>;
    let tk = "";
    (async () => {
      const r = await buatSesiScan();
      if (batal) { if (r.ok) tutupSesiScan(r.token); return; }
      if (!r.ok) return setErr(r.error);
      tk = r.token; setToken(r.token); setOrigin(r.origin); setLokal(r.lokal);
      const tick = async () => {
        try {
          const s = await pantauSesiScan(tk, seq.current);
          if (batal) return;
          if (!s.aktif) return setBerakhir(true);
          setHp(s.hp);
          if (s.id) { seq.current = s.seq; setTerakhir(s.id); onScanRef.current(s.id); }
        } catch { /* koneksi putus sesaat: coba lagi */ }
        if (!batal) timer = setTimeout(tick, 1000);
      };
      tick();
    })();
    return () => { batal = true; clearTimeout(timer); if (tk) tutupSesiScan(tk); };
  }, []);

  const url = token && origin ? `${origin.replace(/\/$/, "")}/scan/${token}` : "";
  return (
    <div className="space-y-4 rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start gap-6">
        <div className="rounded-md border border-slate-200 bg-white p-3">
          {url && !berakhir ? <QRCodeSVG value={url} size={176} /> : <div className="flex h-44 w-44 items-center justify-center text-sm text-slate-500">{berakhir ? "Sesi berakhir" : "Menyiapkan..."}</div>}
        </div>
        <div className="min-w-60 flex-1 space-y-2 text-sm">
          <p className="font-semibold">Scan via Smartphone</p>
          <ol className="list-decimal space-y-1 pl-5 text-slate-700">
            <li>Buka kamera HP, arahkan ke QR di samping.</li>
            <li>Buka tautan yang muncul, izinkan akses kamera.</li>
            <li>Arahkan kamera HP ke QR di kaleng. Hasilnya langsung muncul di layar PC ini.</li>
          </ol>
          <p aria-live="polite" className={berakhir ? "text-red-600" : hp ? "font-medium text-green-700" : "text-slate-500"}>
            {berakhir ? "Sesi berakhir. Tutup lalu buat sesi baru." : hp ? "HP terhubung. Silakan scan kaleng." : "Menunggu HP terhubung..."}
          </p>
          {terakhir && <p className="text-slate-600">Scan terakhir: <span className="font-mono">{terakhir.slice(0, 8).toUpperCase()}</span></p>}
          {err && <p role="alert" className="text-red-600">{err}</p>}
        </div>
      </div>
      {lokal && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Label htmlFor="alamat-app">Alamat aplikasi ini terbuka sebagai "localhost", HP tidak bisa menjangkaunya. Isi alamat PC di jaringan yang sama (mis. http://192.168.1.10:3000) atau alamat aplikasi di cloud:</Label>
          <Input id="alamat-app" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="http://192.168.1.10:3000" />
        </div>
      )}
      {url && <p className="break-all text-xs text-slate-400">{url.replace(token, token.slice(0, 6) + "...")}</p>}
      <Button variant="outline" onClick={onClose}>Tutup scanner HP</Button>
    </div>
  );
}
