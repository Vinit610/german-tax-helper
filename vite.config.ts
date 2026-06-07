import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static, fully client-side app. No backend, no server-side rendering.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2020',
  },
  // tesseract.js + pdf.js ship large workers; keep them out of pre-bundling.
  optimizeDeps: {
    exclude: ['tesseract.js'],
  },
});
