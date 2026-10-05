"use client";
import { useState } from "react";
import { Combobox, type Opt } from "@/components/combobox";
import { Button, Label, Select } from "@/components/ui";

/** Form pencarian mundur: masukkan bahan campuran (klik atau ketik), sistem mencari tinta yang resepnya cocok. */
export function CariBahan({ opsi, awal, modeAwal }: { opsi: Opt[]; awal: string[]; modeAwal: string }) {
  const [chips, setChips] = useState<string[]>(awal);
  const [teks, setTeks] = useState("");

  const tambah = () => {
    const t = teks.trim().slice(0, 60);
    if (!t) return;
    setChips((c) => (c.length >= 8 || c.some((x) => x.toLowerCase() === t.toLowerCase()) ? c : [...c, t]));
    setTeks("");
  };
  const pending = teks.trim();
  const adaBahan = chips.length > 0 || pending !== "";

  return (
    <form
      method="get"
      className="space-y-3"
      onSubmit={(e) => { if (!adaBahan) e.preventDefault(); }}
      // Enter di kotak bahan = menambah bahan (bukan langsung mencari). Enter saat daftar pilihan terbuka sudah ditangani Combobox.
      onKeyDown={(e) => {
        if (e.key !== "Enter" || !pending || (e.target as HTMLElement).id !== "bahan-input") return;
        // Ada saran yang cocok -> Combobox yang memilihnya. Tidak ada saran -> teks yang diketik ditambahkan sebagai bahan.
        const q = pending.toLowerCase();
        const adaSaran = opsi.some((o) => `${o.label} ${o.value}`.toLowerCase().includes(q));
        if (!e.defaultPrevented || !adaSaran) { e.preventDefault(); tambah(); }
      }}
    >
      {chips.map((c) => <input key={c} type="hidden" name="bahan" value={c} />)}
      {pending && !chips.some((c) => c.toLowerCase() === pending.toLowerCase()) && <input type="hidden" name="bahan" value={pending} />}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <Label htmlFor="bahan-input">Bahan campuran (klik atau ketik)</Label>
          <Combobox free id="bahan-input" options={opsi} value={teks} onChange={setTeks} placeholder="mis. Ruben Red, Magenta, 1405" />
        </div>
        <div className="flex items-end"><Button type="button" variant="outline" disabled={!pending} onClick={tambah}>Tambah bahan</Button></div>
      </div>

      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Bahan yang dicari">
          {chips.map((c) => (
            <li key={c} className="inline-flex items-center gap-1 rounded-full bg-blue-100 py-1 pl-3 pr-1 text-sm text-blue-800">
              {c}
              <button type="button" aria-label={`Hapus bahan ${c}`} onClick={() => setChips((x) => x.filter((y) => y !== c))} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-blue-200 dark:hover:bg-blue-900">×</button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64">
          <Label htmlFor="mode">Cara mencocokkan</Label>
          <Select id="mode" name="mode" defaultValue={modeAwal}>
            <option value="semua">Mengandung semua bahan (boleh ada bahan lain)</option>
            <option value="persis">Hanya bahan ini (persis sama)</option>
            <option value="salah">Salah satu bahan</option>
          </Select>
        </div>
        <Button disabled={!adaBahan}>Cari tinta</Button>
        {chips.length > 0 && <Button type="button" variant="outline" onClick={() => setChips([])}>Kosongkan</Button>}
      </div>
    </form>
  );
}
