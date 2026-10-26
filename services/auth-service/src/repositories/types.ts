// Interfaces des repositories : le service ne connaît que ces contrats,
// ce qui permet d'injecter une implémentation en mémoire dans les tests.
export type Role = 'STANDARD' | 'ADMIN';

export interface User {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
}

export interface NewUser {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

export interface UserRepository {
  create(user: NewUser): Promise<User>;
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(): Promise<User[]>;
  /** Retourne true si une ligne a été supprimée. */
  delete(id: number): Promise<boolean>;
}

export interface TokenRepository {
  revoke(jti: string, expiresAt: Date): Promise<void>;
  isRevoked(jti: string): Promise<boolean>;
}
