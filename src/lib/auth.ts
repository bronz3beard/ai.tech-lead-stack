import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { AuthOptions, DefaultSession } from 'next-auth';
import GithubProvider, { GithubProfile } from 'next-auth/providers/github';
import { prisma } from './prisma';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      /** GitHub avatar URL (stored on User.image). */
      image?: string | null;
    } & DefaultSession['user'];
  }
}

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      allowDangerousEmailAccountLinking: false,
      authorization: {
        params: {
          // GitHub has no `user:profile` scope. `read:user` includes public profile + `avatar_url`.
          // `user:email` is for primary/private emails via the emails API.
          // `repo` is for repository access to create PRs.
          scope: 'read:user user:email repo',
        },
      },
    }),
  ],
  session: {
    strategy: 'database',
  },
  pages: {
    signIn: '/signin',
  },
  // Prisma adapter returns early for existing OAuth accounts and does not call `updateUser`, so
  // `name` / `image` can stay null. Email linking can leave the same gaps. Sync after OAuth.
  events: {
    async signIn({ user, profile }) {
      if (!profile || typeof profile !== 'object') return;
      const p = profile as { name?: string | null; image?: string | null };
      if (p.image == null && p.name == null) return;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          ...(p.image != null ? { image: p.image } : {}),
          ...(p.name != null ? { name: p.name } : {}),
        },
      });
    },
  },
  callbacks: {
    // Only runs when `session.strategy` is `jwt` (not during OAuth with database sessions).
    async jwt({ token, user, profile }) {
      if (user) {
        token.id = user.id;
      }
      if (profile) {
        const githubProfile = profile as GithubProfile;
        token.name = githubProfile.name || githubProfile.login;
        token.image = githubProfile.avatar_url;
      }
      return token;
    },
    async session({ session, user, token }) {
      if (!session.user) return session;

      if (user) {
        session.user.id = user.id;
        session.user.name = user.name;
        session.user.email = user.email;
        session.user.image = user.image;
        return session;
      }

      if (token?.id) session.user.id = token.id as string;
      if (token?.name) session.user.name = token.name as string;
      if (token?.image) session.user.image = token.image as string;
      return session;
    },
  },
};
