"use client";
import { useFormState, useFormStatus } from "react-dom";
import { login } from "@/actions/auth";
import { Button, Card, Input, Label } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return <Button className="w-full" disabled={pending}>{pending ? "Memeriksa..." : "Masuk"}</Button>;
}

export default function LoginPage() {
  const [error, action] = useFormState(login, undefined);
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm space-y-4 p-6">
        <div>
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
