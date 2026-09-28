import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // better-sqlite3 es un addon nativo: se carga con require de Node, sin bundlear.
  serverExternalPackages: ['better-sqlite3'],
  // Evita que `next dev` genere AGENTS.md / CLAUDE.md en la raíz.
  agentRules: false,
};

export default nextConfig;
