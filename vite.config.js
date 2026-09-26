import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Permette il funzionamento corretto sia in locale che su GitHub Pages (sottocartella /AstronomicalHorizon/)
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false
  }
});
