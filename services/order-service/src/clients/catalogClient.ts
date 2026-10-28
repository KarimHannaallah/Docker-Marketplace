// Client HTTP vers catalog-service (réseau interne). Injectable : les tests utilisent un faux client.
import { HttpError } from '../errors';

export interface CatalogProduct {
  id: number;
  name: string;
  price: number;
  stock: number;
  image_url: string | null;
}

export interface CatalogClient {
  /** Retourne null si le produit n'existe pas (ou n'est plus actif). */
  getProduct(id: number, token: string): Promise<CatalogProduct | null>;
}

export class HttpCatalogClient implements CatalogClient {
  constructor(private readonly baseUrl: string) {}

  async getProduct(id: number, token: string): Promise<CatalogProduct | null> {
    let response: Response;
    try {
      // On transmet le JWT de l'utilisateur : catalog-service protège toutes ses routes.
      response = await fetch(`${this.baseUrl}/catalog/products/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      throw new HttpError(503, 'Catalogue indisponible');
    }
    if (response.status === 404) return null;
    if (!response.ok) throw new HttpError(502, 'Réponse inattendue du catalogue');

    const p = (await response.json()) as CatalogProduct;
    return { id: p.id, name: p.name, price: Number(p.price), stock: p.stock, image_url: p.image_url };
  }
}
