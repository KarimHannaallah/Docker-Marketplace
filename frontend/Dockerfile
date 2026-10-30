# Image en 2 étapes : Node compile le site, nginx sert les fichiers statiques et fait reverse proxy.

# --- Étape 1 : build Vite (produit le dossier dist/) ---
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm run build

# --- Étape 2 : nginx ne contient que dist/ et sa configuration (aucun Node dans l'image finale) ---
# Variante "unprivileged" d'nginx : le processus tourne avec un utilisateur sans droits (uid 101),
# pas en root. Il ne peut donc pas écouter sur un port < 1024 : il écoute sur 8080.
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
# Seule l'installation des correctifs a besoin de root (uid 0) : on repasse ensuite à l'utilisateur sans droits.
USER 0
# Applique les correctifs de sécurité Alpine parus depuis la publication de l'image de base
# (sinon une faille déjà corrigée en amont reste présente et fait échouer le scan Trivy).
RUN apk upgrade --no-cache
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER 101

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD ["wget", "-q", "--spider", "http://127.0.0.1:8080/"]

  