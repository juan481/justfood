// PM2 process file for the Hetzner VPS — mirrors academia-remax /
// just-create-web / perladerm's existing deploy shape. Not usable until
// Phase 0's VPS-side prerequisites are done (Postgres installed, real
// .env in place, `npm run build` completed) — see README.md.
module.exports = {
  apps: [
    {
      name: 'justfood',
      script: 'npm',
      args: 'start',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
      },
      instances: 1, // fork mode — see plan section 1 on why cluster mode needs the Postgres LISTEN/NOTIFY socket.io adapter first
      autorestart: true,
      watch: false,
    },
  ],
};
