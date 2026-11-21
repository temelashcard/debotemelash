import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  // Trace from the repo root so the standalone build includes the workspace packages.
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'),
  // Development only: send /api to a local API and /staff, /owner, /administrator to their local
  // dev servers (in Docker and on the VPS, Caddy does this).
  async rewrites() {
    if (!process.env.API_ORIGIN) return [];
    const apps = [
      ['/staff', process.env.STAFF_ORIGIN ?? 'http://localhost:3002'],
      ['/owner', process.env.OWNER_ORIGIN ?? 'http://localhost:3003'],
      ['/administrator', process.env.ADMIN_ORIGIN ?? 'http://localhost:3004'],
    ];
    return [
      { source: '/api/:path*', destination: process.env.API_ORIGIN + '/api/:path*', basePath: false },
      ...apps.flatMap(([base, origin]) => [
        { source: base, destination: origin + base, basePath: false },
        { source: base + '/:path*', destination: origin + base + '/:path*', basePath: false },
      ]),
    ];
  },
};

export default nextConfig;
