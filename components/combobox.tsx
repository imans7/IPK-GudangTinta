"use client";
import { useId, useMemo, useState } from "react";
import { Input } from "@/components/ui";
import { cn } from "@/lib/utils";

export type Opt = { value: string; label: string; hint?: string; meta?: string };

/**
 * Combobox yang bisa diklik (pilih dari data database) DAN diketik manual.
 * - free=false : ketik untuk mencari, nilai harus salah satu pilihan (mis. kode tinta, rak X/Y/Z).
 *                Mengetik teks yang persis cocok lalu Tab/Enter otomatis memilihnya.
 * - free=true  : nilai = teks yang diketik; pilihan hanya saran (mis. No. SPK, keterangan, satuan).
 * `name` dikirim lewat FormData.
 */
export function Combobox({ options, value, onChange, free = false, name, id, placeholder = "Ketik untuk mencari...", required, disabled }: {
  options: Opt[]; value: string; onChange: (v: string, o?: Opt) => void; free?: boolean; name?: string; id?: string;
  placeholder?: string; required?: boolean; disabled?: boolean;
}) {
  const uid = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const sel = options.find((o) => o.value === value);
  const q = (free ? value : text).trim().toLowerCase();
  const list = useMemo(
    () => (q ? options.filter((o) => `${o.label} ${o.value} ${o.hint ?? ""}`.toLowerCase().includes(q)) : options).slice(0, 50),
    [q, options],
  );

  function pick(o: Opt) { onChange(o.value, o); setText(""); setOpen(false); }
  function commit() {
    setOpen(false);
    if (!free && text.trim()) {
      const t = text.trim().toLowerCase();
      const exact = options.find((o) => o.value.toLowerCase() === t || o.label.toLowerCase() === t) ?? (list.length === 1 ? list[0] : undefined);
      if (exact) onChange(exact.value, exact);
    }
    setText("");
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, list.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && open) { e.preventDefault(); if (list[hi]) pick(list[hi]); else commit(); }
    else if (e.key === "Escape") { setOpen(false); setText(""); }
  }

  return (
    <div className="relative">
      {!free && name && <input type="hidden" name={name} value={value} />}
      <Input
        id={id}
        name={free ? name : undefined}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${uid}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && list[hi] ? `${uid}-o${hi}` : undefined}
        autoComplete="off"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={free ? value : open ? text : sel?.label ?? ""}
        onFocus={() => { setOpen(true); setHi(0); }}
        onChange={(e) => { setHi(0); setOpen(true); if (free) onChange(e.target.value); else setText(e.target.value); }}
        onBlur={commit}
        onKeyDown={onKey}
      />
      {open && (
        <ul id={`${uid}-list`} role="listbox" className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {list.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">{free ? "Tidak ada saran, teks Anda akan dipakai apa adanya." : "Tidak ditemukan."}</li>}
          {list.map((o, i) => (
            <li
              key={o.value}
              id={`${uid}-o${i}`}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              onMouseEnter={() => setHi(i)}
              className={cn("cursor-pointer px-3 py-2 text-sm", i === hi && "bg-blue-50")}
            >
              <div>{o.label}</div>
              {o.hint && <div className="text-xs text-slate-500">{o.hint}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Input teks bebas dengan saran dari data yang pernah diisi. */
export function SuggestInput({ name, id, suggestions, defaultValue = "", placeholder, required }: { name: string; id?: string; suggestions: string[]; defaultValue?: string; placeholder?: string; required?: boolean }) {
  const [v, setV] = useState(defaultValue);
  const options = useMemo(() => suggestions.map((s) => ({ value: s, label: s })), [suggestions]);
  return <Combobox free name={name} id={id} options={options} value={v} onChange={setV} placeholder={placeholder} required={required} />;
}
