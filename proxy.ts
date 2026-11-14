import { updateSession } from './lib/supabase/middleware';
import type { NextRequest } from 'next/server';

/**
 * Next.js 16 renamed `middleware` to `proxy`. This is the global route guard:
 * it refreshes Supabase cookies and protects /projects, /billing, /settings.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?)$).*)',
  ],
};
