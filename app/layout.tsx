import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "app/globals.css";

const inter = Inter({ subsets: ["latin"] });

// Jalan sebelum halaman tampil supaya tidak berkedip terang dulu: pakai pilihan tersimpan, atau ikut pengaturan sistem.
const temaScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}`;
export const metadata: Metadata = { title: "Manajemen & Peminjaman Tinta", description: "Ink traceability dengan QR dan FIFO" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: temaScript }} /></head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
