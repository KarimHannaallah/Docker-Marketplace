from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category, Product
from app.schemas import ProductCreate, ProductOut, ProductPage, ProductUpdate
from app.security import get_current_user, require_admin
from app.slugs import slugify

router = APIRouter(prefix="/catalog/products", tags=["products"])


def unique_slug(db: Session, name: str) -> str:
    """slug du nom, suffixé -2, -3... s'il existe déjà."""
    base = slugify(name)
    slug, n = base, 1
    while db.scalar(select(Product.id).where(Product.slug == slug)):
        n += 1
        slug = f"{base}-{n}"
    return slug


def check_category(db: Session, category_id: int | None) -> None:
    if category_id is not None and db.get(Category, category_id) is None:
        raise HTTPException(422, "Catégorie inexistante")


@router.get("", response_model=ProductPage, dependencies=[Depends(get_current_user)])
def list_products(
    category: str | None = Query(None, description="slug de la catégorie"),
    search: str | None = Query(None, description="recherche dans le nom et la description"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = select(Product).where(Product.is_active.is_(True))
    if category:
        query = query.join(Category).where(Category.slug == category)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(or_(Product.name.ilike(pattern), Product.description.ilike(pattern)))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(
        query.order_by(Product.id).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return ProductPage(items=items, total=total, page=page, page_size=page_size)


@router.get("/{product_id}", response_model=ProductOut, dependencies=[Depends(get_current_user)])
def get_product(product_id: int, db: Session = Depends(get_db)):
    # Utilisé aussi par order-service pour connaître prix et stock.
    product = db.get(Product, product_id)
    if product is None or not product.is_active:
        raise HTTPException(404, "Produit introuvable")
    return product


@router.post("", response_model=ProductOut, status_code=201, dependencies=[Depends(require_admin)])
def create_product(body: ProductCreate, db: Session = Depends(get_db)):
    check_category(db, body.category_id)
    data = body.model_dump()
    data["price"] = Decimal(str(data["price"]))
    product = Product(**data, slug=unique_slug(db, body.name))
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductOut, dependencies=[Depends(require_admin)])
def update_product(product_id: int, body: ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(404, "Produit introuvable")

    changes = body.model_dump(exclude_unset=True)
    if "category_id" in changes:
        check_category(db, changes["category_id"])
    if changes.get("price") is not None:
        changes["price"] = Decimal(str(changes["price"]))
    for field, value in changes.items():
        # name/price/stock/is_active ne peuvent pas être mis à null
        if value is None and field in {"name", "price", "stock", "is_active", "description"}:
            continue
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=204, dependencies=[Depends(require_admin)])
def delete_product(product_id: int, db: Session = Depends(get_db)):
    # Suppression logique : on garde la ligne pour l'historique des commandes.
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(404, "Produit introuvable")
    product.is_active = False
    db.commit()
    return Response(status_code=204)
