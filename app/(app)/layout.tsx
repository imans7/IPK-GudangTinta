import { Nav } from "@/components/nav";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <Nav user={user} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">{children}</main>
    </>
  );
}
