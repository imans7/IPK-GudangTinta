export const RAK_X = ["1A", "2A", "3A", "1B", "2B", "3B", "1C", "2C", "3C", "1D", "2D", "3D", "1E", "2E", "3E"] as const;
export const RAK_Y = ["I", "II", "III", "IV"] as const;
export const RAK_Z = [1, 2, 3, 4, 5, 6, 7] as const;

/** Gabungan otomatis, contoh "1A-II-4". */
export const formatLokasi = (x?: string | null, y?: string | null, z?: number | null) => (x && y && z ? `${x}-${y}-${z}` : "-");

type Lokasi = { x: string; y: string; z: number };
export function parseLokasi(fd: FormData, wajib: boolean): { ok: true; lokasi: Lokasi | null } | { ok: false; error: string } {
  const x = String(fd.get("lokasi_x") ?? "").trim().toUpperCase();
  const y = String(fd.get("lokasi_y") ?? "").trim().toUpperCase();
  const zs = String(fd.get("lokasi_z") ?? "").trim();
  if (!x && !y && !zs) return wajib ? { ok: false, error: "Lokasi rak (X, Y, Z) wajib dipilih." } : { ok: true, lokasi: null };
  const z = Number(zs);
  if (!(RAK_X as readonly string[]).includes(x) || !(RAK_Y as readonly string[]).includes(y) || !(RAK_Z as readonly number[]).includes(z))
    return { ok: false, error: "Lokasi rak tidak valid. X: 1A-3E, Y: I-IV, Z: 1-7." };
  return { ok: true, lokasi: { x, y, z } };
}

/** Validasi lokasi dari objek (dipakai form multi-batch). */
export function cekLokasi(l?: { x?: string; y?: string; z?: string | number }): { ok: true; x: string; y: string; z: number } | { ok: false } {
  const x = String(l?.x ?? "").trim().toUpperCase();
  const y = String(l?.y ?? "").trim().toUpperCase();
  const z = Number(l?.z);
  if (!(RAK_X as readonly string[]).includes(x) || !(RAK_Y as readonly string[]).includes(y) || !(RAK_Z as readonly number[]).includes(z)) return { ok: false };
  return { ok: true, x, y, z };
}
