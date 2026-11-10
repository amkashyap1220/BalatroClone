import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';

/** Files copied from public/ that the app shell needs offline. */
const PUBLIC_SHELL = ['manifest.webmanifest', ...readdirSync('public/icons').map((f) => `icons/${f}`)];

/**
 * Writes sw.js after the build with every emitted file in its precache list,
 * so the installed app can start and play with no connection.
 */
function serviceWorker(): Plugin {
  return {
    name: 'royal-flux-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = ['./', ...Object.keys(bundle).filter((f) => !f.endsWith('.map')), ...PUBLIC_SHELL];
      const version = createHash('sha256').update(files.sort().join('\n')).digest('hex').slice(0, 12);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `// Generated at build time by vite.config.ts.
const CACHE = 'royal-flux-${version}';
const PRECACHE = ${JSON.stringify(files)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('royal-flux-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Fresh page when online so updates arrive; cached shell when offline.
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./', copy)); return res; })
        .catch(() => caches.match('./', { ignoreVary: true })),
    );
    return;
  }
  // Build assets are content-hashed, so the cached copy is always right.
  e.respondWith(caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req)));
});
`,
      });
    },
  };
}

/** The single-file artifact build can't serve a manifest, icons or a service worker. */
function stripPwaTags(): Plugin {
  return {
    name: 'royal-flux-strip-pwa',
    transformIndexHtml: (html) => html.replace(/<!-- pwa:start -->[\s\S]*?<!-- pwa:end -->/, ''),
  };
}

export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile(), stripPwaTags()] : [react(), serviceWorker()],
  base: './',
  publicDir: mode === 'single' ? false : 'public',
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist' },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
}));
