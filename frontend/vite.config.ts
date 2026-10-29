import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En développement, Vite joue le rôle que nginx jouera en production :
// /api/<service>/... est redirigé vers le bon backend, en retirant le préfixe /api
// (ex. /api/auth/login -> http://localhost:3001/auth/login).
// Les cibles se changent avec des variables d'environnement si un port local est déjà pris.
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
