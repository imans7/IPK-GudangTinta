import { fmtNum } from "@/lib/utils";

// Unit dasar: gram untuk satuan kg/gram, selain itu satuan barang itu sendiri.
export function unitBerat(satuan: string) {
  const s = satuan.trim().toLowerCase();
  if (s === "kg" || s === "gram" || s === "g") return { label: "gram", faktor: s === "kg" ? 1000 : 1 };
  return { label: satuan.trim(), faktor: 1 };
}

/** 5000 g (5 kg) untuk barang berat; "3 lembar" untuk lainnya. */
export function fmtBerat(v: number, satuan: string) {
  const u = unitBerat(satuan);
  if (u.label !== "gram") return `${fmtNum(v)} ${u.label}`;
  return Math.abs(v) >= 1000 ? `${fmtNum(v)} g (${fmtNum(v / 1000)} kg)` : `${fmtNum(v)} g`;
}

/** Jumlahkan hanya barang berunit gram, hasilnya kg. */
export const sumKg = (rows: { satuan: string; v: number }[]) =>
  rows.filter((r) => unitBerat(r.satuan).label === "gram").reduce((a, r) => a + r.v, 0) / 1000;
