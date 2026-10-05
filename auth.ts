import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(c) {
        const username = String(c?.username ?? "").trim();
        const password = String(c?.password ?? "");
        if (!username || !password) return null;
        const u = await prisma.user.findUnique({ where: { username } });
        if (!u || !(await bcrypt.compare(password, u.password))) return null;
        return { id: u.id, name: u.nama_lengkap, role: u.role } as any;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) { token.id = user.id; token.role = (user as any).role; }
      return token;
    },
    session({ session, token }) {
      (session.user as any).id = token.id;
      (session.user as any).role = token.role;
      return session;
    },
  },
});
