import { redirect } from "next/navigation";
import { auth } from "@/auth";

export type SessionUser = { id: string; name: string; role: "ADMIN" | "OPERATOR" };

/** Untuk Server Actions / Route Handlers: tidak redirect, kembalikan null jika belum login. */
export async function getUser(): Promise<SessionUser | null> {
  const s = await auth();
  return s?.user ? (s.user as unknown as SessionUser) : null;
}

/** Untuk halaman: redirect ke /login (atau / jika role tidak cukup). */
export async function requireUser(role?: "ADMIN" | "OPERATOR") {
  const u = await getUser();
  if (!u) redirect("/login");
  if (role && u.role !== role) redirect("/");
  return u;
}
