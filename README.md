# Sistem Manajemen & Peminjaman Tinta (Ink Traceability)

Next.js 14 (App Router) + Prisma (MySQL/TiDB) + Tailwind + NextAuth v5 + react-hook-form + ExcelJS.
Data awal: `STOCK_TINTA_88A&84_AGUSTUS_2026.xlsx` (53 barang, 35 baris masuk, 275 baris keluar).

## Setup
1. `npm install`
2. `cp .env.example .env`, isi DATABASE_URL (TiDB), AUTH_SECRET, CLOUDINARY_*
3. Database baru: `npm run db:push` lalu `npm run db:seed`.
   Database lama (skema berubah besar): `npm run db:reset-data` (MENGHAPUS semua data lalu seed ulang).
4. `npm run dev` -> http://localhost:3000

Akun seed: `admin / admin123` (ADMIN), `operator / operator123` (OPERATOR). Ganti segera.

## Alur
- **Masuk (ADMIN)**: satu form = banyak kaleng (baris: jumlah, berat, batch, kedaluwarsa, rak X-Y-Z). Hasil: 1 TransaksiMasuk, N DetailKaleng (UUID unik), total_berat_tinta bertambah, modal label QR + "Print Semua Label" (50x30 mm, 1 label/halaman).
- **Keluar/Pinjam**: scan QR atau cari manual (combobox). FIFO: TERBUKA dulu, lalu BARU dengan expired terdekat. Kaleng jadi DIPINJAM.
- **Pengembalian**: input berat sisa -> terpakai = berat keluar - sisa -> berat_aktual kaleng = sisa, total_berat_tinta berkurang sebesar terpakai (satu transaksi DB).
- **Pencarian**: kotak cari di Dashboard, Masuk, Keluar, Pengembalian (parameter URL `?q=`), bersama pilihan bulan.
- **Akses**: Edit/Hapus hanya ADMIN (UI dan server action). OPERATOR: Preview Foto + Komposisi.
- Berat disimpan dalam gram (barang kg/gram) atau satuan aslinya (lembar, roll, galon).

## Nama operator & import Excel
- Form peminjaman dan pengembalian punya isian **Nama operator** (default: akun yang login, bisa diklik dari daftar atau diketik). Tampil di tabel Keluar (kolom OPERATOR), tabel Pengembalian (OPERATOR PEMINJAM dan OPERATOR PENGEMBALI), pencarian, dan Export Excel (sheet KELUAR).
- Dashboard (ADMIN): **Import katalog dari Excel**. Pratinjau dulu, baru Impor. File Excel pabrik bisa langsung dipakai; template: `/api/template-katalog`.

## Komposisi warna (opsional)
- Saat menambah tinta baru (form di Dashboard, atau kode baru di form Masuk) ada bagian "Komposisi warna": warna dasar + komponen dalam gram atau persen.
- Boleh dikosongkan: tinta tetap tersimpan normal. Terisi: disimpan ke tabel `KomposisiWarna` dalam transaksi yang sama.
- ADMIN dan OPERATOR boleh menambah tinta baru; stock awal hanya bisa diisi ADMIN.

## Scanner lintas perangkat (PC + HP)
- Di PC klik **Scan via Smartphone**: muncul QR penghubung. Scan dengan kamera HP, buka tautan, izinkan kamera, lalu scan kaleng. Hasil `id_kaleng` muncul di layar PC kurang dari 2 detik dan langsung diperiksa FIFO.
- Di HP cukup buka aplikasi dan klik **Scan QR Kaleng** (kamera langsung).
- Mekanisme: sesi `SesiScan` di database + polling 1 detik (WebSocket tidak tersedia di Vercel/serverless). Token acak 192-bit, berlaku 15 menit sejak aktivitas terakhir.
- Jaringan lokal: `npm run dev:lan`, lalu isi `NEXT_PUBLIC_APP_URL=http://IP-PC:3000` (atau isi alamat di panel saat muncul peringatan localhost).
- Kamera HP butuh HTTPS. Di HTTP biasa pakai tombol **Ambil foto QR** (tetap jalan), atau `npm run dev:https` / deploy ke cloud.

## Catatan
- Data impor Excel tidak punya hitungan kaleng, jadi kolom kaleng = 0; berat tetap lengkap. `npm run db:sync-berat` menghitung ulang total_berat_tinta.
- Kamera QR butuh HTTPS (atau localhost).
