import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',

  // better-sqlite3 and sharp are native addons. Marking them external stops the
  // bundler trying to trace into their .node binaries and leaves them to be
  // require()'d from node_modules at runtime.
  serverExternalPackages: ['better-sqlite3', 'sharp'],

  // File tracing walks out from the app root and will otherwise sweep the whole
  // repo into .next/standalone — 2.1 GB of it, including dist/, the user's
  // database, and the Firebase service-account key. Keep this list tight.
  outputFileTracingExcludes: {
    '*': [
      'dist/**',
      '.data/**',
      'docs/**',
      'build-resources/**',
      'node_modules/electron/**',
      'node_modules/electron-builder/**',
      'node_modules/@electron/**',
      'node_modules/app-builder-bin/**',
      '**/*.map',
    ],
  },
};

export default nextConfig;
