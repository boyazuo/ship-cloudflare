import type { Context } from 'hono';
import { Hono } from 'hono';

type AppBindings = { Bindings: object };

type ErrorStatus = 400 | 401 | 403 | 404 | 405 | 409 | 413 | 415 | 429 | 500 | 501 | 502;

export function createApp<E extends AppBindings = AppBindings>() {
  const app = new Hono<E>();

  app.use('/api/*', async (c, next) => {
    const started = Date.now();
    const requestId = crypto.randomUUID();
    try {
      await next();
    } catch (error) {
      const name = error instanceof Error ? error.name : 'Error';
      console.error(
        JSON.stringify({ message: 'request failed', requestId, route: c.req.path, error: name }),
      );
      c.header('Cache-Control', 'private, no-store');
      c.header('X-Content-Type-Options', 'nosniff');
      return apiError(c, 'internal_error', 500);
    }
    c.header('Cache-Control', 'private, no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    const status = c.res.status;
    const environment = readEnvironment(c.env);
    const entry = JSON.stringify({
      requestId,
      environment,
      route: c.req.path,
      status,
      durationMs: Date.now() - started,
    });
    if (status >= 500) console.error(entry);
    else console.log(entry);
  });

  app.onError((error, c) => {
    const name = error instanceof Error ? error.name : 'Error';
    console.error(JSON.stringify({ message: 'request failed', route: c.req.path, error: name }));
    return apiError(c, 'internal_error', 500);
  });

  return app;
}

export function apiError<E extends { Bindings: object }>(
  c: Context<E>,
  code: string,
  status: ErrorStatus,
) {
  return c.json({ error: code }, status);
}

/** Writes stay closed until the auth plugin replaces this helper. */
export function rejectUnauthenticatedWrite<E extends { Bindings: object }>(c: Context<E>) {
  return apiError(c, 'auth_required', 401);
}

export function rejectMismatchedOrigin<E extends { Bindings: object }>(
  c: Context<E>,
  allowedOrigins: readonly string[],
): Response | null {
  const origin = c.req.header('origin');
  if (!origin || !allowedOrigins.includes(origin)) return apiError(c, 'origin_rejected', 403);
  return null;
}

function readEnvironment(env: unknown): string | undefined {
  if (typeof env !== 'object' || env === null || !('APP_ENV' in env)) return undefined;
  const value = env.APP_ENV;
  return typeof value === 'string' ? value : undefined;
}
