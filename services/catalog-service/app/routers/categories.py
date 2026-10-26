from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Category
from app.schemas import CategoryCreate, CategoryOut
from app.security import get_current_user, require_admin
from app.slugs import slugify

router = APIRouter(prefix="/catalog/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut], dependencies=[Depends(get_current_user)])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(Category).order_by(Category.name)).all()


@router.post("", response_model=CategoryOut, status_code=201, dependencies=[Depends(require_admin)])
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    slug = slugify(body.slug or body.name)
    if db.scalar(select(Category).where(Category.slug == slug)):
        raise HTTPException(409, "Une catégorie avec ce slug existe déjà")
    category = Category(name=body.name.strip(), slug=slug)
    db.add(category)
    db.commit()
    return category
