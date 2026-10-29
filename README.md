# Docker Marketplace

Mini-marketplace en micro-services, réalisé pour le projet « Dév avec Docker ».
Les clients parcourent un catalogue, remplissent un panier et passent une commande (paiement simulé).
Chaque partie de l'application tourne dans son propre conteneur.

| Partie | Technologie | Rôle |
|---|---|---|
| `frontend` | React 18, Vite, TypeScript, React Router, servi par nginx | Interface web, **seul point d'entrée** (reverse proxy) |
| `auth-service` | Node.js 24, Express, TypeScript | Comptes, login/logout, JWT, rôles STANDARD/ADMIN |
| `catalog-service` | Python 3.12, FastAPI, SQLAlchemy | Catégories et produits |
| `order-service` | Node.js 24, Express, TypeScript | Panier persistant, commandes |
| `db` | PostgreSQL 16 | Données (un schéma par service : `auth`, `catalog`, `orders`) |

## Architecture

```
                        Internet / navigateur
                                 │
                          http://localhost:8080
                                 │  (seul port publié)
 ┌───────────────────────────────▼────────────────────────────────────────┐
 │ réseau "frontend"                                                       │
 │                       ┌─────────────────────┐                           │
 │                       │  frontend (nginx)   │  fichiers React (statiques)│
 │                       │  reverse proxy      │  aucune session côté serveur│
 │                       └──────────┬──────────┘                           │
 └──────────────────────────────────┼──────────────────────────────────────┘
 ┌──────────────────────────────────┼──────────────────────────────────────┐
 │ réseau "backend" (interne : aucun accès extérieur)                      │
 │       /api/auth, /api/admin      │       /api/catalog        /api/orders│
 │                 ┌────────────────┼──────────────┐              │       │
 │                 ▼                               ▼              ▼       │
 │        ┌────────────────┐   ◄── /auth/verify ──┌──────────────────┐    │
 │        │  auth-service  │   (révocation, JWT)  │ catalog-service  │    │
 │        │  Node :3001    │◄──────────┐          │ Python :8000     │    │
 │        └───────┬────────┘           │          └────────▲─────────┘    │
 │                │             ┌──────┴─────────┐         │              │
 │                │             │ order-service  │─────────┘              │
 │                │             │ Node :3002     │  GET /catalog/products/:id
 │                │             └──────┬─────────┘  (prix et stock)       │
 │                │                    │                                  │
 │                └────────────┬───────┘                                  │
 │                             ▼                                          │
 │                   ┌───────────────────┐                                │
 │                   │ db (PostgreSQL)   │  schémas : auth / catalog /    │
 │                   │ :5432             │  orders  (volume db-data)      │
 │                   └───────────────────┘                                │
 └─────────────────────────────────────────────────────────────────────────┘
```

**Comment ça marche**
- Le navigateur ne parle qu'à nginx. nginx sert le site React et redirige `/api/...` vers le bon service
  en retirant le préfixe `/api` (ex. `/api/auth/login` → `http://auth-service:3001/auth/login`).
- **Frontend sans état** : le JWT est stocké dans le navigateur (`localStorage`) et envoyé dans le header
  `Authorization: Bearer ...`. Le serveur du frontend ne garde aucune session.
- **JWT HS256** signé par `auth-service` avec `JWT_SECRET` (contenu : `sub`, `role`, `jti`, `exp`).
  `catalog-service` et `order-service` vérifient eux-mêmes signature et expiration avec le même secret.
- **Logout réel** : `POST /auth/logout` met le `jti` du token en liste noire (table `auth.revoked_tokens`).
  Les autres services interrogent `GET http://auth-service:3001/auth/verify` pour savoir si un token est révoqué.
- `order-service` récupère prix et stock via `GET http://catalog-service:8000/catalog/products/:id`,
  jamais en lisant la base du catalogue. Les services ne partagent donc aucune table.

## Lancer l'application (une commande)

Prérequis : Docker et Docker Compose.

```bash
cp .env.example .env
docker compose up --build
```

Ouvrez ensuite **http://localhost:8080**. Au premier démarrage, la base est créée (`db/init/01_schemas.sql`),
l'administrateur est créé et le catalogue est rempli (5 catégories, 16 produits).

Pour tout arrêter et **effacer les données** : `docker compose down -v`.
Les scripts de `db/init` ne s'exécutent qu'à la création du volume : après une modification du schéma, refaites un `down -v`.

## Comptes de test

| Compte | Identifiants | Remarque |
|---|---|---|
| ADMIN | `admin@example.com` / `change-me-admin` | Créé au démarrage depuis `ADMIN_EMAIL` / `ADMIN_PASSWORD` (valeurs de `.env.example`) |
| STANDARD | à créer sur `/register` | Mot de passe de 8 caractères minimum ; connexion automatique après l'inscription |

