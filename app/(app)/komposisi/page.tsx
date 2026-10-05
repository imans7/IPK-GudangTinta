import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { cariResep, type ModeCari, type ResepTinta } from "@/lib/cari-komposisi";
import { fmtNum } from "@/lib/utils";
import { CariBahan } from "@/components/cari-bahan";
import { KomposisiPanel } from "@/components/komposisi";
import { Button, Card, Label, Select } from "@/components/ui";

export const dynamic = "force-dynamic";

const NAMA_MODE: Record<ModeCari, string> = { semua: "mengandung semua bahan", persis: "hanya bahan ini (persis)", salah: "salah satu bahan" };

export default async function KomposisiPage({ searchParams }: { searchParams: { kode?: string; bahan?: string | string[]; mode?: string } }) {
  const user = await requireUser();
  const bahan = (Array.isArray(searchParams.bahan) ? searchParams.bahan : searchParams.bahan ? [searchParams.bahan] : [])
    .map((s) => s.trim().slice(0, 60)).filter(Boolean).slice(0, 8);
  const mode: ModeCari = searchParams.mode === "persis" || searchParams.mode === "salah" ? searchParams.mode : "semua";

  const [items, semuaBaris] = await Promise.all([
    prisma.masterKatalog.findMany({ orderBy: { kode: "asc" }, select: { kode: true, nama_barang: true } }),
    prisma.komposisiWarna.findMany({
      orderBy: [{ kode_barang: "asc" }, { urutan: "asc" }],
      include: { hasil: { select: { kode: true, nama_barang: true } }, komponen: { select: { nama_barang: true } } },
    }),
  ]);
  const sudah = new Set(semuaBaris.map((r) => r.kode_barang));

  // Kelompokkan baris resep per tinta untuk pencarian mundur
  const peta = new Map<string, ResepTinta>();
  for (const r of semuaBaris) {
    const g = peta.get(r.kode_barang) ?? { kode: r.kode_barang, nama: r.hasil.nama_barang, rows: [] };
    g.rows.push({ kode_komponen: r.kode_komponen, nama_komponen: r.nama_komponen, nama_katalog: r.komponen?.nama_barang ?? null, is_base: r.is_base, jumlah: r.jumlah, satuan: r.satuan });
    peta.set(r.kode_barang, g);
  }
  const hasil = bahan.length > 0 ? cariResep(Array.from(peta.values()), bahan, mode) : null;

  // Saran bahan: barang katalog + nama komponen bebas yang pernah dipakai di resep
  const namaKatalog = new Set(items.map((i) => i.nama_barang.toLowerCase()));
  const bebas = Array.from(new Set(semuaBaris.map((r) => r.nama_komponen.trim()).filter((n) => n && !namaKatalog.has(n.toLowerCase()))));
  const opsi = [
    ...items.map((i) => ({ value: i.nama_barang, label: `${i.kode} - ${i.nama_barang}` })),
    ...bebas.map((n) => ({ value: n, label: n })),
  ];

  const cari = new URLSearchParams();
  bahan.forEach((b) => cari.append("bahan", b));
  if (bahan.length) cari.set("mode", mode);

  const pilih = items.find((i) => i.kode === searchParams.kode);
  const resep = pilih ? semuaBaris.filter((r) => r.kode_barang === pilih.kode) : [];

  return (
    <>
      <Card className="p-4">
        <h2 className="font-semibold">Cari tinta dari bahan campuran</h2>
        <p className="mb-4 text-sm text-slate-500">Masukkan bahan-bahannya (misalnya Warna A dan Warna B), lalu sistem menampilkan tinta utama yang resepnya cocok.</p>
        <CariBahan key={cari.toString()} opsi={opsi} awal={bahan} modeAwal={mode} />
      </Card>

      {hasil && (
        <Card className="p-4" aria-live="polite">
          <h2 className="font-semibold">Hasil pencarian: {hasil.length} tinta</h2>
          <p className="mb-3 text-sm text-slate-500">Bahan: {bahan.join(" + ")} ({NAMA_MODE[mode]})</p>
          {hasil.length === 0 ? (
            <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
              {peta.size === 0
                ? "Belum ada komposisi tersimpan di database. Isi komposisi di bawah (pilih tinta) atau saat menambah tinta baru."
                : <>Tidak ada tinta dengan komposisi tersebut. Coba mode "Salah satu bahan", periksa ejaan, atau cari dengan kode (mis. 1405). Pencarian hanya mencakup {peta.size} tinta yang resepnya sudah tersimpan.</>}
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {hasil.map((h) => (
                <li key={h.kode} className="space-y-2 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/komposisi?kode=${encodeURIComponent(h.kode)}&${cari.toString()}`} className="font-medium text-blue-700 underline-offset-2 hover:underline">{h.kode} - {h.nama}</Link>
                    {h.persis
                      ? <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">Persis sama</span>
                      : <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{h.belum.length > 0 ? `cocok ${h.terpenuhi.length} dari ${h.terpenuhi.length + h.belum.length} bahan` : `+ ${h.ekstra} bahan lain`}</span>}
                    {h.belum.length > 0 && <span className="text-xs text-slate-500">belum ada: {h.belum.join(", ")}</span>}
                  </div>
                  <ul className="flex flex-wrap gap-1.5 text-xs">
                    {h.rows.map((r, i) => (
                      <li key={i} className={`rounded px-2 py-1 ${h.cocokBaris[i] ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
                        {r.is_base ? "Base " : ""}{r.nama_komponen}{" "}
                        <b>{r.jumlah == null ? "(sisanya)" : `${fmtNum(r.jumlah)} ${r.satuan === "GRAM" ? "g" : "%"}`}</b>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card className="p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          {bahan.map((b) => <input key={b} type="hidden" name="bahan" value={b} />)}
          {bahan.length > 0 && <input type="hidden" name="mode" value={mode} />}
          <div className="min-w-64 flex-1">
            <Label htmlFor="kode">Pilih tinta untuk melihat atau mengubah resepnya</Label>
            <Select id="kode" name="kode" defaultValue={pilih?.kode ?? ""}>
              <option value="">Pilih tinta...</option>
              {items.map((i) => <option key={i.kode} value={i.kode}>{i.kode} - {i.nama_barang}{sudah.has(i.kode) ? "  (ada komposisi)" : ""}</option>)}
            </Select>
          </div>
          <Button variant="outline">Tampilkan</Button>
        </form>
      </Card>
      {pilih && (
        <KomposisiPanel
          key={pilih.kode}
          kode={pilih.kode}
          nama={pilih.nama_barang}
          items={items}
          canEdit={user.role === "ADMIN"}
          initial={resep.map((r) => ({ kode_komponen: r.kode_komponen, nama_komponen: r.nama_komponen, is_base: r.is_base, jumlah: r.jumlah, satuan: r.satuan }))}
        />
      )}
    </>
  );
}
