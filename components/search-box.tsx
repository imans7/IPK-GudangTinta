"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui";

/** Pencarian real-time lewat URL (?q=...). Filter dijalankan di server; bulan & parameter lain ikut terjaga. */
export function SearchBox({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [v, setV] = useState(sp.get("q") ?? "");
  const [pending, start] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => {
      const p = new URLSearchParams(sp.toString());
      const s = v.trim();
      if (s) p.set("q", s); else p.delete("q");
      const qs = p.toString();
      start(() => router.replace(qs ? `${path}?${qs}` : path, { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);

  return (
    <div className="relative w-full max-w-md">
      <Input type="search" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} aria-label="Cari data tabel" />
      {pending && <span className="absolute right-3 top-2.5 text-xs text-slate-400" aria-live="polite">mencari...</span>}
    </div>
  );
}
