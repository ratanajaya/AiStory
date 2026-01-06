import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-compatible config (no Node.js modules like MongoDB)
// The signIn callback with DB check is in auth.ts
export default {
  providers: [
    Google({
      clientId: process.env.GOOGLE_SSO_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_SSO_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
} satisfies NextAuthConfig;
