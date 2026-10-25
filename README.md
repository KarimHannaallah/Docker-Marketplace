# Docker Marketplace

Projet scolaire « Dév avec Docker » : un mini-marketplace en micro-services.
Chaque partie tourne dans son propre conteneur ; seul le frontend est exposé aux clients,
les backends et la base PostgreSQL restent sur le réseau interne.

## Arborescence

```
.
├── frontend/                 React 18 + Vite + TypeScript (servi par nginx, reverse proxy /api/*)
├── services/
│   ├── auth-service/         Node 24 + Express + TypeScript : comptes, JWT, rôles
│   ├── catalog-service/      Python 3.12 + FastAPI : catégories et produits
│   └── order-service/        Node 24 + Express + TypeScript : panier et commandes
├── db/
│   └── init/                 Scripts SQL d'initialisation PostgreSQL (schémas auth, catalog, orders)
├── .env.example              Variables d'environnement (à copier en .env)
├── .editorconfig
└── .gitignore
```

> README complet (architecture, lancement, endpoints) : voir l'étape documentation.
