import type { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// username is globally unique (schema `@@unique([username])`) — so login
// resolves the tenant from the username alone, no tenant picker needed.
export const authOptions: AuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
          include: { tenant: true },
        });
        if (!user || !user.isActive || user.tenant.status !== 'active') return null;

        const passwordValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!passwordValid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.username,
          tenantId: user.tenantId,
          tenantSlug: user.tenant.slug,
          branchId: user.branchId,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.tenantId = user.tenantId;
        token.tenantSlug = user.tenantSlug;
        token.branchId = user.branchId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.sub!,
        tenantId: token.tenantId as string,
        tenantSlug: token.tenantSlug as string,
        branchId: token.branchId as string | null,
        role: token.role as string,
      };
      return session;
    },
  },
};
