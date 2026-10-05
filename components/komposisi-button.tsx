"use client";
import { useState } from "react";
import { KomposisiModal } from "@/components/komposisi-modal";
import { Button } from "@/components/ui";

export function KomposisiButton({ kode, nama }: { kode: string; nama: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className="px-3 py-1 text-xs" onClick={() => setOpen(true)}>Komposisi</Button>
      <KomposisiModal kode={kode} nama={nama} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
