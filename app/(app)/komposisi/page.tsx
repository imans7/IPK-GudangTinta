import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { KomposisiPanel } from "@/components/komposisi";
import { Button, Card, Label, Select } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function KomposisiPage({ searchParams }: { searchParams: { kode?: string } }) {
  const user = await requireUser();
  const [items, punya] = await Promise.all([
    prisma.masterKatalog.findMany({ orderBy: { kode: "asc" }, select: { kode: true, nama_barang: true } }),
    prisma.komposisiWarna.groupBy({ by: ["kode_barang"] }),
  ]);
  const sudah = new Set(punya.map((p) => p.kode_barang));
  const pilih = items.find((i) => i.kode === searchParams.kode);
  const resep = pilih
    ? await prisma.komposisiWarna.findMany({ where: { kode_barang: pilih.kode }, orderBy: { urutan: "asc" } })
    : [];
  return (
    <>
      <Card className="p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <Label htmlFor="kode">Pilih tinta</Label>
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
