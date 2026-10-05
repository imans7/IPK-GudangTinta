"use client";
import { useEffect, useState, useTransition } from "react";
import { lookupKaleng, pilihTinta, submitKeluarTanpaQr, submitPinjam, type KalengInfo } from "@/actions/keluar";
import { Combobox, SuggestInput } from "@/components/combobox";
import { FotoKaleng } from "@/components/foto";
import { KomposisiModal } from "@/components/komposisi-modal";
import { QrScanner } from "@/components/qr-scanner";
import { RemoteScanPanel } from "@/components/remote-scan";
import { Button, Card, Input, Label } from "@/components/ui";
import { fmtNum, todayInput } from "@/lib/utils";

type Barang = { kode: string; nama_barang: string; satuan: string; gambar_url?: string | null };
type Props = { tinta: Barang[]; tanpaQr: Barang[]; saran: { spk: string[]; ket: string[]; operator: string[] }; userName: string };

export function KeluarFlow({ tinta, tanpaQr, saran, userName }: Props) {
  const [mode, setMode] = useState<"tinta" | "tanpa">("tinta");
  const [scanning, setScanning] = useState(false);
  const [remote, setRemote] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => { setMobile(window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)); }, []);
  const [kaleng, setKaleng] = useState<KalengInfo | null>(null);
  const [sel, setSel] = useState("");
  const [idManual, setIdManual] = useState("");
  const [selTanpa, setSelTanpa] = useState("");
  const [komp, setKomp] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, start] = useTransition();

  const optTinta = tinta.map((t) => ({ value: t.kode, label: `${t.kode} - ${t.nama_barang}`, hint: t.satuan }));
  const optTanpa = tanpaQr.map((t) => ({ value: t.kode, label: `${t.kode} - ${t.nama_barang}`, hint: t.satuan }));
  const gambar = kaleng?.gambar ?? tinta.find((t) => t.kode === sel)?.gambar_url ?? null;

  function reset() { setKaleng(null); setSel(""); setIdManual(""); setScanning(false); setRemote(false); }
  function hasil(r: Awaited<ReturnType<typeof lookupKaleng>>) {
    if (r.ok) { setKaleng(r.kaleng); setSel(r.kaleng.kode); } else { setKaleng(null); setError(r.error); }
  }
  function cekQr(id: string) { setScanning(false); setError(""); setSuccess(""); start(async () => hasil(await lookupKaleng(id))); }
  // Hasil scan dari HP: bila lolos FIFO tutup scanner HP; bila tidak, tampilkan alasan dan biarkan HP scan ulang.
  function cekRemote(id: string) {
    setError(""); setSuccess("");
    start(async () => { const r = await lookupKaleng(id); if (r.ok) { setRemote(false); setKaleng(r.kaleng); setSel(r.kaleng.kode); } else setError(r.error); });
  }
  function cariManual(kode: string) { setSel(kode); setError(""); setSuccess(""); setKaleng(null); start(async () => hasil(await pilihTinta(kode))); }

  function submitPinjamForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("id_kaleng", kaleng!.id_kaleng);
    setError("");
    start(async () => {
      const r = await submitPinjam(fd);
      if (r.ok) { setSuccess(r.pesan); reset(); } else setError(r.error);
    });
  }
  function submitTanpaForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(""); setSuccess("");
    start(async () => {
      const r = await submitKeluarTanpaQr(fd);
      if (r.ok) { setSuccess(r.pesan); form.reset(); setSelTanpa(""); } else setError(r.error);
    });
  }

  return (
    <Card className="p-4">
      <h2 className="mb-4 font-semibold">Peminjaman / Pengeluaran</h2>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        <Button variant={mode === "tinta" ? "primary" : "outline"} onClick={() => { setMode("tinta"); setError(""); setSuccess(""); }}>Tinta berkaleng</Button>
        {tanpaQr.length > 0 && <Button variant={mode === "tanpa" ? "primary" : "outline"} onClick={() => { setMode("tanpa"); reset(); setError(""); setSuccess(""); }}>Barang tanpa QR</Button>}
      </div>

      {mode === "tinta" && !kaleng && (
        <div className="space-y-4">
          {remote ? (
            <RemoteScanPanel onScan={cekRemote} onClose={() => setRemote(false)} />
          ) : scanning ? (
            <QrScanner onScan={cekQr} onClose={() => setScanning(false)} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Button className="py-6 text-lg" variant={mobile ? "primary" : "outline"} onClick={() => { setError(""); setSuccess(""); setScanning(true); }} disabled={pending}>Scan QR Kaleng{mobile ? "" : " (kamera perangkat ini)"}</Button>
              <Button className="py-6 text-lg" variant={mobile ? "outline" : "primary"} onClick={() => { setError(""); setSuccess(""); setRemote(true); }} disabled={pending}>Scan via Smartphone</Button>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cari-tinta">Kaleng tanpa stiker QR? Cari tinta (ketik nama atau kode)</Label>
              <Combobox id="cari-tinta" options={optTinta} value={sel} onChange={(v) => cariManual(v)} placeholder="mis. magenta, EMPMRC3" />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (idManual.trim()) cekQr(idManual); }}>
              <Label htmlFor="id-manual">Atau ketik ID kaleng dari stiker</Label>
              <div className="flex gap-2"><Input id="id-manual" value={idManual} onChange={(e) => setIdManual(e.target.value)} /><Button type="submit" variant="outline" disabled={pending}>Cek</Button></div>
            </form>
          </div>
          {pending && <p className="text-sm text-slate-500">Mencari kaleng sesuai FIFO...</p>}
          {sel && !pending && !kaleng && gambar && <div className="max-w-[160px]"><FotoKaleng url={gambar} alt="Foto tinta" /></div>}
        </div>
      )}

      {mode === "tinta" && kaleng && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <FotoKaleng url={kaleng.gambar} alt={`Foto ${kaleng.nama}`} />
            <div className="space-y-1 text-sm">
              <p className="text-base font-semibold">{kaleng.kode} - {kaleng.nama}</p>
              <p>Batch {kaleng.batch} | Exp {kaleng.exp} | Status {kaleng.status}</p>
              <p>Sisa tercatat: <b>{fmtNum(kaleng.berat)} {kaleng.unit}</b></p>
              <p>Lokasi rak: <b className="font-mono">{kaleng.lokasi}</b></p>
              <p className="text-green-700">Kaleng ini sesuai urutan FIFO. ID: <span className="font-mono">{kaleng.id_kaleng.slice(0, 8).toUpperCase()}</span></p>
              <Button variant="outline" onClick={() => setKomp(true)}>Lihat Komposisi</Button>
            </div>
          </div>
          <KomposisiModal kode={kaleng.kode} nama={kaleng.nama} open={komp} onClose={() => setKomp(false)} />
          <form key={kaleng.id_kaleng} onSubmit={submitPinjamForm} className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="tanggal">Tanggal</Label><Input id="tanggal" name="tanggal" type="date" defaultValue={todayInput()} required /></div>
            <div><Label htmlFor="no_spk_mesin">No. SPK / Mesin</Label><SuggestInput id="no_spk_mesin" name="no_spk_mesin" suggestions={saran.spk} placeholder="1797/Sor-d atau Sm 74" required /></div>
            <div className="sm:col-span-2"><Label htmlFor="keterangan">Keterangan cetak</Label><SuggestInput id="keterangan" name="keterangan" suggestions={saran.ket} placeholder="Untuk cetak SBR" required /></div>
            <div>
              <Label htmlFor="berat_awal">Berat awal saat dipinjam ({kaleng.unit})</Label>
              <Input id="berat_awal" name="berat_awal" type="number" step="any" min="0" max={kaleng.berat} defaultValue={kaleng.berat} required />
              <p className="mt-1 text-xs text-slate-500">Otomatis dari sisa tercatat. Ubah bila hasil timbang berbeda.</p>
            </div>
            <div>
              <Label htmlFor="nama_operator">Nama operator peminjam (klik atau ketik)</Label>
              <SuggestInput id="nama_operator" name="nama_operator" suggestions={saran.operator} defaultValue={userName} required />
            </div>
            <div className="flex items-end gap-2">
              <Button disabled={pending}>{pending ? "Menyimpan..." : "Pinjam tinta"}</Button>
              <Button type="button" variant="outline" onClick={reset}>Ganti kaleng</Button>
            </div>
          </form>
        </div>
      )}

      {mode === "tanpa" && (
        <form onSubmit={submitTanpaForm} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label htmlFor="kode_barang">Barang (klik atau ketik)</Label><Combobox id="kode_barang" name="kode_barang" options={optTanpa} value={selTanpa} onChange={setSelTanpa} required /></div>
          <div><Label htmlFor="tanggal_m">Tanggal</Label><Input id="tanggal_m" name="tanggal" type="date" defaultValue={todayInput()} required /></div>
          <div><Label htmlFor="spk_m">No. SPK / Mesin</Label><SuggestInput id="spk_m" name="no_spk_mesin" suggestions={saran.spk} required /></div>
          <div className="sm:col-span-2"><Label htmlFor="ket_m">Keterangan</Label><SuggestInput id="ket_m" name="keterangan" suggestions={saran.ket} required /></div>
          <div><Label htmlFor="jumlah_m">Jumlah keluar</Label><Input id="jumlah_m" name="jumlah_keluar" type="number" step="any" min="0" required /></div>
          <div><Label htmlFor="operator_m">Nama operator (klik atau ketik)</Label><SuggestInput id="operator_m" name="nama_operator" suggestions={saran.operator} defaultValue={userName} required /></div>
          <div className="flex items-end"><Button disabled={pending}>{pending ? "Menyimpan..." : "Simpan pengeluaran"}</Button></div>
        </form>
      )}

      {error && <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p role="status" className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{success}</p>}
    </Card>
  );
}
