import { describe, expect, it, vi } from 'vitest';
import { apiError, createApp, rejectMismatchedOrigin, rejectUnauthenticatedWrite } from './index';

function buildApp() {
  const app = createApp<{ Bindings: { APP_ENV: string } }>();
  app.get('/api/health', (c) => c.json({ ok: true }));
  app.post('/api/notes', (c) => rejectUnauthenticatedWrite(c));
  app.get('/api/boom', () => {
    throw new Error('database password leaked');
  });
  return app;
}

describe('createApp', () => {
  it('adds private cache headers to API responses', async () => {
    const response = await buildApp().request('/api/health', undefined, { APP_ENV: 'test' });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('rejects writes until an auth plugin is mounted', async () => {
    const response = await buildApp().request(
      '/api/notes',
      { method: 'POST' },
      { APP_ENV: 'test' },
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'auth_required' });
  });

  it('hides internal error details', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await buildApp().request('/api/boom', undefined, { APP_ENV: 'test' });
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).toContain('internal_error');
    expect(body).not.toContain('password');
    expect(body).not.toContain('database');
    expect(errorLog).toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it('logs a request id and not the cookie', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const response = await buildApp().request(
      '/api/health',
      {
        headers: { cookie: 'session=secret-token' },
      },
      { APP_ENV: 'test' },
    );
    expect(response.status).toBe(200);
    const line = log.mock.calls[0]?.[0];
    expect(typeof line).toBe('string');
    expect(String(line)).toContain('requestId');
    expect(String(line)).not.toContain('secret-token');
    log.mockRestore();
  });

  it('rejects a write from a different origin', async () => {
    const app = createApp();
    app.post('/api/notes', (c) => {
      const blocked = rejectMismatchedOrigin(c, [new URL(c.req.url).origin]);
      if (blocked) return blocked;
      return c.json({ ok: true });
    });
    const response = await app.request('https://example.com/api/notes', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'origin_rejected' });
  });

  it('returns a stable error object', async () => {
    const app = createApp();
    app.get('/api/missing-row', (c) => apiError(c, 'not_found', 404));
    const response = await app.request('/api/missing-row');
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'not_found' });
  });
});
