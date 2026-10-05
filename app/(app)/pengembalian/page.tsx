import { prisma } from "@/lib/prisma";
import { getRiwayatPengembalian } from "@/lib/katalog";
import { resolvePeriode } from "@/lib/periode";
import { requireUser } from "@/lib/session";
import { fmtBerat, sumKg, unitBerat } from "@/lib/berat";
import { formatLokasi } from "@/lib/rak";
import { fmtDate, fmtNum } from "@/lib/utils";
import { deletePengembalian, updatePengembalian } from "@/actions/kelola";
import { AdminOnly } from "@/components/admin-only";
import { FotoButton } from "@/components/foto";
import { KomposisiButton } from "@/components/komposisi-button";
import { PengembalianForm } from "@/components/pengembalian-form";
import { EditDialog, HapusButton } from "@/components/row-actions";
import { getSaran } from "@/lib/saran";
import { Toolbar } from "@/components/toolbar";
import { Card, Empty, Table, TBody, TD, TH, THead, TR } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Pengembalian({ searchParams }: { searchParams: { bulan?: string; q?: string } }) {
  const user = await requireUser();
  const periode = await resolvePeriode(searchParams.bulan);
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const [aktif, riwayat, saran] = await Promise.all([
    prisma.transaksiKeluar.findMany({ where: { id_kaleng: { not: null }, pengembalian: { is: null } }, orderBy: { id: "asc" }, include: { katalog: true, kaleng: true } }),
    getRiwayatPengembalian(periode, q),
    getSaran(),
  ]);
  const kg = sumKg(riwayat.map((r) => ({ satuan: r.katalog.satuan, v: r.berat_terpakai_aktual })));
  return (
    <>
      <PengembalianForm aktif={aktif.map((a) => ({ id: a.id, kode: a.kode_barang, nama: a.katalog.nama_barang, mesin: a.no_spk_mesin, awal: a.berat_keluar, unit: unitBerat(a.katalog.satuan).label, lokasi: formatLokasi(a.kaleng?.lokasi_x, a.kaleng?.lokasi_y, a.kaleng?.lokasi_z), operator: a.nama_operator }))} userName={user.name} operators={saran.operator} />
      <Toolbar periode={periode} q={q} placeholder="Cari kode, nama, mesin, operator, atau keterangan..." ringkasan={riwayat.length ? `${riwayat.length} pengembalian, total terpakai ${fmtNum(kg)} kg` : undefined} />
      <Card>
        <h2 className="border-b border-slate-200 p-4 font-semibold">RIWAYAT PENGEMBALIAN TINTA</h2>
        <Table>
          <THead><TR><TH>NO</TH><TH>TANGGAL KEMBALI</TH><TH>KODE</TH><TH>NAMA</TH><TH>MESIN</TH><TH className="text-right">BERAT KELUAR</TH><TH className="text-right">BERAT SISA KEMBALI</TH><TH className="text-right">BERAT TERPAKAI</TH><TH className="text-right">SISA TOTAL STOK GUDANG</TH><TH>OPERATOR PEMINJAM</TH><TH>OPERATOR PENGEMBALI</TH><TH>AKSI</TH></TR></THead>
          <TBody>
            {riwayat.length === 0 && <Empty cols={12} text={q ? `Tidak ada data untuk "${q}".` : "Belum ada pengembalian di bulan ini."} />}
            {riwayat.map((r, i) => (
              <TR key={r.id}>
                <TD>{i + 1}</TD><TD>{fmtDate(r.tanggal_kembali)}</TD><TD className="font-mono">{r.kode_barang}</TD><TD>{r.katalog.nama_barang}</TD><TD>{r.keluar.no_spk_mesin}</TD>
                <TD className="text-right tabular-nums">{fmtBerat(r.keluar.berat_keluar, r.katalog.satuan)}</TD>
                <TD className="text-right tabular-nums">{fmtBerat(r.berat_sisa_dikembalikan, r.katalog.satuan)}</TD>
                <TD className="text-right font-semibold tabular-nums">{fmtBerat(r.berat_terpakai_aktual, r.katalog.satuan)}</TD>
                <TD className="text-right tabular-nums">{r.stok_gudang_setelah == null ? "-" : fmtBerat(r.stok_gudang_setelah, r.katalog.satuan)}</TD>
                <TD>{r.keluar.nama_operator ?? "-"}</TD><TD>{r.nama_operator ?? "-"}</TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    <FotoButton url={r.katalog.gambar_url} judul={`${r.kode_barang} - ${r.katalog.nama_barang}`} />
                    <KomposisiButton kode={r.kode_barang} nama={r.katalog.nama_barang} />
                    <AdminOnly>
                      <EditDialog title="Edit pengembalian" action={updatePengembalian.bind(null, r.id)}
                        fields={[
                          { name: "tanggal", label: "Tanggal kembali", type: "date", defaultValue: r.tanggal_kembali.toISOString().slice(0, 10), required: true },
                          { name: "nama_operator", label: "Nama operator pengembali (klik atau ketik)", defaultValue: r.nama_operator ?? "", suggest: saran.operator },
                          { name: "berat_sisa", label: `Berat sisa (${unitBerat(r.katalog.satuan).label})`, type: "number", step: "any", defaultValue: r.berat_sisa_dikembalikan, required: true, hint: "Mengubah berat sisa otomatis menghitung ulang berat terpakai dan total stok." },
                        ]} />
                      <HapusButton judul={`pengembalian ${r.kode_barang} ${fmtDate(r.tanggal_kembali)}`} detail="Kaleng kembali berstatus dipinjam dan total berat dipulihkan." action={deletePengembalian.bind(null, r.id)} />
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
