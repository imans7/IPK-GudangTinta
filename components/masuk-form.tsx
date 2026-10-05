"use client";
import { useRef, useState, useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { createMasuk, type BarisKaleng, type CanInfo } from "@/actions/masuk";
import { Combobox, SuggestInput } from "@/components/combobox";
import { KomposisiFields, tanpaKey, type KRow } from "@/components/komposisi-fields";
import { QrLabels } from "@/components/qr-labels";
import { RakPicker } from "@/components/rak-picker";
import { Button, Card, Input, Label } from "@/components/ui";
import { unitBerat } from "@/lib/berat";
import { compressImage } from "@/lib/compress";
import { fmtNum, todayInput } from "@/lib/utils";

type Barang = { kode: string; nama_barang: string; satuan: string; lacak_qr: boolean };
type Saran = { ket: string[]; satuan: string[]; batch: string[] };
type FormV = {
  tanggal: string; kode: string; keterangan: string; nama_baru: string; satuan_baru: string; lacak_baru: boolean;
  jumlah_nonqr: number; kaleng: BarisKaleng[];
};
const kosong = (): BarisKaleng => ({ jumlah: 1, berat: "" as unknown as number, batch: "", expired: "", lokasi: { x: "", y: "", z: "" } });

export function MasukForm({ barang, saran }: { barang: Barang[]; saran: Saran }) {
  const fotoRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [pesan, setPesan] = useState("");
  const [cans, setCans] = useState<CanInfo[]>([]);
  const [komp, setKomp] = useState<KRow[]>([]);
  const { register, control, handleSubmit, watch, reset, getValues } = useForm<FormV>({
    defaultValues: { tanggal: todayInput(), kode: "", keterangan: "Barang masuk", nama_baru: "", satuan_baru: "", lacak_baru: true, kaleng: [kosong()] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "kaleng" });

  const kode = watch("kode") ?? "";
  const kaleng = watch("kaleng") ?? [];
  const norm = kode.trim().toUpperCase();
  const ada = barang.find((b) => b.kode === norm);
  const baru = norm !== "" && !ada; // kode diketik manual dan belum ada di katalog
  const berkaleng = ada ? ada.lacak_qr : watch("lacak_baru");
  const satuan = ada ? ada.satuan : watch("satuan_baru");
  const unit = satuan ? unitBerat(satuan).label : "gram";
  const totalKaleng = kaleng.reduce((a, r) => a + (Number(r.jumlah) || 0), 0);
  const totalBerat = kaleng.reduce((a, r) => a + (Number(r.jumlah) || 0) * (Number(r.berat) || 0), 0);
  const options = barang.map((b) => ({ value: b.kode, label: `${b.kode} - ${b.nama_barang}`, hint: b.satuan }));
  const batchOpts = saran.batch.map((s) => ({ value: s, label: s }));

  const onSubmit = handleSubmit((v) => {
    setError(""); setPesan("");
    start(async () => {
      const fd = new FormData();
      const isi = komp.filter((r) => r.nama_komponen.trim()); // komposisi opsional
      fd.set("payload", JSON.stringify({ ...v, kode: v.kode.trim(), komposisi: tanpaKey(isi) }));
      const foto = fotoRef.current?.files?.[0];
      if (foto && foto.size > 0) fd.set("foto", await compressImage(foto), "foto.jpg");
      const r = await createMasuk(fd);
      if (!r.ok) return setError(r.error);
      setCans(r.cans); setPesan(r.pesan); setKomp([]);
      reset({ tanggal: v.tanggal, kode: "", keterangan: "Barang masuk", nama_baru: "", satuan_baru: "", lacak_baru: true, kaleng: [kosong()] });
      if (fotoRef.current) fotoRef.current.value = "";
    });
  });

  return (
    <div className="space-y-6">
      <Card className="no-print p-4">
        <h2 className="mb-4 font-semibold">Input Barang Masuk (multi-batch)</h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div><Label htmlFor="tanggal">Tanggal</Label><Input id="tanggal" type="date" required {...register("tanggal")} /></div>
            <div className="lg:col-span-2">
              <Label htmlFor="kode">Kode Barang (klik atau ketik)</Label>
              <Controller control={control} name="kode" render={({ field }) => (
                <Combobox free id="kode" options={options} value={field.value} onChange={field.onChange} placeholder="mis. EMPMRC3 atau kode baru" required />
              )} />
              {ada && <p className="mt-1 text-xs text-slate-500">{ada.nama_barang} ({ada.satuan}){ada.lacak_qr ? "" : " - tanpa QR"}</p>}
              {baru && <p className="mt-1 text-xs text-amber-700">Kode baru: isi nama dan satuan, barang dibuat otomatis.</p>}
            </div>
            {baru && (
              <>
                <div className="lg:col-span-2"><Label htmlFor="nama_baru">Nama barang baru</Label><Input id="nama_baru" required {...register("nama_baru")} /></div>
                <div>
                  <Label htmlFor="satuan_baru">Satuan</Label>
                  <Controller control={control} name="satuan_baru" render={({ field }) => <SuggestInputControlled id="satuan_baru" value={field.value} onChange={field.onChange} suggestions={saran.satuan} />} />
                </div>
                <label className="flex items-center gap-2 text-sm lg:col-span-3"><input type="checkbox" className="h-4 w-4" {...register("lacak_baru")} /> Barang berkaleng (pakai QR & FIFO)</label>
                <details className="rounded-md border border-slate-200 p-3 lg:col-span-3" open={komp.length > 0}>
                  <summary className="cursor-pointer text-sm font-medium">Komposisi warna <span className="font-normal text-slate-500">(opsional, boleh dikosongkan)</span></summary>
                  <div className="mt-3"><KomposisiFields rows={komp} setRows={setKomp} items={barang} /></div>
                </details>
              </>
            )}
            <div className="lg:col-span-3">
              <Label htmlFor="keterangan">Keterangan</Label>
              <Controller control={control} name="keterangan" render={({ field }) => <SuggestInputControlled id="keterangan" value={field.value} onChange={field.onChange} suggestions={saran.ket} />} />
            </div>
          </div>

          {berkaleng ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Satu baris = sekelompok kaleng dengan berat, batch, dan rak yang sama. Kaleng dengan berat berbeda dibuatkan baris sendiri.</p>
              {fields.map((f, i) => {
                const n = Number(kaleng[i]?.jumlah) || 0;
                return (
                  <div key={f.id} className="rounded-md border border-slate-200 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">Baris {i + 1}: {n} kaleng</span>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" className="px-3 py-1 text-xs" onClick={() => append(structuredClone(getValues(`kaleng.${i}`)))}>Duplikat</Button>
                        <Button type="button" variant="outline" className="px-3 py-1 text-xs" disabled={fields.length === 1} onClick={() => remove(i)}>Hapus baris</Button>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div><Label>Jumlah kaleng</Label><Input type="number" min={1} max={100} step={1} required {...register(`kaleng.${i}.jumlah`, { valueAsNumber: true })} /></div>
                      <div><Label>Berat per kaleng ({unit})</Label><Input type="number" min={0} step="any" required {...register(`kaleng.${i}.berat`, { valueAsNumber: true })} /></div>
                      <div>
                        <Label>No. batch</Label>
                        <Controller control={control} name={`kaleng.${i}.batch`} render={({ field }) => <Combobox free options={batchOpts} value={field.value} onChange={field.onChange} required />} />
                      </div>
                      <div><Label>Kedaluwarsa</Label><Input type="date" required {...register(`kaleng.${i}.expired`)} /></div>
                    </div>
                    <div className="mt-3">
                      <Controller control={control} name={`kaleng.${i}.lokasi`} render={({ field }) => <RakPicker value={field.value} onChange={field.onChange} />} />
                    </div>
                  </div>
                );
              })}
              <Button type="button" variant="outline" onClick={() => append(structuredClone(getValues(`kaleng.${fields.length - 1}`) ?? kosong()))}>Tambah baris kaleng</Button>
              <p className="rounded-md bg-slate-50 p-3 text-sm" aria-live="polite">Total: <b>{fmtNum(totalKaleng)} kaleng</b>, <b>{fmtNum(totalBerat)} {unit}</b>{unit === "gram" && totalBerat >= 1000 ? ` (${fmtNum(totalBerat / 1000)} kg)` : ""}</p>
            </div>
          ) : (
            <div className="max-w-xs"><Label htmlFor="jumlah_nonqr">Jumlah ({satuan || "satuan"})</Label><Input id="jumlah_nonqr" type="number" min={0} step="any" required {...register("jumlah_nonqr", { valueAsNumber: true })} /></div>
          )}

          <div>
            <Label htmlFor="foto">Foto nota / fisik barang (opsional)</Label>
            <input id="foto" ref={fotoRef} type="file" accept="image/*" capture="environment" className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200" />
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {pesan && <p role="status" className="text-sm text-green-700">{pesan}</p>}
          <Button disabled={pending}>{pending ? "Menyimpan..." : berkaleng ? "Simpan & buat label QR" : "Simpan"}</Button>
        </form>
      </Card>
      {cans.length > 0 && <QrLabels cans={cans} onClose={() => setCans([])} />}
    </div>
  );
}

// SuggestInput versi terkontrol (untuk react-hook-form)
function SuggestInputControlled({ id, value, onChange, suggestions }: { id: string; value: string; onChange: (v: string) => void; suggestions: string[] }) {
  return <Combobox free id={id} options={suggestions.map((s) => ({ value: s, label: s }))} value={value} onChange={onChange} />;
}
