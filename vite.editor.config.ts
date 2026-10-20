import { defineConfig } from 'vite';
import path from 'node:path';

// Map-Editor als eigenständige Seite bauen (z. B. zum Teilen ohne Dev-Server): npx vite build -c vite.editor.config.ts
// Ohne Dev-Server speichert der Editor nur im Browser; ins Spiel kommt die Karte über „Export“.
export default defineConfig({
  base: './',
  resolve: { preserveSymlinks: true },
  build: {
    outDir: 'dist-editor',
    chunkSizeWarningLimit: 3000,
    rollupOptions: { input: path.resolve(__dirname, 'editor.html') },
  },
});
