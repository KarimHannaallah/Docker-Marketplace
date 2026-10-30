# Docker Marketplace

Mini-marketplace en micro-services, réalisé pour le projet « Dév avec Docker ».
Les clients parcourent un catalogue, remplissent un panier et passent une commande (paiement simulé).
Chaque partie de l'application tourne dans son propre conteneur.

| Partie | Technologie | Rôle |
|---|---|---|
| `frontend` | React 18, Vite, TypeScript, React Router, servi par nginx (sans droits root) | Interface web, **seul point d'entrée** (reverse proxy) |
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
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX` | `900000` (15 min), `100`, `10` | `auth-service` : limitation du débit par IP (fenêtre en millisecondes ; requêtes max sur toutes les routes ; requêtes max sur `POST /auth/register` et `POST /auth/login`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | `admin@example.com`, `change-me-admin`, `Administrateur` | `auth-service` (seed de l'admin, sans effet s'il existe déjà) |
| `COMPOSE_PROJECT_NAME` | `marketplace` | Compose : préfixe des conteneurs, réseaux et volumes (distinct par environnement, voir « Environnements ») |
| `FRONTEND_PORT` | `8080` | `docker-compose.yml` (seul port publié) |
| `DB_`, `AUTH_`, `CATALOG_`, `ORDER_`, `FRONTEND_` + `CPU_LIMIT`, `MEM_LIMIT`, `CPU_RESERVATION`, `MEM_RESERVATION` | voir `.env.example` | `docker-compose.yml` (plafond et minimum garanti de CPU et de mémoire par conteneur) |
| `POSTGRES_HOST`, `POSTGRES_PORT` | `db`, `5432` | information : non lues par compose |
| `AUTH_PORT`, `CATALOG_PORT`, `ORDER_PORT` | `3001`, `8000`, `3002` | développement local sans Docker. Dans Docker, les ports sont fixés par les images |
| `AUTH_SERVICE_URL`, `CATALOG_SERVICE_URL` | `http://auth-service:3001`, `http://catalog-service:8000` | développement local ; `docker-compose.yml` fixe ces valeurs lui-même |

Compose refuse de démarrer si une variable obligatoire manque, avec un message qui nomme la variable.

## Environnements

Le même `docker-compose.yml` sert à quatre environnements. Chacun a son fichier modèle, qui change
seulement des variables : nom de projet, port, base de données, secrets, durée des tokens et ressources.

| Environnement | Fichier modèle | Projet Compose | Port | Durée du JWT | Ressources | Base PostgreSQL |
|---|---|---|---|---|---|---|
| Développement (défaut) | `.env.example` | `marketplace` | 8080 | 1h | moyennes | `marketplace` |
| **TEST** | `.env.test.example` | `marketplace-test` | **8081** | **8h** | basses | `marketplace_test` |
| **UAT** | `.env.uat.example` | `marketplace-uat` | **8082** | **2h** | moyennes | `marketplace_uat` |
| **PROD** | `.env.prod.example` | `marketplace-prod` | **80** | **30m** | hautes | `marketplace_prod` |

Limites de ressources par conteneur (CPU / mémoire) :

| Service | TEST (basses) | UAT (moyennes) | PROD (hautes) |
|---|---|---|---|
| db | 0,5 / 256 Mo | 1 / 512 Mo | 2 / 1 Go |
| auth, catalog, order | 0,25 / 192 Mo | 0,5 / 256 Mo | 1 / 512 Mo |
| frontend | 0,1 / 64 Mo | 0,25 / 128 Mo | 0,5 / 256 Mo |

**Utilisation** : copiez le modèle (la copie est ignorée par git) et donnez-le à Compose avec `--env-file` :

```bash
cp .env.test.example .env.test
cp .env.uat.example  .env.uat

docker compose --env-file .env.test up -d --build    # http://localhost:8081
docker compose --env-file .env.uat  up -d --build    # http://localhost:8082, en même temps que TEST

docker compose --env-file .env.test ps               # état de TEST
docker compose --env-file .env.test down -v          # arrête TEST et efface ses données
```

Passez **toujours** `--env-file` (y compris pour `ps`, `logs` et `down`) : sans lui, Compose lit `.env` et cible
l'environnement de développement.

**Pourquoi plusieurs environnements peuvent tourner en même temps** : la variable `COMPOSE_PROJECT_NAME` de chaque
fichier préfixe les conteneurs, les réseaux et le volume (`marketplace-test_db-data`, `marketplace-uat_db-data`).
Ils ont donc chacun leur propre PostgreSQL, leur base et leur port. Les secrets JWT sont différents : un token émis
en TEST est refusé en UAT et en PROD. Les comptes et les données ne sont pas partagés.

