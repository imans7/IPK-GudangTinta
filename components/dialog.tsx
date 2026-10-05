import Link from "next/link";
import { logout } from "@/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import type { SessionUser } from "@/lib/session";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/transaksi-masuk", label: "Transaksi Masuk" },
  { href: "/transaksi-keluar", label: "Transaksi Keluar" },
  { href: "/pengembalian", label: "Pengembalian" },
  { href: "/komposisi", label: "Komposisi Tinta" },
];

// Warna menu memakai nilai tetap (bukan slate-*) karena bar ini selalu gelap di mode terang maupun gelap.
export function Nav({ user }: { user: SessionUser }) {
  return (
    <header className="no-print border-b border-[#1e293b] bg-[#0f172a] text-white dark:border-[#334155] dark:bg-[#020617]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="font-semibold">Ink Traceability</span>
        <nav className="flex flex-wrap gap-1 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded px-3 py-1.5 text-[#cbd5e1] hover:bg-[#1e293b] hover:text-white">{l.label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-[#cbd5e1]">{user.name} <span className="rounded bg-[#334155] px-1.5 py-0.5 text-xs">{user.role}</span></span>
          <ThemeToggle className="border border-[#475569] text-[#cbd5e1] hover:bg-[#1e293b]" />
          <form action={logout}><button className="rounded border border-[#475569] px-3 py-1 hover:bg-[#1e293b]">Keluar</button></form>
        </div>
      </div>
    </header>
  );
}
