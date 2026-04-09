import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { AuthOptions, DefaultSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GithubProvider, { GithubProfile } from 'next-auth/providers/github';
import { prisma } from './prisma';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: string;
      /** GitHub avatar URL (stored on User.image). */
      image?: string | null;
    } & DefaultSession['user'];
  }
}

export const authOptions: AuthOptions = {
  debug: process.env.NODE_ENV === 'development',
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_SECRET || '',
      allowDangerousEmailAccountLinking: false,
      authorization: {
        params: {
          scope: 'read:user user:email repo',
        },
      },
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
          role: 'DEVELOPER',
        };
      },
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password_hash) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password_hash
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/signin',
  },
  events: {
    async signIn({ user, profile }) {
      try {
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
      } catch (error) {
        console.error('SignIn Event Error:', error);
      }
    },
  },
  callbacks: {
    async jwt({ token, user, profile, account }) {
      try {
        if (user) {
          token.id = user.id;
          token.role = (user as { role?: string }).role || 'DEVELOPER';
        }
        if (profile && account?.provider === 'github') {
          const githubProfile = profile as GithubProfile;
          token.name = githubProfile.name || githubProfile.login;
          token.image = githubProfile.avatar_url;
        }
        return token;
      } catch (error) {
        console.error('JWT Callback Error:', error);
        return token;
      }
    },
    async session({ session, token }) {
      try {
        if (token && session.user) {
          session.user.id = token.id as string;
          session.user.role = token.role as string;
          session.user.name = token.name as string | null | undefined;
          session.user.email = token.email as string | null | undefined;
          session.user.image = token.image as string | null | undefined;
        }
        return session;
      } catch (error) {
        console.error('Session Callback Error:', error);
        return session;
      }
    },
  },
};
