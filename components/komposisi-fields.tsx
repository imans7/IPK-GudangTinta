"use client";
import type { Dispatch, SetStateAction } from "react";
import type { KomposisiInput } from "@/lib/komposisi";
import { fmtNum } from "@/lib/utils";
import { Combobox } from "@/components/combobox";
import { Button, Input, Label, Select } from "@/components/ui";

export type KRow = KomposisiInput & { key: number };
let seq = 0;
export const barisBaru = (is_base = false): KRow => ({ key: ++seq, kode_komponen: null, nama_komponen: "", is_base, jumlah: null, satuan: "GRAM" });
export const dariData = (a: KomposisiInput[]): KRow[] => a.map((r) => ({ ...r, key: ++seq }));
export const tanpaKey = (rows: KRow[]): KomposisiInput[] => rows.map(({ key: _k, ...x }) => x);

/** Editor resep warna: base + komponen, tiap komponen dalam gram ATAU persen. Komponen bisa dipilih dari katalog atau diketik bebas. */
export function KomposisiFields({ rows, setRows, items }: { rows: KRow[]; setRows: Dispatch<SetStateAction<KRow[]>>; items: { kode: string; nama_barang: string }[] }) {
  const opsi = items.map((i) => ({ value: i.nama_barang, label: `${i.kode} - ${i.nama_barang}`, meta: i.kode }));
  const upd = (key: number, patch: Partial<KRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const persen = rows.filter((r) => r.satuan === "PERSEN" && r.jumlah != null).reduce((a, r) => a + (r.jumlah ?? 0), 0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Base = warna dasar (misal Putih); jumlah base boleh kosong artinya "sisanya". Tiap komponen bebas memakai gram atau persen.</p>
      {rows.map((r, idx) => (
        <div key={r.key} className="grid items-end gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-12">
          <div className="sm:col-span-7">
            <Label>{r.is_base ? "Warna dasar (base)" : `Komponen ${idx}`} (klik atau ketik)</Label>
            <Combobox free options={opsi} value={r.nama_komponen} placeholder="mis. Putih, Merah, Tc 1405 Red" onChange={(v, o) => upd(r.key, { nama_komponen: v, kode_komponen: o?.meta ?? null })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Takaran</Label>
            <Input type="number" min="0" step="any" value={r.jumlah ?? ""} onChange={(e) => upd(r.key, { jumlah: e.target.value === "" ? null : Number(e.target.value) })} placeholder={r.is_base ? "sisanya" : ""} />
          </div>
          <div className="sm:col-span-2">
            <Label>Satuan</Label>
            <Select value={r.satuan} onChange={(e) => upd(r.key, { satuan: e.target.value as "GRAM" | "PERSEN" })}>
              <option value="GRAM">gram</option>
              <option value="PERSEN">persen (%)</option>
            </Select>
          </div>
          <div className="sm:col-span-1"><Button type="button" variant="outline" aria-label="Hapus baris" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>Hapus</Button></div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {!rows.some((r) => r.is_base) && <Button type="button" variant="outline" onClick={() => setRows((rs) => [barisBaru(true), ...rs])}>Tambah warna dasar</Button>}
        <Button type="button" variant="outline" onClick={() => setRows((rs) => [...rs, barisBaru()])}>Tambah komponen</Button>
      </div>
      {persen > 0 && <p className="text-sm text-slate-600">Total persen terisi: {fmtNum(persen)}%</p>}
    </div>
  );
}
