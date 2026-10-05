import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getKatalogRows } from "@/lib/katalog";
import { resolvePeriode } from "@/lib/periode";
import { getSaran } from "@/lib/saran";
import { fmtBerat, sumKg } from "@/lib/berat";
import { fmtNum } from "@/lib/utils";
import { deleteBarang, updateBarang } from "@/actions/kelola";
import { AdminOnly } from "@/components/admin-only";
import { BarangForm } from "@/components/barang-form";
import { ImportKatalog } from "@/components/import-katalog";
import { FotoButton } from "@/components/foto";
import { KomposisiButton } from "@/components/komposisi-button";
import { EditDialog, HapusButton } from "@/components/row-actions";
import { Toolbar } from "@/components/toolbar";
import { Card, Empty, Label, Table, TBody, TD, TH, THead, TR } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: { bulan?: string; q?: string } }) {
  const user = await requireUser();
  const periode = await resolvePeriode(searchParams.bulan);
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const [rows, saran, semua] = await Promise.all([getKatalogRows(periode, q), getSaran(), prisma.masterKatalog.findMany({ orderBy: { kode: "asc" }, select: { kode: true, nama_barang: true } })]);
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const kg = sumKg(rows.map((r) => ({ satuan: r.satuan, v: r.total_berat })));
  const kpi = [
    { label: "Total Saldo Akhir (kaleng)", value: fmtNum(sum((r) => r.saldo_kaleng)) },
    { label: "Total Masuk (kaleng)", value: fmtNum(sum((r) => r.masuk)) },
    { label: "Total Keluar (kaleng)", value: fmtNum(sum((r) => r.keluar)) },
    { label: "Total Berat Tinta", value: `${fmtNum(kg)} kg` },
  ];
  return (
    <>
      <Toolbar periode={periode} q={q} placeholder="Cari kode atau nama barang..." ringkasan={rows.length ? `${rows.length} barang, total berat ${fmtNum(kg)} kg` : undefined} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpi.map((k) => (
          <Card key={k.label} className="p-4"><p className="text-sm text-slate-500">{k.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</p></Card>
        ))}
      </div>
      <BarangForm periode={periode} satuan={saran.satuan} items={semua} isAdmin={user.role === "ADMIN"} />
      <AdminOnly><ImportKatalog periode={periode} /></AdminOnly>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-4">
          <h2 className="font-semibold">STOCK OPNAME BAHAN PEMBANTU (KATALOG)</h2>
          <a href={`/api/export?bulan=${periode}`} download className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Export Excel</a>
        </div>
        <Table>
          <THead><TR><TH>NO</TH><TH>KODE</TH><TH>NAMA BARANG</TH><TH>SATUAN</TH><TH className="text-right">STOCK AWAL</TH><TH className="text-right">MASUK</TH><TH className="text-right">KELUAR</TH><TH className="text-right">SALDO AKHIR (KALENG)</TH><TH className="text-right">TOTAL BERAT (GRAM/KG)</TH><TH>AKSI</TH></TR></THead>
          <TBody>
            {rows.length === 0 && <Empty cols={10} text={q ? `Tidak ada barang untuk "${q}".` : "Belum ada barang. Jalankan seed atau tambahkan barang."} />}
            {rows.map((r) => (
              <TR key={r.kode}>
                <TD>{r.no}</TD><TD className="font-mono">{r.kode}</TD><TD>{r.nama_barang}</TD><TD>{r.satuan}</TD>
                <TD className="text-right tabular-nums">{r.lacak_qr ? fmtNum(r.stock_awal_kaleng) : "-"}</TD>
                <TD className="text-right tabular-nums">{r.lacak_qr ? fmtNum(r.masuk) : "-"}</TD>
                <TD className="text-right tabular-nums">{r.lacak_qr ? fmtNum(r.keluar) : "-"}</TD>
                <TD className="text-right font-semibold tabular-nums">{r.lacak_qr ? fmtNum(r.saldo_kaleng) : "-"}</TD>
                <TD className={`text-right tabular-nums ${r.total_berat <= 0 ? "text-red-600" : ""}`}>{fmtBerat(r.total_berat, r.satuan)}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    <FotoButton url={r.gambar_url} judul={`${r.kode} - ${r.nama_barang}`} />
                    <KomposisiButton kode={r.kode} nama={r.nama_barang} />
                    <AdminOnly>
                      <EditDialog title={`Edit ${r.kode}`} action={updateBarang.bind(null, r.kode, periode)}
                        fields={[
                          { name: "nama_barang", label: "Nama barang", defaultValue: r.nama_barang, required: true },
                          { name: "satuan", label: "Satuan (klik atau ketik)", defaultValue: r.satuan, required: true, suggest: saran.satuan },
                          { name: "stock_awal_kaleng", label: "Stock awal bulan ini (kaleng)", type: "number", step: "any", defaultValue: r.stock_awal_kaleng },
                          { name: "stock_awal_berat", label: "Stock awal bulan ini (berat, gram)", type: "number", step: "any", defaultValue: r.stock_awal_berat, hint: "Total berat real-time dihitung ulang lewat tombol di bagian Tambah barang." },
                        ]}>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="lacak_qr" defaultChecked={r.lacak_qr} className="h-4 w-4" /> Barang berkaleng (QR & FIFO)</label>
                        <div><Label htmlFor="gambar-edit">Ganti foto (opsional)</Label><input id="gambar-edit" name="gambar" type="file" accept="image/*" capture="environment" className="block w-full text-sm" /></div>
                      </EditDialog>
                      <HapusButton judul={`${r.kode} - ${r.nama_barang}`} action={deleteBarang.bind(null, r.kode)} />
                    </AdminOnly>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <p className="p-3 text-xs text-slate-500">Jumlah kaleng data impor Excel belum tercatat (0), berat tetap lengkap di TOTAL BERAT. SALDO AKHIR = STOCK AWAL + MASUK - KELUAR + kaleng dikembalikan yang masih berisi. TOTAL BERAT adalah stok saat ini (real-time). IPK-PPC-FM-021/REV.00/22 MARET 2022/1 dari 1</p>
      </Card>
    </>
  );
}
