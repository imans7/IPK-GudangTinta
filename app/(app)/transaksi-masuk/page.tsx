import { prisma } from "@/lib/prisma";
import { getRiwayatMasuk } from "@/lib/katalog";
import { resolvePeriode } from "@/lib/periode";
import { getSaran } from "@/lib/saran";
import { requireUser } from "@/lib/session";
import { fmtBerat, sumKg } from "@/lib/berat";
import { fmtDate, fmtNum } from "@/lib/utils";
import { deleteMasuk, updateMasuk } from "@/actions/kelola";
import { AdminOnly } from "@/components/admin-only";
import { FotoButton } from "@/components/foto";
import { KomposisiButton } from "@/components/komposisi-button";
import { MasukForm } from "@/components/masuk-form";
import { EditDialog, HapusButton } from "@/components/row-actions";
import { Toolbar } from "@/components/toolbar";
import { Card, Empty, Table, TBody, TD, TH, THead, TR } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TransaksiMasuk({ searchParams }: { searchParams: { bulan?: string; q?: string } }) {
  await requireUser();
  const periode = await resolvePeriode(searchParams.bulan);
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const [barang, riwayat, saran] = await Promise.all([
    prisma.masterKatalog.findMany({ orderBy: { kode: "asc" }, select: { kode: true, nama_barang: true, satuan: true, lacak_qr: true } }),
    getRiwayatMasuk(periode, q),
    getSaran(),
  ]);
  const kg = sumKg(riwayat.map((r) => ({ satuan: r.katalog.satuan, v: r.total_berat_masuk })));
  return (
    <>
      <AdminOnly><MasukForm barang={barang} saran={{ ket: saran.ketMasuk, satuan: saran.satuan, batch: saran.batch }} /></AdminOnly>
      <Toolbar periode={periode} q={q} placeholder="Cari kode, nama barang, atau keterangan..." ringkasan={riwayat.length ? `${riwayat.length} transaksi, total berat masuk ${fmtNum(kg)} kg` : undefined} />
      <Card className="no-print">
        <h2 className="border-b border-slate-200 p-4 font-semibold">KARTU STOCK MASUK</h2>
        <Table>
          <THead><TR><TH>NO</TH><TH>TANGGAL</TH><TH>KODE</TH><TH>NAMA BARANG</TH><TH>SATUAN</TH><TH>KETERANGAN</TH><TH className="text-right">JUMLAH KALENG</TH><TH className="text-right">TOTAL BERAT MASUK</TH><TH>AKSI</TH></TR></THead>
          <TBody>
            {riwayat.length === 0 && <Empty cols={9} text={q ? `Tidak ada data untuk "${q}".` : "Belum ada barang masuk di bulan ini."} />}
            {riwayat.map((r, i) => (
              <TR key={r.id}>
                <TD>{i + 1}</TD><TD>{fmtDate(r.tanggal_masuk)}</TD><TD className="font-mono">{r.kode_barang}</TD>
                <TD>{r.katalog.nama_barang}</TD><TD>{r.katalog.satuan}</TD><TD>{r.keterangan}</TD>
                <TD className="text-right tabular-nums">{r.jumlah_kaleng_masuk || "-"}</TD>
                <TD className="text-right tabular-nums">{fmtBerat(r.total_berat_masuk, r.katalog.satuan)}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    <FotoButton url={r.foto_url ?? r.katalog.gambar_url} judul={`${r.kode_barang} - ${r.katalog.nama_barang}`} />
                    <KomposisiButton kode={r.kode_barang} nama={r.katalog.nama_barang} />
                    <AdminOnly>
                      <EditDialog title="Edit barang masuk" action={updateMasuk.bind(null, r.id)}
                        fields={[
                          { name: "tanggal", label: "Tanggal", type: "date", defaultValue: r.tanggal_masuk.toISOString().slice(0, 10), required: true },
                          { name: "keterangan", label: "Keterangan (klik atau ketik)", defaultValue: r.keterangan, suggest: saran.ketMasuk, hint: "Jumlah dan berat tidak diubah di sini. Salah input? Hapus transaksi (selama kalengnya belum dipakai) lalu input ulang." },
                        ]} />
                      <HapusButton judul={`${r.kode_barang} ${fmtDate(r.tanggal_masuk)} (${r.jumlah_kaleng_masuk || "-"} kaleng)`} detail="Semua kaleng dan QR dari transaksi ini ikut dihapus dan total berat dikurangi." action={deleteMasuk.bind(null, r.id)} />
                    </AdminOnly>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}
