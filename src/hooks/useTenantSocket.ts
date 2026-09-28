'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

// Joins this tenant's KDS room and re-fetches (via the caller's onSync)
// on every reconnect rather than trusting accumulated socket events — the
// DB is the source of truth, the socket is only a freshness signal (plan
// section 7: "real-time consistency across multiple KDS clients").
export function useTenantSocket(tenantId: string | undefined, onSync: () => void) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  useEffect(() => {
    if (!tenantId) return;

    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-tenant-room', tenantId);
      setConnected(true);
      onSyncRef.current();
    });
    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tenantId]);

  return { socket: socketRef.current, connected };
}
