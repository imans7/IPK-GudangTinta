import ExcelJS from "exceljs";
import { getUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Template import katalog. Header dibaca otomatis oleh lib/import-katalog.ts.
export async function GET() {
  const u = await getUser();
  if (!u || u.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("KATALOG");
  ws.columns = [
    { header: "KODE", width: 16 }, { header: "NAMA BARANG", width: 36 }, { header: "SATUAN", width: 12 },
    { header: "STOCK AWAL", width: 14 }, { header: "STOCK AWAL KALENG", width: 20 }, { header: "BERKALENG", width: 12 },
  ];
  ws.addRows([
    ["EMPMRC1", "EMBLEM proses black MRC", "kg", 25, 5, "YA"],
    ["BLNSM74", "Blanket SM 74", "lembar", 3, "", "TIDAK"],
  ]);
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } }; c.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } }; });
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const p = wb.addWorksheet("PETUNJUK");
  p.getColumn(1).width = 110;
  [
    "KODE, NAMA BARANG, SATUAN wajib diisi. Kode otomatis huruf besar; kode dobel dalam file ditolak.",
    "STOCK AWAL (opsional): dalam satuan barang. Contoh 25 dengan satuan kg = 25.000 gram di sistem.",
    "STOCK AWAL KALENG (opsional): jumlah kaleng fisik. Kosong = 0.",
    "BERKALENG (opsional): YA = memakai QR & FIFO, TIDAK = barang tanpa kaleng (blanket, roll). Kosong = otomatis (lembar/roll = TIDAK).",
    "Kolom lain (NO, MASUK, KELUAR, SALDO AKHIR, dst.) diabaikan, jadi file Excel pabrik bisa langsung dipakai.",
    "Stock awal disimpan untuk bulan yang sedang dipilih di Dashboard saat mengimpor.",
  ].forEach((t) => p.addRow([t]));

  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="template-import-katalog.xlsx"' },
  });
}
