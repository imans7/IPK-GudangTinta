import { Button, Input } from "@/components/ui";
import { GUDANG, labelPeriode } from "@/lib/periode";

// Form GET biasa (tanpa JavaScript): ?bulan=2026-08, kata kunci pencarian ikut terbawa.
export function MonthPicker({ periode, q }: { periode: string; q?: string }) {
  return (
    <div className="no-print flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm text-slate-500">BULAN</p>
        <p className="text-lg font-semibold">{labelPeriode(periode)} <span className="text-sm font-normal text-slate-500">| GUDANG {GUDANG}</span></p>
      </div>
      <form method="get" className="flex items-end gap-2">
        {q ? <input type="hidden" name="q" value={q} /> : null}
        <Input type="month" name="bulan" defaultValue={periode} aria-label="Pilih bulan" className="w-44" />
        <Button variant="outline">Tampilkan</Button>
      </form>
    </div>
  );
}
