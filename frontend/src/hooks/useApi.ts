import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../api/client';

interface State<T> {
  data?: T;
  error?: string;
  loading: boolean;
}

/**
 * Charge des données au montage et quand `deps` change.
 * Pendant un rechargement on garde les anciennes données affichées (pas de clignotement).
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<State<T>>({ loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetcher().then(
      (data) => !cancelled && setState({ data, loading: false }),
      (error) => !cancelled && setState({ error: errorMessage(error), loading: false }),
    );
    return () => {
      cancelled = true;
    };
    // `fetcher` est recréé à chaque rendu : seules `deps` et `version` déclenchent un rechargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
