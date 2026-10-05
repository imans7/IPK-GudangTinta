import ExcelJS from "exceljs";
import { getUser } from "@/lib/session";
import { getKatalogRows, getRiwayatKeluar, getRiwayatMasuk } from "@/lib/katalog";
import { unitBerat } from "@/lib/berat";
import { GUDANG, labelPeriode, rentang, resolvePeriode } from "@/lib/periode";

export const dynamic = "force-dynamic";

const ACC0 = '_(* #,##0_);_(* \\(#,##0\\);_(* "-"??_);_(@_)'; // format angka Excel pabrik
const thin = { style: "thin" as const };
const box = { top: thin, left: thin, bottom: thin, right: thin };
const numFmt = (v: number) => (Number.isInteger(v) ? ACC0 : "#,##0.00");
/** Berat unit dasar -> satuan barang (gram -> kg bila satuannya kg), sesuai kolom SATUAN. */
const dalamSatuan = (v: number, satuan: string) => Math.round((v / unitBerat(satuan).faktor) * 1000) / 1000;

function buatSheet(wb: ExcelJS.Workbook, nama: string, judul: string, header: string[], widths: number[], periode: string, footer?: string) {
  const ws = wb.addWorksheet(nama);
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws.views = [{ state: "frozen", ySplit: 4 }];
  const last = String.fromCharCode(64 + header.length);
  ws.mergeCells(`A1:${last}1`);
  ws.getCell("A1").value = judul;
  ws.getCell("A1").font = { name: "Calibri", size: 18, bold: true };
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 28;
  ws.getCell("B2").value = "BULAN :";
  ws.getCell("B2").font = { name: "Arial", size: 11, bold: true };
  ws.getCell("B2").alignment = { horizontal: "right" };
  ws.getCell("C2").value = rentang(periode).start;
  ws.getCell("C2").numFmt = "mmm-yy";
  ws.getCell("C2").font = { name: "Arial", size: 11, bold: true };
  ws.getCell("C2").alignment = { horizontal: "left" };
  const gc = String.fromCharCode(64 + header.length - 2);
  ws.mergeCells(`${gc}2:${last}2`);
  ws.getCell(`${gc}2`).value = `GUDANG : ${GUDANG}`;
  ws.getCell(`${gc}2`).font = { name: "Calibri", size: 10, bold: true };
  const row = ws.getRow(4);
  header.forEach((l, i) => {
    const c = row.getCell(i + 1);
    c.value = l;
    c.font = { name: "Calibri", size: 11, bold: true };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
    c.border = box;
  });
  row.height = 32;
  return { ws, last, footer };
}

function isi(ws: ExcelJS.Worksheet, baris: (string | number | Date | null)[][], angkaDari: number, tglKol?: number) {
  baris.forEach((vals, i) => {
    const row = ws.getRow(5 + i);
    vals.forEach((v, c) => {
      const cell = row.getCell(c + 1);
      cell.value = v;
      cell.border = box;
      cell.font = { name: "Calibri", size: 11 };
      if (c === 0 || c === tglKol) cell.alignment = { horizontal: "center" };
      if (tglKol === c && v instanceof Date) cell.numFmt = "dd/mm/yyyy";
      if (c >= angkaDari && typeof v === "number") cell.numFmt = numFmt(v);
    });
  });
}

function footer(ws: ExcelJS.Worksheet, n: number, last: string, text: string) {
  const r = 5 + n + 1;
  const from = String.fromCharCode(last.charCodeAt(0) - 2);
  ws.mergeCells(`${from}${r}:${last}${r}`);
  ws.getCell(`${from}${r}`).value = text;
  ws.getCell(`${from}${r}`).font = { name: "Calibri", size: 9 };
  ws.getCell(`${from}${r}`).alignment = { horizontal: "right" };
}

export async function GET(req: Request) {
  if (!(await getUser())) return new Response("Unauthorized", { status: 401 });
  const periode = await resolvePeriode(new URL(req.url).searchParams.get("bulan"));
  const [kat, masuk, keluar] = await Promise.all([getKatalogRows(periode), getRiwayatMasuk(periode), getRiwayatKeluar(periode)]);
  const wb = new ExcelJS.Workbook();

  const k = buatSheet(wb, "KATALOG", "STOCK OPNAME BAHAN PEMBANTU",
    ["NO", "KODE", "NAMA BARANG", "SATUAN", "STOCK AWAL", "MASUK", "KELUAR", "SALDO AKHIR (KALENG)", "TOTAL BERAT (GRAM/KG)"], [7, 14, 32, 10, 13, 11, 11, 16, 18], periode);
  isi(k.ws, kat.map((r) => [r.no, r.kode, r.nama_barang, r.satuan, r.lacak_qr ? r.stock_awal_kaleng : null, r.lacak_qr ? r.masuk : null, r.lacak_qr ? r.keluar : null, r.lacak_qr ? r.saldo_kaleng : null, dalamSatuan(r.total_berat, r.satuan)]), 4);
  footer(k.ws, kat.length, k.last, "IPK-PPC-FM-021/REV.00/22 MARET 2022/1 dari 1");

  const m = buatSheet(wb, "MASUK", "KARTU STOCK MASUK",
    ["NO", "TANGGAL", "KODE", "NAMA BARANG", "SATUAN", "KETERANGAN", "JUMLAH KALENG", "TOTAL BERAT MASUK"], [6, 12, 14, 34, 10, 28, 14, 18], periode);
  let lastKey = "";
  isi(m.ws, masuk.map((r, i) => {
    const key = r.tanggal_masuk.toISOString(); const tampil = key !== lastKey; lastKey = key; // tanggal hanya di baris pertama hari itu
    return [i + 1, tampil ? r.tanggal_masuk : null, r.kode_barang, r.katalog.nama_barang, r.katalog.satuan, r.keterangan, r.jumlah_kaleng_masuk || null, dalamSatuan(r.total_berat_masuk, r.katalog.satuan)];
  }), 6, 1);

  const o = buatSheet(wb, "KELUAR", "KARTU STOCK KELUAR",
    ["NO", "TANGGAL", "KODE", "NAMA BARANG", "SATUAN", "NO.SPK/ MESIN", "KETERANGAN", "JML KELUAR", "BERAT AWAL KELUAR", "OPERATOR"], [6, 12, 14, 30, 10, 18, 36, 12, 18, 18], periode);
  lastKey = "";
  isi(o.ws, keluar.map((r, i) => {
    const key = r.tanggal_keluar.toISOString(); const tampil = key !== lastKey; lastKey = key;
    return [i + 1, tampil ? r.tanggal_keluar : null, r.kode_barang, r.katalog.nama_barang, r.katalog.satuan, r.no_spk_mesin, r.keterangan, r.jumlah_kaleng_keluar || null, dalamSatuan(r.berat_keluar, r.katalog.satuan), r.nama_operator ?? null];
  }), 7, 1);
  footer(o.ws, keluar.length, o.last, "IPK-PPC-FM-04/REV.00/01 NOVEMBER 2017/1 dari 1");

  const buf = await wb.xlsx.writeBuffer();
  const fname = `STOCK_TINTA_${GUDANG.replace(/[^A-Za-z0-9]/g, "_")}_${labelPeriode(periode).toUpperCase().replace(" ", "_")}.xlsx`;
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${fname}"` },
  });
}