Il n'y a ni double authentification ni email de validation.

## Variables d'environnement

Elles sont toutes dans `.env.example` (à copier en `.env`, jamais commité).

| Variable | Valeur par défaut | Utilisée par |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `marketplace`, `change-me`, `marketplace` | `db` (création de la base) |
| `DATABASE_URL` | `postgresql://marketplace:change-me@db:5432/marketplace` | les 3 services. **Doit rester cohérente** avec les trois variables ci-dessus |
| `JWT_SECRET` | `change-me-to-a-long-random-string` | les 3 services (signature et vérification). **À changer en production** |
| `JWT_EXPIRES_IN` | `1h` | `auth-service` (durée de vie du token) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | `admin@example.com`, `change-me-admin`, `Administrateur` | `auth-service` (seed de l'admin, sans effet s'il existe déjà) |
| `FRONTEND_PORT` | `8080` | `docker-compose.yml` (seul port publié) |
| `POSTGRES_HOST`, `POSTGRES_PORT` | `db`, `5432` | information : non lues par compose |
| `AUTH_PORT`, `CATALOG_PORT`, `ORDER_PORT` | `3001`, `8000`, `3002` | développement local sans Docker. Dans Docker, les ports sont fixés par les images |
| `AUTH_SERVICE_URL`, `CATALOG_SERVICE_URL` | `http://auth-service:3001`, `http://catalog-service:8000` | développement local ; `docker-compose.yml` fixe ces valeurs lui-même |

Compose refuse de démarrer si une variable obligatoire manque, avec un message qui nomme la variable.

## Endpoints

Chaque service expose `GET /health`. Depuis le navigateur, tous les appels passent par nginx avec le préfixe `/api`
(`/api/auth/...`, `/api/admin/...`, `/api/catalog/...`, `/api/orders/...`). « Token » signifie `Authorization: Bearer <JWT>`.

### auth-service (port 3001)

| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | `/auth/register` | public | Crée un compte STANDARD (`name`, `email`, `password`) → 201 ; 409 si l'email existe |
| POST | `/auth/login` | public | `email`, `password` → `{ token, user }` ; 401 si identifiants faux |
| POST | `/auth/logout` | token | Révoque le token → 204 |
| GET | `/auth/me` | token | Profil de l'utilisateur connecté |
| DELETE | `/auth/me` | token | Supprime son propre compte → 204 |
| GET | `/auth/verify` | token | 200 si le token est valide **et** non révoqué (utilisé par les autres services) |
| GET | `/admin/users` | ADMIN | Liste des utilisateurs |
| DELETE | `/admin/users/:id` | ADMIN | Supprime un compte STANDARD → 204 ; **403 si la cible est ADMIN** ; 404 si absent |

### catalog-service (port 8000)

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/catalog/categories` | token | Liste des catégories |
| POST | `/catalog/categories` | ADMIN | Crée une catégorie → 201 ; 409 si le slug existe |
| GET | `/catalog/products` | token | Produits actifs. Filtres : `category` (slug), `search`, `page`, `page_size` (max 100) → `{ items, total, page, page_size }` |
| GET | `/catalog/products/{id}` | token | Détail d'un produit actif ; 404 s'il est désactivé ou absent |
| POST | `/catalog/products` | ADMIN | Crée un produit → 201 |
| PUT | `/catalog/products/{id}` | ADMIN | Modifie les champs envoyés (mise à jour partielle) |
| DELETE | `/catalog/products/{id}` | ADMIN | Suppression logique (`is_active = false`) → 204 |

### order-service (port 3002)

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/orders/cart` | token | Panier enrichi (nom, prix, stock) avec total |
| POST | `/orders/cart` | token | Ajoute un produit ou incrémente (`productId`, `quantity`, 1 par défaut) ; 409 si stock insuffisant |
| PATCH | `/orders/cart/:productId` | token | Change la quantité ; 404 si le produit n'est pas dans le panier |
| DELETE | `/orders/cart/:productId` | token | Retire une ligne → 204 |
| POST | `/orders/checkout` | token | Vérifie stock et prix auprès du catalogue, crée la commande **PAID** (simulé), vide le panier → 201 ; 409 si un produit pose problème ; 400 si panier vide |
| GET | `/orders` | token | Ses commandes, la plus récente d'abord |
| GET | `/orders/:id` | token | Détail de **sa** commande ; 404 pour la commande d'un autre utilisateur |

Les réponses d'erreur ont la forme `{ "error": "message" }` (services Node) ou `{ "detail": "message" }` (FastAPI).

## Pages du frontend

