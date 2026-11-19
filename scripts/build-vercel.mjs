// Produces a Vercel Build Output API v3 bundle in .vercel/output:
//   static/            -> the Vite build (SPA + images)
//   functions/api.func -> the Express API bundled into one ESM file
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, '.vercel', 'output');
const dist = path.join(root, 'dist');

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  throw new Error('dist/ is missing - run "vite build" first');
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// 1. Static files
fs.cpSync(dist, path.join(out, 'static'), { recursive: true });

// 2. API function
const fnDir = path.join(out, 'functions', 'api.func');
fs.mkdirSync(fnDir, { recursive: true });
await build({
  entryPoints: [path.join(root, 'server', 'vercel-entry.ts')],
  outfile: path.join(fnDir, 'index.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  // Some CommonJS deps (express) call require() at runtime
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  // PGlite is only used for local development (dynamic import when DATABASE_URL is unset)
  external: ['@electric-sql/pglite'],
  logLevel: 'warning'
});
fs.writeFileSync(
  path.join(fnDir, '.vc-config.json'),
  JSON.stringify(
    { runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 10,
      // Frankfurt: next to the Neon database and closer to Kyrgyzstan than the default US region
      regions: ['fra1'] },
    null,
    2
  )
);

// 3. Routing: real files first, then API, then SPA fallback
fs.writeFileSync(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: 'filesystem' },
        { src: '^/api(?:/.*)?$', dest: '/api' },
        // Android app (Trusted Web Activity) domain verification, served by the API
        { src: '^/\\.well-known/assetlinks\\.json$', dest: '/api' },
        { src: '^/(.*)$', dest: '/index.html' }
      ]
    },
    null,
    2
  )
);

console.log('Vercel output written to .vercel/output');
