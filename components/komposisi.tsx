"use client";
import { useMemo, useState, useTransition } from "react";
import { hapusKomposisi, saveKomposisi } from "@/actions/komposisi";
import type { KomposisiInput } from "@/lib/komposisi";
import { KomposisiFields, barisBaru, dariData, tanpaKey, type KRow } from "@/components/komposisi-fields";
import { fmtNum } from "@/lib/utils";
import { Button, Card, Input, Label, Table, TBody, TD, TH, THead, TR } from "@/components/ui";

type Item = { kode: string; nama_barang: string };

export function KomposisiPanel({ kode, nama, items, initial, canEdit }: { kode: string; nama: string; items: Item[]; initial: KomposisiInput[]; canEdit: boolean }) {
  const [rows, setRows] = useState<KRow[]>(dariData(initial));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [pending, start] = useTransition();
  const [target, setTarget] = useState("");

  const base = rows.find((r) => r.is_base);
  const komp = rows.filter((r) => !r.is_base);
  const persenTotal = rows.filter((r) => r.satuan === "PERSEN" && r.jumlah != null).reduce((a, r) => a + (r.jumlah ?? 0), 0);
  const semuaPersen = rows.length > 0 && rows.every((r) => r.satuan === "PERSEN");
  const sisaBase = Math.max(0, 100 - persenTotal);
  const T = Number(target);


  function simpan() {
    setError(""); setSaved("");
    start(async () => {
      const r = await saveKomposisi(kode, tanpaKey(rows));
      if (r.ok) { setSaved("Komposisi tersimpan."); setEditing(false); } else setError(r.error ?? "Gagal menyimpan.");
    });
  }

  const hasil = useMemo(() => {
    if (!semuaPersen || !(T > 0)) return null;
    return rows.map((r) => ({ nama: r.nama_komponen, is_base: r.is_base, gram: ((r.jumlah ?? sisaBase) / 100) * T }));
  }, [rows, semuaPersen, T, sisaBase]);

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{kode} - {nama}</h2>
          <p className="text-sm text-slate-500">{rows.length ? "Resep campuran tinta" : "Belum ada komposisi. Biarkan kosong bila tinta ini langsung dari pabrik."}</p>
        </div>
        {canEdit && !editing && <Button variant="outline" onClick={() => { setEditing(true); if (!rows.length) setRows([barisBaru(true), barisBaru()]); }}>{rows.length ? "Ubah komposisi" : "Tambah komposisi"}</Button>}
      </div>

      {!editing && rows.length > 0 && (
        <>
          <Table>
            <THead><TR><TH>PERAN</TH><TH>KOMPONEN</TH><TH className="text-right">JUMLAH</TH></TR></THead>
            <TBody>
              {[...rows].sort((a, b) => Number(b.is_base) - Number(a.is_base)).map((r) => (
                <TR key={r.key}>
                  <TD>{r.is_base ? "Base" : "Campuran"}</TD>
                  <TD>{r.nama_komponen}{r.kode_komponen && <span className="ml-2 font-mono text-xs text-slate-500">{r.kode_komponen}</span>}</TD>
                  <TD className="text-right tabular-nums">
                    {r.jumlah == null ? (semuaPersen || persenTotal > 0 ? `sisanya (${fmtNum(sisaBase)}%)` : "sisanya") : `${fmtNum(r.jumlah)} ${r.satuan === "GRAM" ? "gram" : "%"}`}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {base && komp.length > 0 && <p className="mt-3 text-sm text-slate-600">Ringkas: base <b>{base.nama_komponen}</b> dicampur {komp.map((k) => `${k.nama_komponen} ${fmtNum(k.jumlah ?? 0)}${k.satuan === "GRAM" ? " gram" : "%"}`).join(", ")}.</p>}

          {semuaPersen && (
            <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
              <Label htmlFor="target">Hitung kebutuhan untuk total (gram)</Label>
              <Input id="target" type="number" min="0" step="any" value={target} onChange={(e) => setTarget(e.target.value)} className="max-w-xs" placeholder="contoh: 2000" />
              {hasil && <ul className="mt-2 text-sm">{hasil.map((h, i) => <li key={i}>{h.nama}: <b>{fmtNum(h.gram)} gram</b></li>)}</ul>}
            </div>
          )}
        </>
      )}

      {editing && (
        <div className="space-y-3">
          <KomposisiFields rows={rows} setRows={setRows} items={items} />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={simpan} disabled={pending}>{pending ? "Menyimpan..." : "Simpan komposisi"}</Button>
            <Button variant="outline" onClick={() => { setEditing(false); setError(""); setRows(dariData(initial)); }}>Batal</Button>
            {initial.length > 0 && <Button variant="danger" disabled={pending} onClick={() => start(async () => { const r = await hapusKomposisi(kode); if (r.ok) { setRows([]); setEditing(false); } })}>Hapus komposisi</Button>}
          </div>
        </div>
      )}
      {saved && <p role="status" className="mt-3 text-sm text-green-700">{saved}</p>}
    </Card>
  );
}
