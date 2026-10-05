"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/dialog";
import { SuggestInput } from "@/components/combobox";
import { Button, Input, Label } from "@/components/ui";
import { compressImage } from "@/lib/compress";

type Result = { ok: boolean; error?: string };
export type Field = { name: string; label: string; type?: string; step?: string; defaultValue?: string | number; readOnly?: boolean; required?: boolean; suggest?: string[]; hint?: string };

export function EditDialog({ title, fields, action, children }: { title: string; fields: Field[]; action: (fd: FormData) => Promise<Result>; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr("");
    start(async () => {
      for (const [k, v] of Array.from(fd.entries())) if (v instanceof File && v.size > 0) fd.set(k, await compressImage(v), "foto.jpg");
      const r = await action(fd);
      if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error ?? "Gagal menyimpan.");
    });
  }

  return (
    <>
      <Button variant="outline" className="px-3 py-1 text-xs" onClick={() => setOpen(true)}>Edit</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        <form onSubmit={onSubmit} className="space-y-3">
          {fields.map((f) => (
            <div key={f.name}>
              <Label htmlFor={`f-${f.name}`}>{f.label}</Label>
              {f.suggest && !f.readOnly ? (
                <SuggestInput id={`f-${f.name}`} name={f.name} suggestions={f.suggest} defaultValue={String(f.defaultValue ?? "")} required={f.required} />
              ) : (
                <Input id={`f-${f.name}`} name={f.name} type={f.type ?? "text"} step={f.step} defaultValue={f.defaultValue} readOnly={f.readOnly} required={f.required} className={f.readOnly ? "bg-slate-100" : ""} />
              )}
              {f.hint && <p className="mt-1 text-xs text-slate-500">{f.hint}</p>}
            </div>
          ))}
          {children}
          {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
          <div className="flex gap-2">
            <Button disabled={pending}>{pending ? "Menyimpan..." : "Simpan perubahan"}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function HapusButton({ judul, detail, action }: { judul: string; detail?: string; action: () => Promise<Result> }) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button variant="danger" className="px-3 py-1 text-xs" onClick={() => { setErr(""); setOpen(true); }}>Hapus</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Hapus data?">
        <p className="text-sm">Anda akan menghapus <b>{judul}</b>.{detail ? ` ${detail}` : ""} Tindakan ini tidak bisa dibatalkan.</p>
        {err && <p role="alert" className="mt-3 text-sm text-red-600">{err}</p>}
        <div className="mt-4 flex gap-2">
          <Button variant="danger" disabled={pending} onClick={() => start(async () => { const r = await action(); if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error ?? "Gagal menghapus."); })}>{pending ? "Menghapus..." : "Ya, hapus"}</Button>
          <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
        </div>
      </Dialog>
    </>
  );
}
