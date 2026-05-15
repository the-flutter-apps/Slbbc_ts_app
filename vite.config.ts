import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { webcrypto } from 'node:crypto';

// Polyfill for Node 18 (terser plugin needs global crypto)
if (!global.crypto) {
  (global as typeof globalThis).crypto = webcrypto as Crypto;
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'icons/*.png',
        'audio/*.mp3',
        'models/*',
      ],
      manifest: {
        name: 'SLBBC Kiosk',
        short_name: 'SLBBC',
        description: 'Sri Lakshmi Balaji Boiler Contractor — Site Attendance Kiosk',
        theme_color: '#0E3A5F',
        background_color: '#0E3A5F',
        display: 'fullscreen',
        orientation: 'landscape',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3,json,bin}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB (face-api models)
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api/], // Don't show offline page for API calls
        runtimeCaching: [
          // API responses - NetworkFirst with fallback
          {
            urlPattern: /^https:\/\/api\.slbbc\.in\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
            },
          },
          // Employee photos and other images - StaleWhileRevalidate
          {
            urlPattern: /\.(jpg|jpeg|png|gif|webp)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // Don't run PWA in dev — speeds up HMR
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true, // Allow connections from local network (test on real tablet)
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    minify: 'esbuild', // Use esbuild instead of terser (faster, no crypto issues)
    rollupOptions: {
      output: {
        manualChunks: {
          'face-api': ['face-api.js'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  // @ts-expect-error - vitest config
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
