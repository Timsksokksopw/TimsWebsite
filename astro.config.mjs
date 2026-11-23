import { defineConfig } from 'astro/config';

// Statische Website: `npm run build` erzeugt den Ordner `dist/`,
// der auf jedem Webhosting (Hostpoint, Cloudflare Pages, Vercel …) läuft.
export default defineConfig({
  devToolbar: { enabled: false },
  vite: {
    build: { chunkSizeWarningLimit: 900 },
  },
});
