import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Every admin API route calls this first — Route Handlers don't go through
// middleware.ts's matcher for /api/* the same way pages do, so each one
// re-checks the session rather than assuming middleware already gated it.
export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session;
}

export function hasRole(session: NonNullable<Awaited<ReturnType<typeof requireSession>>>, roles: string[]) {
  return roles.includes(session.user.role);
}
