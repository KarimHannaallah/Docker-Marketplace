-- un schéma par service ; exécuté au premier démarrage de postgres (/docker-entrypoint-initdb.d).
-- pas de clé étrangère entre schémas : les services se parlent uniquement en HTTP.

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS orders;

-- auth-service
CREATE TABLE IF NOT EXISTS auth.users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(10)  NOT NULL DEFAULT 'STANDARD'
                  CHECK (role IN ('STANDARD', 'ADMIN')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Tokens révoqués (logout réel côté serveur) ; on garde expires_at pour pouvoir purger.
CREATE TABLE IF NOT EXISTS auth.revoked_tokens (
    jti        VARCHAR(64) PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL
);

-- catalog-service
CREATE TABLE IF NOT EXISTS catalog.categories (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS catalog.products (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200)  NOT NULL,
    slug        VARCHAR(200)  NOT NULL UNIQUE,
    description TEXT          NOT NULL DEFAULT '',
    price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    stock       INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url   VARCHAR(500),
    is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
    category_id INTEGER REFERENCES catalog.categories(id),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON catalog.products(category_id);

-- order-service : user_id et product_id viennent d'autres services, donc pas de clé étrangère
CREATE TABLE IF NOT EXISTS orders.cart_items (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER     NOT NULL,
    product_id INTEGER     NOT NULL,
    quantity   INTEGER     NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders.orders (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER       NOT NULL,
    status     VARCHAR(10)   NOT NULL DEFAULT 'PENDING'
               CHECK (status IN ('PENDING', 'PAID', 'CANCELED')),
    total      NUMERIC(10,2) NOT NULL CHECK (total >= 0),
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders.orders(user_id);

CREATE TABLE IF NOT EXISTS orders.order_items (
    id                SERIAL PRIMARY KEY,
    order_id          INTEGER       NOT NULL REFERENCES orders.orders(id) ON DELETE CASCADE,
    product_id        INTEGER       NOT NULL,
    quantity          INTEGER       NOT NULL CHECK (quantity > 0),
    price_at_purchase NUMERIC(10,2) NOT NULL CHECK (price_at_purchase >= 0),
    UNIQUE (order_id, product_id)
);
