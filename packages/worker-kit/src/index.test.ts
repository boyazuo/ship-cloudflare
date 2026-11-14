import { describe, expect, it, vi } from 'vitest';
import { apiError, createApp, rejectUnauthenticatedWrite } from './index';

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

  it('returns a stable error object', async () => {
    const app = createApp();
    app.get('/api/missing-row', (c) => apiError(c, 'not_found', 404));
    const response = await app.request('/api/missing-row');
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'not_found' });
  });
});
