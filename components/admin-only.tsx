import { auth } from "@/auth";

/** Render anak-anaknya hanya jika session.user.role === 'ADMIN' (dicek di server, bukan sekadar disembunyikan CSS). */
export async function AdminOnly({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return session?.user?.role === "ADMIN" ? <>{children}</> : null;
}
