/**
 * Central place for backend URLs.
 *
 * By default the SPA talks to the API on its own origin (`/api/...`), which is
 * what happens on Vercel where `api/index.ts` runs the Express app.
 *
 * Set `VITE_API_BASE_URL` at build time when the backend lives on another host
 * (e.g. Railway/Render): `VITE_API_BASE_URL=https://urself-api.up.railway.app`.
 */
const rawBase = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').trim();

export const API_BASE_URL = rawBase.replace(/\/+$/, '');

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${suffix}` : suffix;
}
