import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/server/app.ts';

/**
 * Vercel serverless entrypoint.
 *
 * `vercel.json` rewrites every `/api/*` request here, so the SPA and the API
 * share one origin (no CORS, no hardcoded backend URL needed).
 */
const app = createApp();

const ORIGINAL_PATH_PARAM = '__urself_path';

/**
 * Vercel rewrites mirror the matched path into `__urself_path`. Depending on the
 * routing layer the request path may already be intact; when it is collapsed to
 * `/api`, rebuild it so Express sees what the browser actually requested
 * (e.g. `/api/projects/123/files`). The helper also strips the internal param.
 */
function normalizeRequestUrl(req: IncomingMessage): void {
  const rawUrl = req.url ?? '/';
  const [pathname, search = ''] = rawUrl.split('?');
  const params = new URLSearchParams(search);
  const original = params.get(ORIGINAL_PATH_PARAM);

  if (original === null) {
    if (pathname === '/api/' && !search) req.url = '/api';
    return;
  }

  params.delete(ORIGINAL_PATH_PARAM);
  const rest = params.toString();
  const suffix = original.replace(/^\/+/, '');

  const resolvedPath =
    pathname === '/api' || pathname === '/api/'
      ? suffix
        ? `/api/${suffix}`
        : '/api'
      : pathname;

  req.url = rest ? `${resolvedPath}?${rest}` : resolvedPath;
}

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  normalizeRequestUrl(req);

  // Vercel's Node runtime pre-parses JSON bodies and consumes the request
  // stream. Express' `express.json()` checks `req._body` and would otherwise
  // wait for a stream that is already drained.
  const request = req as IncomingMessage & { _body?: boolean; body?: unknown };
  if (request.body !== undefined && request.body !== null) {
    request._body = true;
  }

  app(req as never, res as never);
}
