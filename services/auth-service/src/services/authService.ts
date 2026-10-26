import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Config } from '../config';
import { HttpError } from '../errors';
import type { Role, TokenRepository, User, UserRepository } from '../repositories/types';

/** Utilisateur renvoyé aux clients : jamais de password_hash. */
export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  created_at: string;
}

/** Informations extraites d'un token valide. */
export interface AuthContext {
  userId: number;
  role: Role;
  jti: string;
  exp: number; // secondes epoch
}

export function toPublic(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    created_at: user.createdAt.toISOString(),
  };
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: TokenRepository,
    private readonly config: Config,
  ) {}

  /** Création d'un compte STANDARD (un ADMIN ne peut être créé que par le seed). */
  async register(name: string, email: string, password: string): Promise<PublicUser> {
    if (await this.users.findByEmail(email)) throw new HttpError(409, 'Email déjà utilisé');
    const passwordHash = await bcrypt.hash(password, this.config.bcryptRounds);
    const user = await this.users.create({ name, email, passwordHash, role: 'STANDARD' });
    return toPublic(user);
  }

  async login(email: string, password: string): Promise<{ token: string; user: PublicUser }> {
    const user = await this.users.findByEmail(email);
    // Même message dans les deux cas pour ne pas révéler si l'email existe.
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, 'Email ou mot de passe incorrect');
    }
    // Payload : sub, role, jti (identifiant unique pour pouvoir révoquer), exp (via expiresIn).
    const token = jwt.sign({ role: user.role }, this.config.jwtSecret, {
      algorithm: 'HS256',
      subject: String(user.id),
      jwtid: randomUUID(),
      expiresIn: this.config.jwtExpiresIn,
    });
    return { token, user: toPublic(user) };
  }

  /** Vérifie signature, expiration, révocation, et que le compte existe toujours. */
  async authenticate(token: string): Promise<AuthContext> {
    let payload: jwt.JwtPayload;
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret, { algorithms: ['HS256'] });
      if (typeof decoded === 'string') throw new Error('payload invalide');
      payload = decoded;
    } catch {
      throw new HttpError(401, 'Token invalide ou expiré');
    }

    const userId = Number(payload.sub);
    const validRole = payload.role === 'STANDARD' || payload.role === 'ADMIN';
    if (!payload.jti || !payload.exp || !Number.isInteger(userId) || !validRole) {
      throw new HttpError(401, 'Token invalide');
    }
    if (await this.tokens.isRevoked(payload.jti)) throw new HttpError(401, 'Token révoqué');
    if (!(await this.users.findById(userId))) throw new HttpError(401, 'Compte inexistant');

    return { userId, role: payload.role as Role, jti: payload.jti, exp: payload.exp };
  }

  /** Logout réel : le jti est mis en liste noire jusqu'à l'expiration du token. */
  async logout(auth: AuthContext): Promise<void> {
    await this.tokens.revoke(auth.jti, new Date(auth.exp * 1000));
  }

  async getProfile(auth: AuthContext): Promise<PublicUser> {
    const user = await this.users.findById(auth.userId);
    if (!user) throw new HttpError(404, 'Utilisateur introuvable');
    return toPublic(user);
  }

  /** Tout utilisateur peut supprimer son propre compte (ADMIN compris). */
  async deleteOwnAccount(auth: AuthContext): Promise<void> {
    await this.users.delete(auth.userId);
    await this.logout(auth);
  }

  async listUsers(): Promise<PublicUser[]> {
    return (await this.users.list()).map(toPublic);
  }

  /** Un ADMIN peut supprimer un compte STANDARD, jamais un autre ADMIN. */
  async deleteUserAsAdmin(targetId: number): Promise<void> {
    const target = await this.users.findById(targetId);
    if (!target) throw new HttpError(404, 'Utilisateur introuvable');
    if (target.role === 'ADMIN') throw new HttpError(403, 'Impossible de supprimer un compte ADMIN');
    await this.users.delete(targetId);
  }

  /** Seed : crée l'admin s'il n'existe pas (idempotent). Retourne true si créé. */
  async ensureAdmin(): Promise<boolean> {
    const { adminEmail, adminPassword, adminName, bcryptRounds } = this.config;
    const email = adminEmail.toLowerCase();
    if (await this.users.findByEmail(email)) return false;
    const passwordHash = await bcrypt.hash(adminPassword, bcryptRounds);
    await this.users.create({ name: adminName, email, passwordHash, role: 'ADMIN' });
    return true;
  }
}
