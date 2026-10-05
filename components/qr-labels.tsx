"use client";
import { QRCodeSVG } from "qrcode.react";
import type { CanInfo } from "@/actions/masuk";
import { Dialog } from "@/components/dialog";
import { Button } from "@/components/ui";
import { fmtNum } from "@/lib/utils";

function Label({ c }: { c: CanInfo }) {
  return (
    <div className="label">
      <QRCodeSVG value={c.id_kaleng} size={96} style={{ width: "22mm", height: "22mm", flex: "none" }} />
      <div style={{ minWidth: 0 }}>
        <b>{c.kode}</b>
        <div>{c.nama}</div>
        <div>Batch {c.batch}</div>
        <div>Exp {c.exp}</div>
        <div>{fmtNum(c.berat)} {c.satuan === "kg" ? "g" : c.satuan} | Rak {c.lokasi}</div>
        <div style={{ fontFamily: "monospace", fontSize: "5.5pt" }}>{c.id_kaleng.slice(0, 8).toUpperCase()}</div>
      </div>
    </div>
  );
}

/** Modal berisi semua QR + tombol cetak. Cetak = satu label per halaman (stiker thermal 50x30 mm). */
export function QrLabels({ cans, onClose }: { cans: CanInfo[]; onClose: () => void }) {
  return (
    <>
      <Dialog open onClose={onClose} title={`Label QR (${cans.length} kaleng)`} wide>
        <div className="mb-3 flex flex-wrap gap-2">
          <Button onClick={() => window.print()}>Print Semua Label</Button>
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </div>
        <p className="mb-3 text-sm text-slate-500">Satu label per halaman, ukuran 50 x 30 mm. Pilih kertas thermal yang sesuai di dialog cetak.</p>
        <div className="grid gap-3 sm:grid-cols-2">{cans.map((c) => <Label key={c.id_kaleng} c={c} />)}</div>
      </Dialog>
      <div className="print-labels" aria-hidden="true">{cans.map((c) => <Label key={c.id_kaleng} c={c} />)}</div>
    </>
  );
}
