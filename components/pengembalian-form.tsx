"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { kembalikanTinta } from "@/actions/pengembalian";
import { Combobox, SuggestInput } from "@/components/combobox";
import { Button, Card, Input, Label } from "@/components/ui";
import { fmtNum } from "@/lib/utils";

export type Aktif = { id: number; kode: string; nama: string; mesin: string; awal: number; unit: string; lokasi: string; operator: string | null };

export function PengembalianForm({ aktif, userName, operators }: { aktif: Aktif[]; userName: string; operators: string[] }) {
  const router = useRouter();
  const [sel, setSel] = useState("");
  const [sisa, setSisa] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [pending, start] = useTransition();
  const a = aktif.find((x) => String(x.id) === sel);
  const s = Number(sisa);
  const terpakai = a && sisa !== "" && Number.isFinite(s) ? Math.round((a.awal - s) * 1000) / 1000 : null;
  const salah = terpakai !== null && (terpakai < 0 || s < 0);
  const options = aktif.map((x) => ({ value: String(x.id), label: `${x.kode} - ${x.nama} | ${x.mesin}`, hint: `Berat keluar ${fmtNum(x.awal)} ${x.unit} | rak ${x.lokasi}${x.operator ? ` | ${x.operator}` : ""}` }));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(""); setOk("");
    start(async () => {
      const r = await kembalikanTinta(fd);
      if (!r.ok) return setErr(r.error);
      setOk(`Tersimpan. Terpakai ${fmtNum(r.terpakai)} ${r.unit}, sisa ${fmtNum(r.sisa)} ${r.unit}. Sisa total stok gudang: ${fmtNum(r.stok)} ${r.unit}.`);
      setSel(""); setSisa(""); router.refresh();
    });
  }
  return (
    <Card className="p-4">
      <h2 className="mb-1 font-semibold">Form Pengembalian Tinta</h2>
      <p className="mb-4 text-sm text-slate-500">{aktif.length} kaleng sedang dipinjam. Timbang sisa tinta setelah cetak selesai.</p>
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="pilih">Tinta yang dikembalikan (klik atau ketik kode, nama, mesin)</Label>
          <Combobox id="pilih" name="id_keluar" options={options} value={sel} onChange={setSel} required />
        </div>
        {a && <p className="text-sm sm:col-span-2">Berat keluar awal: <b>{fmtNum(a.awal)} {a.unit}</b>{a.operator ? <> | Dipinjam oleh: <b>{a.operator}</b></> : null}</p>}
        <div>
          <Label htmlFor="berat_sisa">Berat sisa hasil timbang {a ? `(${a.unit})` : ""}</Label>
          <Input id="berat_sisa" name="berat_sisa" type="number" step="any" min="0" max={a?.awal} required value={sisa} onChange={(e) => setSisa(e.target.value)} />
        </div>
        <div className="flex items-end">
          {terpakai !== null && <p className={`w-full rounded-md p-2 text-sm ${salah ? "bg-red-50 text-red-700" : "bg-slate-50"}`} aria-live="polite">{salah ? "Sisa tidak boleh lebih besar dari berat keluar." : <>Terpakai: <b>{fmtNum(terpakai)} {a!.unit}</b></>}</p>}
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="nama_operator">Nama operator yang mengembalikan (klik atau ketik)</Label>
          <SuggestInput id="nama_operator" name="nama_operator" suggestions={operators} defaultValue={userName} required />
        </div>
        {err && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{err}</p>}
        {ok && <p role="status" className="text-sm text-green-700 sm:col-span-2">{ok}</p>}
        <div className="sm:col-span-2"><Button disabled={pending || salah || !a}>{pending ? "Menyimpan..." : "Simpan pengembalian"}</Button></div>
      </form>
    </Card>
  );
}
