import Link from "next/link";
import { logout } from "@/actions/auth";
import type { SessionUser } from "@/lib/session";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/transaksi-masuk", label: "Transaksi Masuk" },
  { href: "/transaksi-keluar", label: "Transaksi Keluar" },
  { href: "/pengembalian", label: "Pengembalian" },
  { href: "/komposisi", label: "Komposisi Tinta" },
];

export function Nav({ user }: { user: SessionUser }) {
  return (
    <header className="no-print border-b border-slate-200 bg-slate-900 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <span className="font-semibold">Ink Traceability</span>
        <nav className="flex flex-wrap gap-1 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded px-3 py-1.5 text-slate-300 hover:bg-slate-800 hover:text-white">{l.label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-slate-300">{user.name} <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs">{user.role}</span></span>
          <form action={logout}><button className="rounded border border-slate-600 px-3 py-1 hover:bg-slate-800">Keluar</button></form>
        </div>
      </div>
    </header>
  );
}
