"use client";
import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export function FotoKaleng({ url, alt, className }: { url?: string | null; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img src={url} alt={alt} className={cn("aspect-square w-full rounded-md border border-slate-200 object-cover", className)} />;
  return <div className={cn("flex aspect-square w-full items-center justify-center rounded-md border border-dashed border-slate-300 text-sm text-slate-400", className)}>Belum ada foto</div>;
}

export function FotoButton({ url, judul }: { url?: string | null; judul: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className="px-3 py-1 text-xs" disabled={!url} title={url ? "Lihat foto" : "Belum ada foto"} onClick={() => setOpen(true)}>Foto</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={judul}><FotoKaleng url={url} alt={judul} /></Dialog>
    </>
  );
}
