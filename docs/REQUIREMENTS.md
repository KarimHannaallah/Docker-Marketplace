# Exigences du sujet → où elles sont satisfaites

Ce document relie chaque exigence du sujet au fichier (ou au job CI) qui la satisfait, avec la manière de la vérifier.
Les chemins sont relatifs à la racine du dépôt.

## 1. Architecture et conteneurs

| Exigence | Où elle est satisfaite | Comment le vérifier |
|---|---|---|
| 1 frontend web + 3 backends, chacun dans son conteneur | [docker-compose.yml](../docker-compose.yml) : services `frontend`, `auth-service`, `catalog-service`, `order-service` (+ `db`). Un Dockerfile par partie : [frontend](../frontend/Dockerfile), [auth](../services/auth-service/Dockerfile), [catalog](../services/catalog-service/Dockerfile), [order](../services/order-service/Dockerfile) | `docker compose ps` : 5 conteneurs `healthy` |
| Au moins 2 langages (Node.js et Python) | Node.js 24 + TypeScript : [auth-service](../services/auth-service/), [order-service](../services/order-service/) ; Python 3.12 + FastAPI : [catalog-service](../services/catalog-service/) | `FROM node:24-alpine` et `FROM python:3.12-slim` dans les Dockerfiles |
| Frontend sans état : aucune session côté serveur, JWT côté client | JWT conservé dans le navigateur : [frontend/src/api/client.ts](../frontend/src/api/client.ts) (`tokenStore`, header `Authorization`) et [AuthProvider.tsx](../frontend/src/auth/AuthProvider.tsx). Le serveur du frontend est un nginx qui ne sert que des fichiers statiques : [frontend/nginx.conf](../frontend/nginx.conf) | Aucun cookie de session ; recharger la page garde la connexion grâce au token local |
| Backends = API HTTP REST | Routes Express : [authRoutes.ts](../services/auth-service/src/routes/authRoutes.ts), [adminRoutes.ts](../services/auth-service/src/routes/adminRoutes.ts), [orderRoutes.ts](../services/order-service/src/routes/orderRoutes.ts) ; routes FastAPI : [products.py](../services/catalog-service/app/routers/products.py), [categories.py](../services/catalog-service/app/routers/categories.py) | Liste des endpoints dans le [README](../README.md#endpoints) |
| Base SQL (PostgreSQL) pour les données persistantes | Service `db` (image `postgres:16-alpine`) dans [docker-compose.yml](../docker-compose.yml), schéma dans [db/init/01_schemas.sql](../db/init/01_schemas.sql) (schémas `auth`, `catalog`, `orders`), volume `db-data` | Les données survivent à `docker compose restart` |
| Seul le frontend est joignable par les clients ; backends et base non exposés | [docker-compose.yml](../docker-compose.yml) : **seul** `frontend` a une section `ports` ; le réseau `backend` est `internal: true`. Routage par [frontend/nginx.conf](../frontend/nginx.conf) (`/api/auth`, `/api/admin`, `/api/catalog`, `/api/orders`) | `curl localhost:3001/health` échoue ; `docker compose ps` n'affiche un port publié que pour `frontend` |
| Chaque backend a des tests unitaires | [auth-service/tests](../services/auth-service/tests/) (19 tests), [order-service/tests](../services/order-service/tests/) (20 tests), [catalog-service/tests](../services/catalog-service/tests/) (28 tests) | `npm test` / `pytest` ; jobs CI `Node (...)` et `Python (catalog-service)` |

## 2. Comptes et droits

| Exigence | Où elle est satisfaite | Comment le vérifier |
|---|---|---|
| Création de compte | `POST /auth/register` : [authRoutes.ts](../services/auth-service/src/routes/authRoutes.ts), [authService.ts](../services/auth-service/src/services/authService.ts) ; page [Register.tsx](../frontend/src/pages/Register.tsx) | Test « crée un compte STANDARD sans exposer le hash » |
| Login | `POST /auth/login` (JWT HS256) ; page [Login.tsx](../frontend/src/pages/Login.tsx) | Tests du bloc `login` |
| Logout (réel, côté serveur) | `POST /auth/logout` révoque le `jti` : [pgTokenRepository.ts](../services/auth-service/src/repositories/pgTokenRepository.ts), table `auth.revoked_tokens` ; côté interface : [AuthProvider.tsx](../frontend/src/auth/AuthProvider.tsx) appelle `/api/auth/logout` puis efface le token | Test « révoque le token : il est refusé ensuite » |
| Comptes STANDARD et ADMIN | Colonne `role` de `auth.users` ([01_schemas.sql](../db/init/01_schemas.sql)) ; l'admin est créé par le seed `ensureAdmin()` ([authService.ts](../services/auth-service/src/services/authService.ts)) à partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Test « le seed est idempotent » ; l'inscription ignore tout rôle demandé |
| Tout utilisateur peut supprimer son compte | `DELETE /auth/me` ; bouton « Supprimer mon compte » dans [Profile.tsx](../frontend/src/pages/Profile.tsx) | Test du bloc « suppression de son propre compte » |
| Un ADMIN peut supprimer un compte STANDARD, jamais un ADMIN | `DELETE /admin/users/:id` : 204 pour un STANDARD, **403 si la cible est ADMIN**, 404 si absente ([authService.ts](../services/auth-service/src/services/authService.ts), `deleteUserAsAdmin`) ; interface : [AdminUsers.tsx](../frontend/src/pages/admin/AdminUsers.tsx) (pas de bouton sur un ADMIN) | Tests du bloc « droits administrateur » (401, 403, 204, 404) |
| Pas de MFA ni d'email de validation | Non implémentés volontairement : l'inscription crée le compte et connecte directement | Aucun envoi de mail dans le code |

## 3. Accès aux pages

| Exigence | Où elle est satisfaite | Comment le vérifier |
|---|---|---|
| Avant login : seulement l'accueil et login/inscription ; le reste redirige vers `/login` | [App.tsx](../frontend/src/App.tsx) : seules `/`, `/login`, `/register` sont hors de `<ProtectedRoute />` ; garde dans [RouteGuards.tsx](../frontend/src/auth/RouteGuards.tsx) | Ouvrir `/catalog` sans être connecté : retour sur `/login` |
| Une fois loggé : catalogue, panier, commandes, paiement simulé | Pages [Catalog](../frontend/src/pages/Catalog.tsx), [ProductDetail](../frontend/src/pages/ProductDetail.tsx), [Cart](../frontend/src/pages/Cart.tsx), [Checkout](../frontend/src/pages/Checkout.tsx), [Orders](../frontend/src/pages/Orders.tsx), [OrderDetail](../frontend/src/pages/OrderDetail.tsx) | Parcours complet : catalogue → panier → paiement → commande |
| Administration visible seulement pour ADMIN | `AdminRoute` dans [RouteGuards.tsx](../frontend/src/auth/RouteGuards.tsx) (redirection vers `/`) ; lien masqué dans [Layout.tsx](../frontend/src/components/Layout.tsx) ; côté serveur, `requireAdmin` ([auth.ts](../services/auth-service/src/middleware/auth.ts)) et `require_admin` ([security.py](../services/catalog-service/app/security.py)) | Un compte STANDARD sur `/admin` retourne à `/` ; l'API répond 403 |
| Les protections sont aussi côté serveur | Toutes les routes catalogue et commandes exigent un JWT valide : [security.py](../services/catalog-service/app/security.py), [order-service middleware/auth.ts](../services/order-service/src/middleware/auth.ts) | Tests « 401 sans token » dans chaque service |

## 4. Règles transverses

| Exigence | Où elle est satisfaite | Comment le vérifier |
|---|---|---|
| JWT HS256 signé par auth-service avec `JWT_SECRET` (payload `sub`, `role`, `jti`, `exp`) | Signature : `login()` dans [authService.ts](../services/auth-service/src/services/authService.ts) | Décoder un token sur jwt.io |
| catalog-service et order-service vérifient eux-mêmes le JWT avec le même secret | [security.py](../services/catalog-service/app/security.py) (PyJWT) et [order-service middleware/auth.ts](../services/order-service/src/middleware/auth.ts) (jsonwebtoken) ; `JWT_SECRET` passé aux 3 services dans [docker-compose.yml](../docker-compose.yml) | Tests 401 sans token, avec un token falsifié, expiré ou signé avec un autre secret (`orders.test.ts`, `test_auth.py`) |
| Appel à `GET http://auth-service:3001/auth/verify` uniquement pour la révocation | `check_not_revoked()` dans [security.py](../services/catalog-service/app/security.py) ; [tokenVerifier.ts](../services/order-service/src/clients/tokenVerifier.ts) ; route `/auth/verify` dans [authRoutes.ts](../services/auth-service/src/routes/authRoutes.ts) | Tests « 401 si le token a été révoqué (logout) » |
| order-service lit prix et stock via `GET http://catalog-service:8000/catalog/products/:id`, jamais par la base | [catalogClient.ts](../services/order-service/src/clients/catalogClient.ts) (client HTTP injectable) ; les tables `catalog.*` ne sont jamais interrogées par order-service ([repositories](../services/order-service/src/repositories/)) | Tests « crée une commande PAID avec le prix du catalogue » |
| Toute la config passe par des variables d'environnement, `.env.example` à la racine | [.env.example](../.env.example) ; lecture dans [auth config.ts](../services/auth-service/src/config.ts), [order config.ts](../services/order-service/src/config.ts), [catalog config.py](../services/catalog-service/app/config.py) ; [docker-compose.yml](../docker-compose.yml) (`${VAR:?message}`) | Supprimer une variable obligatoire : compose refuse de démarrer |
| Chaque service expose `GET /health` | [auth app.ts](../services/auth-service/src/app.ts), [order app.ts](../services/order-service/src/app.ts), [catalog main.py](../services/catalog-service/app/main.py) ; utilisé par les `HEALTHCHECK` des Dockerfiles | `docker compose ps` affiche `healthy` |

## 5. Modèle de données

| Table | Définition |
|---|---|
| `auth.users`, `auth.revoked_tokens` | [db/init/01_schemas.sql](../db/init/01_schemas.sql) ; accès : [pgUserRepository.ts](../services/auth-service/src/repositories/pgUserRepository.ts), [pgTokenRepository.ts](../services/auth-service/src/repositories/pgTokenRepository.ts) |
| `catalog.categories`, `catalog.products` | [01_schemas.sql](../db/init/01_schemas.sql) ; modèles : [models.py](../services/catalog-service/app/models.py) ; seed : [seed.py](../services/catalog-service/app/seed.py) (5 catégories, 16 produits si la table est vide) |
| `orders.cart_items`, `orders.orders`, `orders.order_items` | [01_schemas.sql](../db/init/01_schemas.sql) ; accès : [pgCartRepository.ts](../services/order-service/src/repositories/pgCartRepository.ts), [pgOrderRepository.ts](../services/order-service/src/repositories/pgOrderRepository.ts) |

## 6. Intégration continue et livraison

| Exigence | Où elle est satisfaite (job CI) |
|---|---|
| Déclenchement sur `push` (toutes les branches `'**'` et tous les tags `'*'`) et `pull_request` | Bloc `on:` de [ci.yml](../.github/workflows/ci.yml) |
| Tests et lint des 2 services Node (matrice) | Job `node-services` (matrice `auth-service`, `order-service`) : `npm run lint`, `npm test`, `npm run build` |
| Tests et ruff du service Python | Job `python-service` : `ruff check .`, `pytest` |
| Lint et build du frontend | Job `frontend` : `npm run lint`, `npm run build` |
| hadolint sur les 4 Dockerfiles | Job `hadolint` (matrice des 4 Dockerfiles) |
| Validation de `docker compose config` | Job `compose` |
| Job `docker` en matrice sur les 4 images, dépendant de tous les jobs précédents | Job `docker` : `needs: [node-services, python-service, frontend, hadolint, compose, gitleaks]` |
| Build et push sur GHCR `ghcr.io/<owner>/<repo>/<service>` en minuscules | Étape « Nom d'image en minuscules » puis « Build et push » du job `docker` |
| Tag `sha-<short sha>` à chaque commit ; nom du tag git sur un push de tag ; `latest` sur `main` uniquement | Étape « Tags et labels » (`docker/metadata-action`) |
| Pas de push sur `pull_request` | Variable `PUSH` du job `docker` : `github.event_name != 'pull_request'` (connexion à GHCR et `push:` conditionnés) |
| Aucun `continue-on-error` : la moindre erreur fait échouer le pipeline | Aucune occurrence dans [ci.yml](../.github/workflows/ci.yml) ni [codeql.yml](../.github/workflows/codeql.yml) |

## 7. Bonus sécurité

| Exigence | Où elle est satisfaite |
|---|---|
| Scan Trivy de chaque image, échec si vulnérabilité CRITICAL corrigeable | Étape « Scan Trivy » du job `docker` : `--severity CRITICAL --ignore-unfixed --exit-code 1`, exécutée **avant** la publication |
| Job gitleaks | Job `gitleaks` de [ci.yml](../.github/workflows/ci.yml) (historique complet) ; configuration : [.gitleaks.toml](../.gitleaks.toml) |
| Workflow CodeQL (JavaScript et Python) | [codeql.yml](../.github/workflows/codeql.yml) (matrice `javascript-typescript`, `python`) |
