import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/server/app.ts';

/**
 * Vercel serverless entrypoint.
 *
 * `vercel.json` rewrites every `/api/*` request here, so the SPA and the API
 * share one origin (no CORS, no hardcoded backend URL needed).
 */
const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  // Vercel's Node runtime pre-parses JSON bodies and consumes the request
  // stream. Express' `express.json()` checks `req._body` and would otherwise
  // wait for a stream that is already drained.
  const request = req as IncomingMessage & { _body?: boolean; body?: unknown };
  if (request.body !== undefined && request.body !== null) {
    request._body = true;
  }

  app(req as never, res as never);
}
