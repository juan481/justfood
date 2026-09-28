// Custom Node server hosting Next.js + Socket.IO on one process — the
// piece that makes real-time KDS push possible on a self-hosted PM2/Nginx
// deploy (Vercel serverless can't hold a persistent WebSocket connection).
// See the approved plan, section 1, for the full justification.
import { createServer } from 'http';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { setIO } from './src/lib/socket';

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

  // TODO(Fase 3 hardening): verify the caller's NextAuth JWT before letting
  // it join a tenant room, instead of trusting whatever tenantId the client
  // sends — fine for local-only Fase 1 development, not for production.
  io.on('connection', (socket) => {
    socket.on('join-tenant-room', (tenantId: string) => {
      socket.join(`tenant:${tenantId}:kds`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> JustFood listening on http://localhost:${port} (${dev ? 'dev' : 'production'})`);
  });
});
