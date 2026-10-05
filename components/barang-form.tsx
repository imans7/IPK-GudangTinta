"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBarang } from "@/actions/katalog";
import { sinkronkanBerat } from "@/actions/kelola";
import { SuggestInput } from "@/components/combobox";
import { KomposisiFields, tanpaKey, type KRow } from "@/components/komposisi-fields";
import { compressImage } from "@/lib/compress";
import { Button, Card, Input, Label } from "@/components/ui";

type Item = { kode: string; nama_barang: string };

export function BarangForm({ periode, satuan, items, isAdmin }: { periode: string; satuan: string[]; items: Item[]; isAdmin: boolean }) {
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [komp, setKomp] = useState<KRow[]>([]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setInfo("");
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const g = fd.get("gambar");
      if (g instanceof File && g.size > 0) fd.set("gambar", await compressImage(g), "gambar.jpg");
      const isi = komp.filter((r) => r.nama_komponen.trim()); // komposisi opsional: baris kosong diabaikan
      if (isi.length > 0) fd.set("komposisi", JSON.stringify(tanpaKey(isi)));
      const r = await createBarang(fd);
      if (r.ok) { ref.current?.reset(); setKomp([]); setInfo(r.pesan ?? "Tersimpan."); router.refresh(); } else setError(r.error ?? "Gagal.");
    });
  }
  return (
    <Card className="no-print p-4">
      <details>
        <summary className="cursor-pointer font-semibold">Tambah jenis tinta / barang baru</summary>
        <form ref={ref} onSubmit={onSubmit} className="mt-4 space-y-4">
          <input type="hidden" name="periode" value={periode} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><Label htmlFor="kode">Kode</Label><Input id="kode" name="kode" placeholder="EMPMRC1" required /></div>
            <div className="lg:col-span-2"><Label htmlFor="nama_barang">Nama barang</Label><Input id="nama_barang" name="nama_barang" required /></div>
            <div><Label htmlFor="satuan">Satuan (klik atau ketik)</Label><SuggestInput id="satuan" name="satuan" suggestions={satuan} placeholder="kg / gram" required /></div>
            {isAdmin && <div><Label htmlFor="stock_awal_kaleng">Stock awal (kaleng)</Label><Input id="stock_awal_kaleng" name="stock_awal_kaleng" type="number" min="0" step="any" defaultValue={0} /></div>}
            {isAdmin && <div><Label htmlFor="stock_awal_berat">Stock awal (berat, gram)</Label><Input id="stock_awal_berat" name="stock_awal_berat" type="number" min="0" step="any" defaultValue={0} /></div>}
            <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="lacak_qr" defaultChecked className="h-4 w-4" /> Berkaleng (QR & FIFO)</label>
            <div><Label htmlFor="gambar">Foto tinta (opsional)</Label><input id="gambar" name="gambar" type="file" accept="image/*" capture="environment" className="block w-full text-sm" /></div>
          </div>

          <details className="rounded-md border border-slate-200 p-3" open={komp.length > 0}>
            <summary className="cursor-pointer text-sm font-medium">Komposisi warna <span className="font-normal text-slate-500">(opsional, boleh dikosongkan)</span></summary>
            <div className="mt-3">
              <KomposisiFields rows={komp} setRows={setKomp} items={items} />
              {komp.length === 0 && <p className="mt-2 text-sm text-slate-500">Belum ada komposisi. Tinta tetap bisa disimpan tanpa komposisi dan diisi nanti di menu Komposisi Tinta.</p>}
            </div>
          </details>

          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {info && <p role="status" className="text-sm text-green-700">{info}</p>}
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending}>{pending ? "Menyimpan..." : "Simpan tinta baru"}</Button>
            {isAdmin && (
              <Button type="button" variant="outline" disabled={pending} onClick={() => start(async () => { const r = await sinkronkanBerat(); setInfo(r.ok ? `Total berat dihitung ulang untuk ${r.n} barang.` : r.error ?? ""); router.refresh(); })}>Hitung ulang total berat</Button>
            )}
          </div>
        </form>
      </details>
    </Card>
  );
}
