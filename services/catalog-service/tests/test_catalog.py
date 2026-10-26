from app.seed import CATEGORIES, PRODUCTS


def test_seed_inserts_categories_and_products(client, seeded, user_headers):
    categories = client.get("/catalog/categories", headers=user_headers).json()
    assert len(categories) == len(CATEGORIES) == 5
    page = client.get("/catalog/products?page_size=100", headers=user_headers).json()
    assert page["total"] == len(PRODUCTS) >= 15


def test_seed_is_idempotent(seeded):
    from app.seed import seed_if_empty

    assert seed_if_empty(seeded) is False


# --- lecture / filtres ---


def test_list_pagination(client, seeded, user_headers):
    first = client.get("/catalog/products?page=1&page_size=5", headers=user_headers).json()
    second = client.get("/catalog/products?page=2&page_size=5", headers=user_headers).json()
    assert len(first["items"]) == 5
    assert first["total"] == len(PRODUCTS)
    assert {p["id"] for p in first["items"]}.isdisjoint({p["id"] for p in second["items"]})


def test_filter_by_category(client, seeded, user_headers):
    res = client.get("/catalog/products?category=sport", headers=user_headers).json()
    assert res["total"] == 3
    categories = {
        c["slug"]: c["id"] for c in client.get("/catalog/categories", headers=user_headers).json()
    }
    assert all(p["category_id"] == categories["sport"] for p in res["items"])


def test_unknown_category_returns_empty(client, seeded, user_headers):
    res = client.get("/catalog/products?category=nope", headers=user_headers).json()
    assert res["total"] == 0


def test_search_is_case_insensitive(client, seeded, user_headers):
    res = client.get("/catalog/products?search=CASQUE", headers=user_headers).json()
    names = [p["name"] for p in res["items"]]
    assert "Casque Bluetooth" in names
    assert all("casque" in (p["name"] + p["description"]).lower() for p in res["items"])


def test_search_and_category_combined(client, seeded, user_headers):
    res = client.get("/catalog/products?category=mode&search=casquette", headers=user_headers)
    assert [p["name"] for p in res.json()["items"]] == ["Casquette"]


def test_invalid_pagination_is_422(client, seeded, user_headers):
    assert client.get("/catalog/products?page=0", headers=user_headers).status_code == 422
    assert client.get("/catalog/products?page_size=1000", headers=user_headers).status_code == 422


def test_get_product(client, seeded, user_headers):
    res = client.get("/catalog/products/1", headers=user_headers)
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body["price"], float) and "stock" in body
    assert client.get("/catalog/products/9999", headers=user_headers).status_code == 404


# --- CRUD admin ---


def test_admin_creates_product(client, seeded, admin_headers, user_headers):
    body = {"name": "Café moulu", "price": 7.5, "stock": 10, "category_id": 1}
    res = client.post("/catalog/products", json=body, headers=admin_headers)
    assert res.status_code == 201
    created = res.json()
    assert created["slug"] == "cafe-moulu"
    assert created["price"] == 7.5 and created["is_active"] is True
    assert client.get(f"/catalog/products/{created['id']}", headers=user_headers).status_code == 200


def test_duplicate_names_get_unique_slugs(client, seeded, admin_headers):
    body = {"name": "Casquette", "price": 10}
    res = client.post("/catalog/products", json=body, headers=admin_headers)
    assert res.json()["slug"] == "casquette-2"


def test_create_validation(client, seeded, admin_headers):
    post = lambda body: client.post("/catalog/products", json=body, headers=admin_headers)  # noqa: E731
    assert post({"name": "", "price": 1}).status_code == 422
    assert post({"name": "X", "price": -1}).status_code == 422
    assert post({"name": "X", "price": 1, "stock": -3}).status_code == 422
    assert post({"name": "X", "price": 1, "category_id": 999}).status_code == 422


def test_admin_updates_product(client, seeded, admin_headers):
    res = client.put(
        "/catalog/products/1", json={"price": 12.34, "stock": 3}, headers=admin_headers
    )
    assert res.status_code == 200
    assert res.json()["price"] == 12.34 and res.json()["stock"] == 3
    assert res.json()["name"] == "Casque Bluetooth"  # champ non fourni : inchangé
    assert client.put("/catalog/products/9999", json={}, headers=admin_headers).status_code == 404


def test_admin_delete_is_soft(client, seeded, admin_headers, user_headers):
    assert client.delete("/catalog/products/1", headers=admin_headers).status_code == 204
    assert client.get("/catalog/products/1", headers=user_headers).status_code == 404
    ids = [
        p["id"]
        for p in client.get("/catalog/products?page_size=100", headers=user_headers).json()["items"]
    ]
    assert 1 not in ids
    # la ligne existe toujours en base
    from app.models import Product

    assert seeded.get(Product, 1).is_active is False
    assert client.delete("/catalog/products/9999", headers=admin_headers).status_code == 404


def test_admin_creates_category(client, seeded, admin_headers, user_headers):
    res = client.post("/catalog/categories", json={"name": "Jardin"}, headers=admin_headers)
    assert res.status_code == 201 and res.json()["slug"] == "jardin"
    slugs = [c["slug"] for c in client.get("/catalog/categories", headers=user_headers).json()]
    assert "jardin" in slugs
    dup = client.post("/catalog/categories", json={"name": "Jardin"}, headers=admin_headers)
    assert dup.status_code == 409
