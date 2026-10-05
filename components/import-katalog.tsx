"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { imporKatalog, type HasilImpor } from "@/actions/import-katalog";
import { Button, Card, Label, Table, TBody, TD, TH, THead, TR } from "@/components/ui";
import { fmtNum } from "@/lib/utils";

const warna = { BARU: "bg-green-100 text-green-800", PERBARUI: "bg-blue-100 text-blue-800", LEWATI: "bg-slate-100 text-slate-600", ERROR: "bg-red-100 text-red-800" } as const;

export function ImportKatalog({ periode }: { periode: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [perbarui, setPerbarui] = useState(false);
  const [hasil, setHasil] = useState<HasilImpor | null>(null);
  const [pending, start] = useTransition();

  function kirim(mode: "pratinjau" | "impor") {
    if (!file) return setHasil({ ok: false, error: "Pilih file Excel (.xlsx) dulu." });
    const fd = new FormData();
    fd.set("file", file); fd.set("mode", mode); fd.set("periode", periode);
    if (perbarui) fd.set("perbarui", "on");
    start(async () => {
      const r = await imporKatalog(fd);
      setHasil(r);
      if (r.ok && mode === "impor") router.refresh();
    });
  }
  const siap = hasil?.ok && hasil.mode === "pratinjau" && hasil.ringkas.error === 0 && hasil.ringkas.baru + hasil.ringkas.perbarui > 0;

  return (
    <Card className="no-print p-4">
      <details>
        <summary className="cursor-pointer font-semibold">Import katalog dari Excel</summary>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-600">
            Bisa memakai file Excel pabrik (sheet KATALOG: KODE, NAMA BARANG, SATUAN, STOCK AWAL) atau template. STOCK AWAL dibaca dalam satuan barang (mis. kg) dan diubah ke gram otomatis.
            Stock awal diisi untuk bulan yang sedang dipilih. <a href="/api/template-katalog" download className="font-medium text-blue-700 underline">Unduh template</a>
          </p>
          <div>
            <Label htmlFor="file-katalog">File Excel (.xlsx)</Label>
            <input id="file-katalog" type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setHasil(null); }} className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200" />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={perbarui} onChange={(e) => { setPerbarui(e.target.checked); setHasil(null); }} className="h-4 w-4" /> Perbarui juga barang yang sudah ada (nama, satuan, QR, stock awal bulan ini)</label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={pending || !file} onClick={() => kirim("pratinjau")}>{pending ? "Memproses..." : "Pratinjau"}</Button>
            <Button type="button" disabled={pending || !siap} onClick={() => kirim("impor")}>Impor sekarang</Button>
          </div>

          {hasil && !hasil.ok && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{hasil.error}</p>}
          {hasil?.ok && (
            <div className="space-y-3" aria-live="polite">
              <p className={`rounded-md p-3 text-sm ${hasil.mode === "impor" ? "border border-green-200 bg-green-50 text-green-800" : "bg-slate-50"}`}>
                {hasil.mode === "impor" ? "Impor selesai. " : `Pratinjau sheet "${hasil.sheet}": `}
                <b>{hasil.ringkas.baru}</b> baru, <b>{hasil.ringkas.perbarui}</b> diperbarui, <b>{hasil.ringkas.lewati}</b> dilewati, <b className={hasil.ringkas.error ? "text-red-700" : ""}>{hasil.ringkas.error}</b> bermasalah.
                {hasil.mode === "pratinjau" && hasil.ringkas.error > 0 && " Perbaiki baris bermasalah di Excel, lalu pratinjau ulang."}
              </p>
              <Table>
                <THead><TR><TH>BARIS</TH><TH>KODE</TH><TH>NAMA BARANG</TH><TH>SATUAN</TH><TH className="text-right">STOCK AWAL (KALENG)</TH><TH className="text-right">STOCK AWAL (BERAT)</TH><TH>QR</TH><TH>STATUS</TH></TR></THead>
                <TBody>
                  {hasil.rows.slice(0, 300).map((r) => (
                    <TR key={r.baris}>
                      <TD>{r.baris}</TD><TD className="font-mono">{r.kode}</TD><TD>{r.nama}</TD><TD>{r.satuan}</TD>
                      <TD className="text-right tabular-nums">{r.stock_kaleng == null ? "-" : fmtNum(r.stock_kaleng)}</TD>
                      <TD className="text-right tabular-nums">{r.stock_berat == null ? "-" : fmtNum(r.stock_berat)}</TD>
                      <TD>{r.lacak_qr ? "Ya" : "Tidak"}</TD>
                      <TD><span className={`rounded px-1.5 py-0.5 text-xs ${warna[r.aksi]}`}>{r.aksi}</span>{r.pesan && <span className="ml-2 text-xs text-slate-500">{r.pesan}</span>}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
              {hasil.rows.length > 300 && <p className="text-xs text-slate-500">Menampilkan 300 baris pertama dari {hasil.rows.length}. Semua baris tetap diproses.</p>}
            </div>
          )}
        </div>
      </details>
    </Card>
  );
}
