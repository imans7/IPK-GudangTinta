"use client";
import { useEffect, useRef } from "react";

// Modal memakai elemen <dialog> bawaan browser: fokus terkunci, Esc menutup, aksesibel.
export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={`w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-lg"} rounded-lg bg-white p-0 shadow-xl backdrop:bg-black/60`}
    >
      {open && (
        <div className="max-h-[85vh] overflow-y-auto p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Tutup" className="rounded px-2 text-xl leading-none text-slate-500 hover:bg-slate-100">×</button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}