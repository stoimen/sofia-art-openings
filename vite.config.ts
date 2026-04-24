import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const repository = process.env.GITHUB_REPOSITORY;
const base = repository ? `/${repository.split('/')[1]}/` : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'icons/icon.svg',
        'icons/icon-maskable.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
        'icons/apple-touch-icon.png',
        'offline.html',
        'data/events.json',
        'data/venues.json',
      ],
      manifest: {
        name: 'София Арт',
        short_name: 'София Арт',
        description:
          'Мобилен календар за софийски изложби с подреждане по близост и офлайн поддръжка.',
        lang: 'bg',
        theme_color: '#111827',
        background_color: '#f8f3ea',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        navigateFallback: 'offline.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.endsWith('/data/events.json') ||
              url.pathname.endsWith('/data/venues.json'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'sofia-art-openings-data',
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 6,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});
