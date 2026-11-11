import { defineConfig } from 'vite';
export default defineConfig({
  base: '/huilang2/',
  server: { port: 5174, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: id => id.includes('node_modules/three') ? 'three' : undefined } } },
});
