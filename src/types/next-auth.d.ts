import type { DefaultSession } from 'next-auth';

// Augments NextAuth's session/user/JWT shapes with the tenant-scoping
// fields every API route and Socket.IO handshake relies on (plan section 5).
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      tenantSlug: string;
      branchId: string | null;
      role: string;
    } & DefaultSession['user'];
  }

  interface User {
    tenantId: string;
    tenantSlug: string;
    branchId: string | null;
    role: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    tenantId: string;
    tenantSlug: string;
    branchId: string | null;
    role: string;
  }
}
