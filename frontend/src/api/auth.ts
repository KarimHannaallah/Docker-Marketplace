import { api } from './client';
import type { User } from './types';

export const authApi = {
  register: (name: string, email: string, password: string) =>
    api<User>('/api/auth/register', { method: 'POST', body: { name, email, password }, auth: false }),
  login: (email: string, password: string) =>
    api<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),
  logout: () => api<void>('/api/auth/logout', { method: 'POST' }),
  me: () => api<User>('/api/auth/me'),
  deleteMe: () => api<void>('/api/auth/me', { method: 'DELETE' }),

  // Administration (ADMIN seulement)
  users: () => api<User[]>('/api/admin/users'),
  deleteUser: (id: number) => api<void>(`/api/admin/users/${id}`, { method: 'DELETE' }),
};
