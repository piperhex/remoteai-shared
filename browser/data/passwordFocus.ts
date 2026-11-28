import { loginOrigin, type Login } from './model';
import type { SavedLogin } from './vault';

export interface PasswordFocus {
  origin: string; id: string; username: string;
  stage?: 'username' | 'password';
  continuationId?: string;
  bounds: { x: number; y: number; width: number; height: number };
  viewport: { width: number; height: number };
}

export type PasswordFill = (login: Login, focus?: PasswordFocus) => Promise<void>;
export const USERNAME_STEP_LIFETIME_MS = 10 * 60 * 1000;

export function isPasswordFocus(value: unknown): value is PasswordFocus {
  if (!value || typeof value !== 'object') return false;
  const focus = value as PasswordFocus, bounds = focus.bounds, viewport = focus.viewport;
  return typeof focus.origin === 'string' && loginOrigin(focus.origin) === focus.origin
    && typeof focus.id === 'string' && /^[\w-]{1,80}$/.test(focus.id)
    && typeof focus.username === 'string' && focus.username.length <= 512
    && (focus.stage === undefined || focus.stage === 'username' || focus.stage === 'password' && !!focus.username)
    && (focus.continuationId === undefined || focus.stage === 'password'
      && typeof focus.continuationId === 'string' && /^[\w-]{1,80}$/.test(focus.continuationId))
    && !!bounds && !!viewport && [bounds.x, bounds.y, bounds.width, bounds.height, viewport.width, viewport.height]
      .every(number => Number.isFinite(number) && Math.abs(number) <= 100000)
    && bounds.width > 0 && bounds.height > 0 && viewport.width > 0 && viewport.height > 0;
}

export function matchingPasswords(entries: SavedLogin[], focus: PasswordFocus): SavedLogin[] {
  return entries.filter(entry => entry.origin === focus.origin
    && (focus.stage !== 'username' || !!entry.username)
    && (focus.stage !== 'password' || entry.username === focus.username))
    .sort((a, b) => Number(b.username === focus.username) - Number(a.username === focus.username) || b.at - a.at);
}
