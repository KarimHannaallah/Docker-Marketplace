import { createContext } from 'react';
import type { User } from '../api/types';

export interface AuthState {
  user: User | null;
  /** true tant qu'on vérifie auprès du serveur qu'un token déjà stocké est encore valide */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);
