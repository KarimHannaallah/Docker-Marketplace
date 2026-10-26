// Repositories en mémoire utilisés uniquement par les tests (pas de base de données).
import type { NewUser, TokenRepository, User, UserRepository } from '../src/repositories/types';

export class InMemoryUserRepository implements UserRepository {
  private users: User[] = [];
  private nextId = 1;

  async create(user: NewUser): Promise<User> {
    const created: User = { ...user, id: this.nextId++, createdAt: new Date() };
    this.users.push(created);
    return created;
  }

  async findById(id: number): Promise<User | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email === email) ?? null;
  }

  async list(): Promise<User[]> {
    return [...this.users];
  }

  async delete(id: number): Promise<boolean> {
    const before = this.users.length;
    this.users = this.users.filter((u) => u.id !== id);
    return this.users.length < before;
  }
}

export class InMemoryTokenRepository implements TokenRepository {
  private revoked = new Set<string>();

  async revoke(jti: string): Promise<void> {
    this.revoked.add(jti);
  }

  async isRevoked(jti: string): Promise<boolean> {
    return this.revoked.has(jti);
  }
}
