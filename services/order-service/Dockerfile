# Image en 2 étapes : on compile en TypeScript, puis on ne garde que le strict nécessaire.

# --- Étape 1 : build (avec les devDependencies : typescript, types...) ---
FROM node:24-alpine AS build
WORKDIR /app
# manifestes copiés d'abord : la couche npm ci reste en cache tant qu'ils ne changent pas
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# --- Étape 2 : image finale (uniquement les dépendances de production + le JS compilé) ---
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# utilisateur node (uid 1000) déjà présent dans l'image : on ne tourne pas en root
USER 1000
EXPOSE 3002
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD ["node", "-e", "fetch('http://localhost:3002/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "dist/server.js"]
