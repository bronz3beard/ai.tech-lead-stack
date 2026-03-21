import { AuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async jwt({ token, user, profile }) {
      if (user) {
        token.id = user.id;
      }
      if (profile) {
        // Cast profile to any to access potentially missing fields from the base type
        const githubProfile = profile as any;
        token.name = githubProfile.name || githubProfile.login;
        token.image = githubProfile.avatar_url;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        session.user.name = token.name as string;
        session.user.image = token.image as string;
      }
      return session;
    },
  },
};
