// client HTTP unique : ajoute le header Authorization et gère les 401 (session expirée ou révoquée).
// le frontend est sans état : le JWT n'existe que dans le navigateur.

const TOKEN_KEY = 'marketplace_token';

// localStorage peut être indisponible (navigation privée...) : on ne plante pas.
export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignoré */
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignoré */
    }
  },
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;

/** Enregistré par AuthProvider : appelé quand le serveur répond 401 à un utilisateur connecté. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** false pour login/register : pas de token, et un 401 y signifie « mauvais identifiants ». */
  auth?: boolean;
}

/** Extrait un message lisible des formats d'erreur des services ({error} Node, {detail} FastAPI). */
function extractMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const { error, detail } = data as { error?: unknown; detail?: unknown };
    if (typeof error === 'string') return error;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return 'Données invalides';
  }
  return fallback;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const headers: Record<string, string> = {};
  const token = auth ? tokenStore.get() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Serveur injoignable, réessayez plus tard');
  }

  if (response.status === 401 && token) {
    // Token expiré, révoqué ou compte supprimé : on oublie la session.
    tokenStore.clear();
    onUnauthorized?.();
  }

  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, extractMessage(data, response.statusText));
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur est survenue';
}
