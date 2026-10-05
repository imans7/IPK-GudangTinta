"use client";
import { useEffect, useState } from "react";
import { getKomposisi, type KomposisiRow } from "@/actions/keluar";
import { Dialog } from "@/components/dialog";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui";
import { fmtNum } from "@/lib/utils";

export function KomposisiModal({ kode, nama, open, onClose }: { kode: string; nama: string; open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<KomposisiRow[] | null>(null);
  useEffect(() => {
    if (!open) return;
    setRows(null);
    getKomposisi(kode).then(setRows);
  }, [open, kode]);

  const persen = (rows ?? []).filter((r) => r.satuan === "PERSEN" && r.jumlah != null).reduce((a, r) => a + (r.jumlah ?? 0), 0);
  return (
    <Dialog open={open} onClose={onClose} title={`Komposisi ${nama}`} wide>
      {rows === null && <p className="text-sm text-slate-500">Memuat resep...</p>}
      {rows && rows.length === 0 && <p className="text-sm text-slate-600">Belum ada komposisi untuk tinta ini. Tinta ini dipakai langsung dari kaleng pabrik.</p>}
      {rows && rows.length > 0 && (
        <Table>
          <THead><TR><TH>PERAN</TH><TH>KOMPONEN</TH><TH className="text-right">JUMLAH</TH></TR></THead>
          <TBody>
            {rows.map((r, i) => (
              <TR key={i}>
                <TD>{r.is_base ? "Base" : "Campuran"}</TD>
                <TD>{r.nama_komponen}{r.kode_komponen && <span className="ml-2 font-mono text-xs text-slate-500">{r.kode_komponen}</span>}</TD>
                <TD className="text-right tabular-nums">{r.jumlah == null ? `sisanya${persen > 0 ? ` (${fmtNum(Math.max(0, 100 - persen))}%)` : ""}` : `${fmtNum(r.jumlah)} ${r.satuan === "GRAM" ? "gram" : "%"}`}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Dialog>
  );
}
