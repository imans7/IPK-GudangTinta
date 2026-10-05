"use client";
import { Combobox } from "@/components/combobox";
import { Label } from "@/components/ui";
import { RAK_X, RAK_Y, RAK_Z, formatLokasi } from "@/lib/rak";

export type Lokasi = { x: string; y: string; z: string };
const optX = RAK_X.map((v) => ({ value: v, label: v }));
const optY = RAK_Y.map((v) => ({ value: v, label: v }));
const optZ = RAK_Z.map((v) => ({ value: String(v), label: String(v) }));

/** Lokasi rak: tiga dropdown berdampingan (bisa diketik juga). Hasil gabungan otomatis, mis. "1A-II-4". */
export function RakPicker({ value, onChange }: { value: Lokasi; onChange: (l: Lokasi) => void }) {
  const lengkap = value.x && value.y && value.z;
  return (
    <fieldset className="rounded-md border border-slate-200 p-3">
      <legend className="px-1 text-sm font-medium text-slate-700">Lokasi rak</legend>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Kolom (X)</Label><Combobox options={optX} value={value.x} onChange={(x) => onChange({ ...value, x })} placeholder="1A-3E" required /></div>
        <div><Label>Tingkat (Y)</Label><Combobox options={optY} value={value.y} onChange={(y) => onChange({ ...value, y })} placeholder="I-IV" required /></div>
        <div><Label>Kedalaman (Z)</Label><Combobox options={optZ} value={value.z} onChange={(z) => onChange({ ...value, z })} placeholder="1-7" required /></div>
      </div>
      <p className="mt-2 text-sm text-slate-600" aria-live="polite">Lokasi: <b className="font-mono">{lengkap ? formatLokasi(value.x, value.y, Number(value.z)) : "belum lengkap"}</b></p>
    </fieldset>
  );
}
