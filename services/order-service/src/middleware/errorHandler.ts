import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../errors';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
};

// Express 5 transmet automatiquement les erreurs (même async) à ce middleware.
// Les 4 paramètres sont obligatoires pour qu'Express reconnaisse un middleware d'erreur.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'JSON invalide' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Erreur interne' });
};
