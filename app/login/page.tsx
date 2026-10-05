"use client";
import { useFormState, useFormStatus } from "react-dom";
import { login } from "@/actions/auth";
import { InkBackground } from "@/components/ink-background";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Card, Input, Label } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return <Button className="w-full" disabled={pending}>{pending ? "Memeriksa..." : "Masuk"}</Button>;
}

export default function LoginPage() {
  const [error, action] = useFormState(login, undefined);
  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <InkBackground />
      <ThemeToggle className="absolute right-4 top-4 border border-slate-300 bg-white/70 text-slate-700 backdrop-blur hover:bg-white dark:border-slate-600 dark:bg-slate-800/60 dark:hover:bg-slate-800" />
      <Card className="w-full max-w-sm space-y-4 bg-white/75 p-6 shadow-xl backdrop-blur-md dark:bg-slate-800/70">
        <div>
          <div className="mb-3 flex gap-1.5" aria-hidden="true">
            <span className="h-3 w-3 rounded-full bg-[#00aeef]" /><span className="h-3 w-3 rounded-full bg-[#ec008c]" />
            <span className="h-3 w-3 rounded-full bg-[#ffd600]" /><span className="h-3 w-3 rounded-full bg-[#282834] dark:bg-slate-300" />
          </div>
          <h1 className="text-xl font-semibold">Manajemen & Peminjaman Tinta</h1>
          <p className="text-sm text-slate-500">Masuk dengan akun pabrik Anda.</p>
        </div>
        <form action={action} className="space-y-3">
          <div><Label htmlFor="username">Username</Label><Input id="username" name="username" autoComplete="username" required /></div>
          <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete="current-password" required /></div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <Submit />
        </form>
      </Card>
    </div>
  );
}
