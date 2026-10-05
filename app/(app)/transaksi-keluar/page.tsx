import { prisma } from "@/lib/prisma";
import { getRiwayatKeluar } from "@/lib/katalog";
import { resolvePeriode } from "@/lib/periode";
import { getSaran } from "@/lib/saran";
import { requireUser } from "@/lib/session";
import { fmtBerat, sumKg } from "@/lib/berat";
import { fmtDate, fmtNum } from "@/lib/utils";
import { deleteKeluar, updateKeluar } from "@/actions/kelola";
import { AdminOnly } from "@/components/admin-only";
import { FotoButton } from "@/components/foto";
import { KeluarFlow } from "@/components/keluar-flow";
import { KomposisiButton } from "@/components/komposisi-button";
import { EditDialog, HapusButton } from "@/components/row-actions";
import { Toolbar } from "@/components/toolbar";
import { Card, Empty, Table, TBody, TD, TH, THead, TR } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TransaksiKeluar({ searchParams }: { searchParams: { bulan?: string; q?: string } }) {
  const user = await requireUser();
  const periode = await resolvePeriode(searchParams.bulan);
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const [riwayat, barang, saran] = await Promise.all([
    getRiwayatKeluar(periode, q),
    prisma.masterKatalog.findMany({ orderBy: { kode: "asc" }, select: { kode: true, nama_barang: true, satuan: true, gambar_url: true, lacak_qr: true } }),
    getSaran(),
  ]);
  const kg = sumKg(riwayat.map((r) => ({ satuan: r.katalog.satuan, v: r.berat_keluar })));
  return (
    <>
      <KeluarFlow tinta={barang.filter((b) => b.lacak_qr)} tanpaQr={barang.filter((b) => !b.lacak_qr)} saran={{ spk: saran.spk, ket: saran.ketKeluar, operator: saran.operator }} userName={user.name} />
      <Toolbar periode={periode} q={q} placeholder="Cari kode, nama, No. SPK/mesin, operator, atau keterangan..." ringkasan={riwayat.length ? `${riwayat.length} transaksi, total berat keluar ${fmtNum(kg)} kg` : undefined} />
      <Card>
        <h2 className="border-b border-slate-200 p-4 font-semibold">KARTU STOCK KELUAR</h2>
        <Table>
          <THead><TR><TH>NO</TH><TH>TANGGAL</TH><TH>KODE</TH><TH>NAMA BARANG</TH><TH>SATUAN</TH><TH>NO.SPK/ MESIN</TH><TH>KETERANGAN</TH><TH className="text-right">JML KELUAR</TH><TH className="text-right">BERAT AWAL KELUAR</TH><TH>OPERATOR</TH><TH>AKSI</TH></TR></THead>
          <TBody>
            {riwayat.length === 0 && <Empty cols={11} text={q ? `Tidak ada data untuk "${q}".` : "Belum ada pengeluaran di bulan ini."} />}
            {riwayat.map((r, i) => {
              const dipinjam = !!r.id_kaleng && !r.pengembalian;
              return (
                <TR key={r.id}>
                  <TD>{i + 1}</TD><TD>{fmtDate(r.tanggal_keluar)}</TD><TD className="font-mono">{r.kode_barang}</TD>
                  <TD>{r.katalog.nama_barang}</TD><TD>{r.katalog.satuan}</TD><TD>{r.no_spk_mesin}</TD>
                  <TD>{r.keterangan}{dipinjam && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">dipinjam</span>}</TD>
                  <TD className="text-right tabular-nums">{r.jumlah_kaleng_keluar || "-"}</TD>
                  <TD className="text-right tabular-nums">{fmtBerat(r.berat_keluar, r.katalog.satuan)}</TD>
                  <TD>{r.nama_operator ?? "-"}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      <FotoButton url={r.katalog.gambar_url} judul={`${r.kode_barang} - ${r.katalog.nama_barang}`} />
                      <KomposisiButton kode={r.kode_barang} nama={r.katalog.nama_barang} />
                      <AdminOnly>
                        <EditDialog title="Edit pengeluaran" action={updateKeluar.bind(null, r.id)}
                          fields={[
                            { name: "tanggal", label: "Tanggal", type: "date", defaultValue: r.tanggal_keluar.toISOString().slice(0, 10), required: true },
                            { name: "no_spk_mesin", label: "No. SPK / Mesin (klik atau ketik)", defaultValue: r.no_spk_mesin, required: true, suggest: saran.spk },
                            { name: "keterangan", label: "Keterangan (klik atau ketik)", defaultValue: r.keterangan, required: true, suggest: saran.ketKeluar },
                            { name: "nama_operator", label: "Nama operator (klik atau ketik)", defaultValue: r.nama_operator ?? "", suggest: saran.operator },
                            { name: "berat_keluar", label: "Berat/jumlah keluar", type: "number", step: "any", defaultValue: r.berat_keluar, required: true, readOnly: !!r.id_kaleng, hint: r.id_kaleng ? "Terkunci: berat awal peminjaman kaleng." : undefined },
                          ]} />
                        <HapusButton judul={`${r.kode_barang} ${fmtDate(r.tanggal_keluar)}`} action={deleteKeluar.bind(null, r.id)} />
                      </AdminOnly>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