| Page | Route | Accès |
|---|---|---|
| Accueil | `/` | public |
| Connexion, inscription | `/login`, `/register` | public |
| Catalogue, détail produit | `/catalog`, `/catalog/:id` | connecté |
| Panier, paiement simulé | `/cart`, `/checkout` | connecté |
| Mes commandes, confirmation | `/orders`, `/orders/:id` | connecté |
| Profil (bouton « Supprimer mon compte ») | `/profile` | connecté |
| Administration (utilisateurs et produits) | `/admin` | ADMIN (sinon retour à `/`) |

Hors accueil, connexion et inscription, toute page redirige vers `/login` si l'on n'est pas connecté.

## Développement local (sans conteneurs pour le code)

```bash
# 1. Base de données seule (port 55432 pour ne pas gêner un PostgreSQL local)
docker run -d --name pg-dev -p 55432:5432 -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=marketplace \
  -v "$(pwd)/db/init:/docker-entrypoint-initdb.d:ro" postgres:16-alpine

# 2. Variables communes
export DATABASE_URL=postgresql://postgres:dev@localhost:55432/marketplace
export JWT_SECRET=un-secret-de-dev-assez-long-pour-hs256
export AUTH_SERVICE_URL=http://localhost:3001 CATALOG_SERVICE_URL=http://localhost:8000
export ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=admin-pass-1

# 3. Un terminal par service
cd services/auth-service    && npm ci && npm run dev
cd services/order-service   && npm ci && npm run dev
cd services/catalog-service && python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt \
                            && .venv/bin/uvicorn app.main:app --port 8000
cd frontend                 && npm ci && npm run dev   # http://localhost:5173
```

Le serveur de développement Vite joue le rôle de nginx : il redirige `/api/...` vers les ports locaux
(modifiables avec `DEV_AUTH_URL`, `DEV_CATALOG_URL` et `DEV_ORDER_URL`, voir `frontend/vite.config.ts`).

## Tests et lint

| Partie | Commandes (dans le dossier du service) | Tests |
|---|---|---|
| `auth-service` | `npm run lint`, `npm test`, `npm run build` | 19 (Jest + supertest, repository en mémoire) |
| `order-service` | `npm run lint`, `npm test`, `npm run build` | 20 (Jest + supertest, catalogue et auth simulés) |
| `catalog-service` | `ruff check .`, `pytest` | 28 (pytest + TestClient, SQLite en mémoire) |
| `frontend` | `npm run lint`, `npm run build` | — |

Les tests unitaires n'ont besoin ni de PostgreSQL ni des autres services.

## Intégration continue (GitHub Actions)

- **`.github/workflows/ci.yml`**, sur chaque `push` (toutes les branches et tous les tags) et chaque `pull_request` :
  lint et tests des services, lint et build du frontend, **hadolint** sur les 4 Dockerfiles,
  validation de `docker compose config`, **gitleaks** (secrets dans tout l'historique),
  puis, si tout est vert, pour chacune des 4 images : build, scan **Trivy** (échec s'il reste une
  vulnérabilité CRITICAL corrigeable), et publication sur GHCR.
- **`.github/workflows/codeql.yml`** : analyse statique CodeQL (JavaScript/TypeScript et Python).
- Images publiées : `ghcr.io/karimhannaallah/docker-marketplace/<frontend|auth-service|catalog-service|order-service>`.
  Tags : `sha-<7 caractères du commit>` à chaque commit, le nom du tag git sur un push de tag, `latest` sur `main` seulement.
  Rien n'est publié sur une pull request.

## Limites connues

- Le **paiement est simulé** : le formulaire de carte n'envoie rien, la commande passe directement à `PAID`.
- Le **stock n'est pas décrémenté** après une commande : il est seulement vérifié.
- Un seul administrateur existe (celui du seed) : l'inscription crée toujours un compte STANDARD.
- Un produit supprimé par un ADMIN est désactivé et n'apparaît plus dans l'administration : il ne peut pas être réactivé depuis l'interface.
- Le JWT est dans `localStorage` (choix simple pour un frontend sans état, sensible à une faille XSS) ;
  nginx écoute en HTTP, sans TLS.

## Arborescence

```
.
├── docker-compose.yml        Orchestration des 5 conteneurs (seul le frontend publie un port)
├── .env.example              Variables d'environnement (à copier en .env)
├── .gitleaks.toml            Configuration du scan de secrets
├── .github/workflows/        ci.yml (tests, lint, scans, images) et codeql.yml
├── db/init/01_schemas.sql    Schémas et tables PostgreSQL
├── docs/REQUIREMENTS.md      Exigences du sujet → fichier ou job CI qui les satisfait
├── frontend/                 React + Vite, Dockerfile, nginx.conf
└── services/
    ├── auth-service/         routes / services / repositories, tests Jest
    ├── catalog-service/      routers, models, security, seed, tests pytest
    └── order-service/        routes / services / repositories / clients, tests Jest
```
