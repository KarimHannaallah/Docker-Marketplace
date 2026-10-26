"""Schémas Pydantic : validation des entrées et forme des réponses JSON."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str | None = Field(default=None, max_length=100)  # généré depuis le nom si absent


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    price: float = Field(ge=0, le=99_999_999)
    stock: int = Field(default=0, ge=0)
    image_url: str | None = Field(default=None, max_length=500)
    is_active: bool = True
    category_id: int | None = None


class ProductUpdate(BaseModel):
    """PUT : seuls les champs fournis sont modifiés."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    price: float | None = Field(default=None, ge=0, le=99_999_999)
    stock: int | None = Field(default=None, ge=0)
    image_url: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None
    category_id: int | None = None


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str
    price: float
    stock: int
    image_url: str | None
    is_active: bool
    category_id: int | None
    created_at: datetime
    updated_at: datetime


class ProductPage(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    page_size: int
