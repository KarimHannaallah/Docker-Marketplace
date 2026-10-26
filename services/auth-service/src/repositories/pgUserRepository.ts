import type { Pool } from 'pg';
import type { NewUser, Role, User, UserRepository } from './types';

interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: Date;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at,
  };
}

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  async create(user: NewUser): Promise<User> {
    const { rows } = await this.pool.query<UserRow>(
      `INSERT INTO auth.users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user.name, user.email, user.passwordHash, user.role],
    );
    return toUser(rows[0]);
  }

  async findById(id: number): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>('SELECT * FROM auth.users WHERE id = $1', [id]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>('SELECT * FROM auth.users WHERE email = $1', [email]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async list(): Promise<User[]> {
    const { rows } = await this.pool.query<UserRow>('SELECT * FROM auth.users ORDER BY id');
    return rows.map(toUser);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM auth.users WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
