// Custom Node server hosting Next.js + Socket.IO on one process — the
// piece that makes real-time KDS push possible on a self-hosted PM2/Nginx
// deploy (Vercel serverless can't hold a persistent WebSocket connection).
// See the approved plan, section 1, for the full justification.
import { createServer, type IncomingMessage } from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { getToken } from 'next-auth/jwt';
import { setIO } from './src/lib/socket';

function parseCookieHeader(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    if (!name) continue;
    out[name] = decodeURIComponent(pair.slice(eq + 1).trim());
  }
  return out;
}

const port = parseInt(process.env.PORT || '3010', 10);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new SocketIOServer(httpServer, {
    path: '/socket.io',
  });
  setIO(io);

  // Every join is checked against the caller's own NextAuth session cookie —
  // without this, anyone who knew (or guessed) another tenant's ID could
  // `socket.emit('join-tenant-room', theirId)` from a browser console and
  // listen live to that restaurant's order feed (names, phones, addresses),
  // with zero login. The socket carries the same session cookie as the page
  // that opened it, so getToken() reads it straight off the handshake.
  io.on('connection', (socket) => {
    socket.on('join-tenant-room', async (tenantId: string) => {
      try {
        // getToken() reads `req.cookies` as an already-parsed object — a raw
        // socket handshake request only has the unparsed `Cookie` header, so
        // without this it always finds nothing and treats every caller as
        // logged out (silently letting the join through unauthenticated, or
        // — as written defensively here — rejecting everyone equally).
        const req = socket.request as IncomingMessage & { cookies?: Record<string, string> };
        req.cookies = parseCookieHeader(req.headers.cookie ?? '');

        const token = await getToken({ req: req as Parameters<typeof getToken>[0]['req'], secret: process.env.NEXTAUTH_SECRET });
        if (!token || token.tenantId !== tenantId) {
          socket.disconnect(true);
          return;
        }
        socket.join(`tenant:${tenantId}:kds`);
      } catch {
        socket.disconnect(true);
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`> JustFood listening on http://localhost:${port} (${dev ? 'dev' : 'production'})`);
  });
});
