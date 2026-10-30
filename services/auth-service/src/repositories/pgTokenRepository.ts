import type { Pool } from 'pg';
import type { TokenRepository } from './types';

export class PgTokenRepository implements TokenRepository {
  constructor(private readonly pool: Pool) {}

  async revoke(jti: string, expiresAt: Date): Promise<void> {
    // un token expiré est refusé de toute façon : on le purge au passage
    await this.pool.query('DELETE FROM auth.revoked_tokens WHERE expires_at < now()');
    await this.pool.query(
      'INSERT INTO auth.revoked_tokens (jti, expires_at) VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING',
      [jti, expiresAt],
    );
  }

  async isRevoked(jti: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('SELECT 1 FROM auth.revoked_tokens WHERE jti = $1', [jti]);
    return (rowCount ?? 0) > 0;
  }
}
