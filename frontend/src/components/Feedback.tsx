// Petits composants d'état partagés par toutes les pages.
export function Loading() {
  return <p className="muted center">Chargement…</p>;
}

export function ErrorMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="alert alert-error" role="alert">
      {message}
    </p>
  );
}

export function SuccessMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="alert alert-success" role="status">
      {message}
    </p>
  );
}