**PROD** : toutes les valeurs `CHANGE_ME` de `.env.prod.example` (mot de passe de la base, secret JWT, mot de passe
admin) doivent être remplacées par des secrets générés avant le démarrage, par exemple avec `openssl rand -base64 48`.
Le mot de passe de la base apparaît deux fois (`POSTGRES_PASSWORD` et `DATABASE_URL`) : gardez-les identiques.
Le port 80 doit être libre. Ne commitez jamais `.env.prod`.

## Ressources des conteneurs

Chaque conteneur a une **limite** (plafond qu'il ne peut pas dépasser) et une **réservation** (minimum garanti) de CPU et de
mémoire, définies dans `docker-compose.yml` (`deploy.resources`) et réglables par variables (voir le tableau des variables).
Valeurs par défaut, sans variable :

| Service | Limite CPU | Limite mémoire | Réservation CPU | Réservation mémoire |
|---|---|---|---|---|
| `db` | 1 | 512 Mo | 0,25 | 256 Mo |
| `auth-service`, `catalog-service`, `order-service` | 0,5 | 256 Mo | 0,1 | 128 Mo |
| `frontend` | 0,25 | 128 Mo | 0,05 | 64 Mo |

- **Dépassement de la mémoire** : le conteneur est tué par le noyau (OOM) puis relancé (`restart: unless-stopped`).
  **Dépassement du CPU** : il est ralenti, jamais tué.
- **Mesurer** : `docker stats --no-stream`. La colonne `MEM USAGE / LIMIT` doit afficher les limites ci-dessus
  (256 Mo, 512 Mo, 128 Mo) et non la mémoire totale de la machine.
- **Consommation observée** (pile démarrée) : `db` ≈ 42 Mo, `auth-service` ≈ 75 Mo, `catalog-service` ≈ 83 Mo
  (≈ 111 Mo après 300 requêtes), `order-service` ≈ 22 Mo, `frontend` ≈ 12 Mo. Il reste donc de la marge.
- La limite CPU, la limite mémoire et la réservation mémoire apparaissent dans la configuration du conteneur
  (`docker inspect`). La **réservation CPU** est acceptée par Compose mais n'y apparaît pas (`CpuShares` reste à 0) :
  Docker ne l'applique donc pas sur une seule machine.

## Sécurité des conteneurs

Aucun processus applicatif ne tourne en root :

| Conteneur | Utilisateur du processus | Comment |
|---|---|---|
| `frontend` | `nginx` (uid 101) | image `nginxinc/nginx-unprivileged` : nginx écoute sur le port **8080** du conteneur (un utilisateur sans droits ne peut pas utiliser le port 80). Le port publié sur la machine reste `FRONTEND_PORT` |
| `auth-service`, `order-service` | `node` (uid 1000) | `USER 1000` dans le Dockerfile |
| `catalog-service` | `appuser` (uid 10001) | utilisateur créé dans le Dockerfile puis `USER 10001` |
| `db` | `postgres` | image officielle PostgreSQL |

Vérifier : `docker compose exec frontend id` affiche `uid=101(nginx)`, et `docker compose exec auth-service id -u` affiche `1000`.

Autres protections : les backends et la base ne publient aucun port et vivent sur un réseau Docker interne ;
les Dockerfiles passent **hadolint** ; les images sont scannées par **Trivy** avant publication ;
les secrets sont absents du dépôt (**gitleaks**) et la base de code est analysée par **CodeQL**.

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

**Limitation du débit** : `auth-service` répond **429** (`Too Many Requests`, avec l'en-tête `Retry-After`) au-delà de 100 requêtes
par adresse IP et par 15 minutes, et au-delà de 10 pour `POST /auth/register` et `POST /auth/login`. L'adresse du client est
celle que nginx transmet dans `X-Forwarded-For` (`trust proxy` = 1 : un client ne peut pas la falsifier). `GET /auth/verify`
n'est pas limité quand il est appelé par `catalog-service` et `order-service` (appels directs, sans `X-Forwarded-For`), car
ils l'appellent à chaque requête utilisateur ; il reste limité s'il est appelé depuis l'extérieur.

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

## Tests unitaires et lint

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
  validation de `docker compose config` **pour chaque environnement** (`.env.example`, `.env.test.example`,
  `.env.uat.example`, `.env.prod.example` : le job échoue si une variable obligatoire manque), **gitleaks**
  (secrets dans tout l'historique), puis, si tout est vert, pour chacune des 4 images : build, scan **Trivy**
  (échec s'il reste une vulnérabilité CRITICAL corrigeable), et publication sur GHCR.
- **`fail-fast: true`** sur les matrices Node, hadolint et images : dès qu'un job d'une matrice échoue, les autres sont
  annulés. Aucun `continue-on-error` : la moindre erreur fait échouer le pipeline.
- **`.github/workflows/codeql.yml`** : analyse statique CodeQL (JavaScript/TypeScript et Python).
- Images publiées : `ghcr.io/karimhannaallah/docker-marketplace/<frontend|auth-service|catalog-service|order-service>`.
  Tags : `sha-<7 caractères du commit>` à chaque commit, le nom du tag git sur un push de tag, `latest` sur `main` seulement.
  Rien n'est publié sur une pull request.

## Versionnage

Les versions suivent le versionnage sémantique `vMAJEUR.MINEUR.CORRECTIF` et sont des **tags git** créés à la main sur `main`.

| Version | Contenu |
|---|---|
| **v0.9.0** | Version fonctionnelle complète, avant durcissement : frontend et 3 services, Docker et Compose, CI (tests, lint, hadolint, Trivy, gitleaks, CodeQL) et documentation de base. Le `0.` indique qu'elle n'est pas encore considérée comme finale |
| **v1.0.0** | Version livrée pour la démo : v0.9.0 + limites CPU et mémoire, environnements TEST, UAT et PROD, frontend sans droits root, CI en `fail-fast` avec validation de chaque environnement, documentation complète |

Créer une version, depuis `main` à jour et une fois la CI verte :

```bash
git switch main && git pull
git tag -a v1.0.0 -m "Version 1.0.0"
git push origin v1.0.0
```

Le push du tag lance toute la CI, puis publie les 4 images avec les tags `v1.0.0` et `sha-<commit>` :
`docker pull ghcr.io/karimhannaallah/docker-marketplace/frontend:v1.0.0`.
`latest` suit `main` : un tag ne le modifie pas. Un tag publié ne doit jamais être déplacé ni réutilisé : en cas d'erreur,
on publie un correctif (`v1.0.1`).

## Limites connues

- Le **paiement est simulé** : le formulaire de carte n'envoie rien, la commande passe directement à `PAID`.
- Le **stock n'est pas décrémenté** après une commande : il est seulement vérifié.
- Un seul administrateur existe (celui du seed) : l'inscription crée toujours un compte STANDARD.
- Un produit supprimé par un ADMIN est désactivé et n'apparaît plus dans l'administration : il ne peut pas être réactivé depuis l'interface.
- Le JWT est dans `localStorage` (choix simple pour un frontend sans état, sensible à une faille XSS).

**Limites d'infrastructure et de sécurité**

- **Un seul utilisateur PostgreSQL** : les 3 services se connectent avec le même utilisateur et le même mot de passe
  (`DATABASE_URL`). Les schémas `auth`, `catalog` et `orders` sont séparés, mais pas les droits : un service compromis pourrait
  lire ou modifier les tables des autres. Une version plus sûre donnerait un utilisateur par schéma.
- **Pas de HTTPS** : nginx écoute en HTTP. Le JWT et les mots de passe circulent donc en clair entre le navigateur et le serveur.
  En production, il faudrait un terminateur TLS (certificat) devant nginx.
- **Pas d'orchestrateur** : tout tourne avec Docker Compose sur une seule machine. Il n'y a ni haute disponibilité, ni mise à
  l'échelle automatique, ni déploiement sans interruption. Les environnements TEST, UAT et PROD lancés sur la même machine
  partagent ses ressources et ne sont donc pas réellement isolés.
- **Secrets en variables d'environnement** : ils viennent de fichiers `.env`, et toute personne qui accède à la machine peut les
  lire avec `docker inspect` ou `docker compose config`. Il n'y a ni Docker secrets ni gestionnaire de secrets. Les valeurs
  d'exemple de TEST et d'UAT sont publiques dans le dépôt.
- **Ressources** : les limites sont dimensionnées d'après des mesures sur un petit jeu d'essai (parcours complet et 300 requêtes),
  pas d'après un vrai test de charge.

## Arborescence

```
.
├── docker-compose.yml        Orchestration des 5 conteneurs (seul le frontend publie un port)
├── .env.example              Variables d'environnement (à copier en .env)
├── .env.test.example         Modèles des environnements TEST, UAT et PROD (--env-file)
├── .env.uat.example
├── .env.prod.example
├── .gitleaks.toml            Configuration du scan de secrets
├── .github/workflows/        ci.yml (tests, lint, scans, images) et codeql.yml
├── db/init/01_schemas.sql    Schémas et tables PostgreSQL
├── docs/REQUIREMENTS.md      Exigences du sujet → fichier ou job CI qui les satisfait
├── frontend/                 React + Vite, Dockerfile, nginx.conf (nginx sans droits root, port 8080)
└── services/
    ├── auth-service/         routes / services / repositories, tests Jest
    ├── catalog-service/      routers, models, security, seed, tests pytest
    └── order-service/        routes / services / repositories / clients, tests Jest
```
