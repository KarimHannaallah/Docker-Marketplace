import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// en dev, Vite remplace nginx : /api/auth/login -> http://localhost:3001/auth/login (préfixe /api retiré).
// les cibles se changent avec DEV_AUTH_URL, DEV_CATALOG_URL et DEV_ORDER_URL.
const auth = process.env.DEV_AUTH_URL ?? 'http://localhost:3001';
const catalog = process.env.DEV_CATALOG_URL ?? 'http://localhost:8000';
const orders = process.env.DEV_ORDER_URL ?? 'http://localhost:3002';

const stripApi = (path: string) => path.replace(/^\/api/, '');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/auth': { target: auth, rewrite: stripApi },
      '/api/admin': { target: auth, rewrite: stripApi }, // gestion des utilisateurs (auth-service)
      '/api/catalog': { target: catalog, rewrite: stripApi },
      '/api/orders': { target: orders, rewrite: stripApi },
    },
  },
});
