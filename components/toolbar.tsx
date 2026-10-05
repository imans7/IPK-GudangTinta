import { MonthPicker } from "@/components/month-picker";
import { SearchBox } from "@/components/search-box";

/** Bulan + kotak pencarian + ringkasan total berat hasil filter. Dipakai di semua halaman bertabel. */
export function Toolbar({ periode, q, placeholder, ringkasan }: { periode: string; q: string; placeholder: string; ringkasan?: string }) {
  return (
    <div className="no-print space-y-3">
      <MonthPicker periode={periode} q={q} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchBox placeholder={placeholder} />
        {ringkasan && <p className="text-sm text-slate-600">{ringkasan}</p>}
      </div>
    </div>
  );
}
