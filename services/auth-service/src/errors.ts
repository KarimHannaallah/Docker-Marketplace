// Erreur HTTP lancée par les services, transformée en réponse JSON par le middleware d'erreur.
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
