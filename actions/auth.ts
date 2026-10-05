"use server";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

export async function login(_prev: string | undefined, fd: FormData) {
  try {
    await signIn("credentials", { username: fd.get("username"), password: fd.get("password"), redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) return "Username atau password salah.";
    throw e; // redirect internal Next.js harus dilempar ulang
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
