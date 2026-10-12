import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Dos entradas: la página completa (index.html) y El Sol App (app.html, en /app).
  build: { rollupOptions: { input: { main: fileURLToPath(new URL('./index.html', import.meta.url)), app: fileURLToPath(new URL('./app.html', import.meta.url)) } } },
});
