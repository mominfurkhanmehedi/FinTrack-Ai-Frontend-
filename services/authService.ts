import { AuthResult, User } from '../types';

/**
 * Mock auth service.
 * Simulates a backend with small network delays so the auth flow behaves like a
 * real client/server round-trip. Swap these for calls against `api` (axios.ts)
 * when a backend exists.
 */

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const nameFromEmail = (email: string): string =>
  email
    .split('@')[0]
    .split(/[._-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');

export const authService = {
  async login(email: string, password: string): Promise<AuthResult> {
    await delay(600);
    if (!email || !password || password.length < 6) {
      return { ok: false, error: 'Invalid email or password.' };
    }
    const user: User = { name: nameFromEmail(email), email };
    return { ok: true, user };
  },

  async register(name: string, email: string, password: string): Promise<AuthResult> {
    await delay(700);
    if (!email || password.length < 6) {
      return { ok: false, error: 'Password must be at least 6 characters.' };
    }
    return { ok: true, user: { name: name.trim() || nameFromEmail(email), email } };
  },

  async sendResetLink(email: string): Promise<{ ok: boolean; error?: string }> {
    await delay(500);
    if (!email.includes('@')) {
      return { ok: false, error: 'Enter a valid email address.' };
    }
    return { ok: true };
  },
};
