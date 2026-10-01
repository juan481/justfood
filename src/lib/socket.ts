import type { Server as SocketIOServer } from 'socket.io';

// Next.js API routes run inside the same process as server.ts's custom
// HTTP server, but don't get a reference to the Socket.IO instance created
// there unless it's stashed somewhere both sides can reach — a global
// singleton is the standard pattern for this setup.
const g = globalThis as unknown as { __justfoodIO?: SocketIOServer };

export function setIO(io: SocketIOServer) {
  g.__justfoodIO = io;
}

export function getIO(): SocketIOServer | undefined {
  return g.__justfoodIO;
}

export function emitOrderEvent(
  tenantId: string,
  event: 'order:new' | 'order:status-changed' | 'table:state-changed',
  payload: unknown
) {
  getIO()?.to(`tenant:${tenantId}:kds`).emit(event, payload);
}
