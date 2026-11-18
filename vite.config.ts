import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Content Security Policy for the production build.
 *
 * The app has no backend and makes no network requests: lessons, progress and settings live in the
 * learner's own browser. `connect-src 'self'` and the absence of any third-party origin make that a
 * guarantee the browser enforces, not just a promise in the README. GitHub Pages cannot send
 * headers, so the policy ships as a <meta> tag (which is why frame-ancestors is not listed).
 * It is only added to `vite build` output because the dev server injects inline scripts for HMR.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "manifest-src 'self'",
  "worker-src 'self'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'eigo-steps:csp',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig(({ mode }) => ({
  // Relative asset paths + hash routing: the same build works on GitHub Pages (sub-path),
  // Netlify, a school intranet folder or a USB stick, with no server rewrite rules.
  base: './',
  // The "artifact" mode builds the claude.ai preview: that host applies its own CSP.
  plugins: mode === 'artifact' ? [react()] : [react(), contentSecurityPolicy()],
  server: { host: 'localhost', port: 5188, strictPort: true },
  preview: { host: 'localhost', port: 4188, strictPort: true },
  build: {
    outDir: mode === 'artifact' ? 'dist-artifact' : 'dist',
    target: 'es2022',
    // Source maps are not shipped to browsers in production builds.
    sourcemap: false,
    // Never inline assets as data: URIs, so the CSP stays strict.
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        // Libraries change less often than lessons and app code: separate chunks cache better
        // on school networks.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    env: { TZ: 'Asia/Tokyo' },
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: [
        '**/*.d.ts',
        'src/main.tsx',
        'src/test/**',
        '**/*.test.{ts,tsx}',
        'src/content/illustrations.json',
      ],
      reporter: ['text-summary', 'html', 'lcov'],
    },
  },
}));
