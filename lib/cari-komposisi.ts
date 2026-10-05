// Pencarian mundur (reverse search): dari bahan campuran -> tinta utama yang resepnya cocok.
// Murni logika (tanpa database) supaya mudah diuji.

export type BarisResep = {
  kode_komponen: string | null;
  nama_komponen: string;
  nama_katalog: string | null; // nama barang katalog bila komponen dipilih dari katalog
  is_base: boolean;
  jumlah: number | null;
  satuan: "GRAM" | "PERSEN";
};
export type ResepTinta = { kode: string; nama: string; rows: BarisResep[] };
export type ModeCari = "semua" | "persis" | "salah";
export type HasilCari = {
  kode: string; nama: string; rows: BarisResep[];
  cocokBaris: boolean[]; // baris resep mana yang cocok dengan bahan yang dicari
  terpenuhi: string[]; belum: string[]; // bahan yang dicari: ketemu / tidak ketemu di resep ini
  ekstra: number; // jumlah bahan lain di resep di luar yang dicari
  persis: boolean;
};

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** "Tc 1405" juga dicari sebagai "1405", supaya cocok dengan resep yang ditulis "Red 1405". */
function kunci(term: string): string[] {
  const t = norm(term);
  const angka = t.replace(/^tc/, "");
  return Array.from(new Set([t, ...(angka !== t && /^\d{2,}$/.test(angka) ? [angka] : [])])).filter((x) => x.length >= 2);
}
const cocok = (term: string, r: BarisResep) => {
  const h = norm(`${r.nama_komponen} ${r.kode_komponen ?? ""} ${r.nama_katalog ?? ""}`);
  return kunci(term).some((k) => h.includes(k));
};

/** Satu bahan dicari hanya boleh memakai satu baris resep (pencocokan bipartit, algoritma Kuhn). */
function cocokkan(terms: string[], rows: BarisResep[]) {
  const adj = terms.map((t) => rows.flatMap((r, j) => (cocok(t, r) ? [j] : [])));
  const pemilik = new Array<number>(rows.length).fill(-1);
  const coba = (i: number, lihat: boolean[]): boolean => {
    for (const j of adj[i]) {
      if (lihat[j]) continue;
      lihat[j] = true;
      if (pemilik[j] === -1 || coba(pemilik[j], lihat)) { pemilik[j] = i; return true; }
    }
    return false;
  };
  terms.forEach((_, i) => coba(i, new Array<boolean>(rows.length).fill(false)));
  return { pemilik, termKetemu: terms.map((_, i) => pemilik.includes(i)) };
}

export function cariResep(reseps: ResepTinta[], bahan: string[], mode: ModeCari): HasilCari[] {
  const terms = bahan.filter((b, i) => kunci(b).length > 0 && bahan.findIndex((x) => norm(x) === norm(b)) === i);
  if (terms.length === 0) return [];
  const hasil: (HasilCari & { n: number })[] = [];
  for (const r of reseps) {
    if (r.rows.length === 0) continue;
    const { pemilik, termKetemu } = cocokkan(terms, r.rows);
    const n = termKetemu.filter(Boolean).length;
    const semua = n === terms.length;
    if (mode === "semua" && !semua) continue;
    if (mode === "persis" && !(semua && r.rows.length === terms.length)) continue;
    if (mode === "salah" && n === 0) continue;
    hasil.push({
      n, kode: r.kode, nama: r.nama, rows: r.rows, cocokBaris: pemilik.map((p) => p !== -1),
      terpenuhi: terms.filter((_, i) => termKetemu[i]), belum: terms.filter((_, i) => !termKetemu[i]),
      ekstra: r.rows.length - n, persis: semua && r.rows.length === terms.length,
    });
  }
  return hasil
    .sort((a, b) => b.n - a.n || a.ekstra - b.ekstra || a.nama.localeCompare(b.nama))
    .map(({ n: _n, ...x }) => x);
}
