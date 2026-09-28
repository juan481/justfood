/** @type {import('next').NextConfig} */
const nextConfig = {
  // Custom server (server.ts) hosts both Next's request handler and Socket.IO
  // on one process, matching the PM2 + hand-edited Nginx pattern used for
  // this VPS's other apps (see design-reference/ for the architecture doc).
  eslint: {
    dirs: ['src'],
  },
};

module.exports = nextConfig;
