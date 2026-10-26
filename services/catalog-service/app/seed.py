"""Données de démonstration : insérées au démarrage uniquement si les tables sont vides."""

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Category, Product
from app.slugs import slugify

CATEGORIES = ["Électronique", "Maison", "Sport", "Livres", "Mode"]

# (nom, catégorie, prix, stock, description)
PRODUCTS = [
    ("Casque Bluetooth", "Électronique", "59.90", 25, "Casque sans fil avec réduction de bruit."),
    ("Enceinte portable", "Électronique", "39.00", 40, "Enceinte étanche, 12 h d'autonomie."),
    ("Clavier mécanique", "Électronique", "89.50", 15, "Clavier compact, switches rouges."),
    ("Souris sans fil", "Électronique", "24.99", 60, "Souris ergonomique rechargeable."),
    ("Lampe de bureau LED", "Maison", "29.90", 30, "Lampe réglable, trois températures."),
    ("Cafetière filtre", "Maison", "45.00", 20, "Cafetière programmable 1,2 L."),
    ("Set de 6 verres", "Maison", "18.50", 50, "Verres en verre trempé."),
    ("Tapis de yoga", "Sport", "22.00", 35, "Tapis antidérapant 6 mm."),
    ("Haltères 2 x 5 kg", "Sport", "34.90", 18, "Paire d'haltères revêtus néoprène."),
    ("Gourde isotherme", "Sport", "16.90", 80, "Inox 750 ml, garde le froid 24 h."),
    ("Apprendre Docker", "Livres", "29.00", 22, "Guide pratique des conteneurs."),
    ("Le Petit Prince", "Livres", "7.50", 100, "Classique d'Antoine de Saint-Exupéry."),
    ("Cahier de notes A5", "Livres", "4.90", 150, "Cent pages à petits carreaux."),
    ("T-shirt coton bio", "Mode", "19.90", 70, "T-shirt unisexe, coton biologique."),
    ("Sweat à capuche", "Mode", "49.90", 28, "Sweat molletonné, coupe ample."),
    ("Casquette", "Mode", "14.90", 45, "Casquette réglable en coton."),
]


def seed_if_empty(db: Session) -> bool:
    """Retourne True si des données ont été insérées."""
    if db.scalar(select(func.count()).select_from(Category)):
        return False

    categories = {name: Category(name=name, slug=slugify(name)) for name in CATEGORIES}
    db.add_all(categories.values())
    db.flush()  # attribue les ids

    for name, category, price, stock, description in PRODUCTS:
        slug = slugify(name)
        db.add(
            Product(
                name=name,
                slug=slug,
                description=description,
                price=Decimal(price),
                stock=stock,
                image_url=f"https://picsum.photos/seed/{slug}/400/300",
                category_id=categories[category].id,
            )
        )
    db.commit()
    return True
