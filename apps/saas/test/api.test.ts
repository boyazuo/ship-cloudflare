import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('saas API', () => {
  it('returns health without reading D1', async () => {
    const response = await exports.default.fetch('https://example.com/api/health');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('reads the schema version from D1', async () => {
    const response = await exports.default.fetch('https://example.com/api/meta');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({
      name: 'Ship SaaS',
      schemaVersion: '2',
      plugins: ['auth'],
    });
  });

  it('returns a JSON 404 for an unknown API route', async () => {
    const response = await exports.default.fetch('https://example.com/api/unknown');
    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'not_found' });
  });

  it('rejects writes until the auth plugin is enabled', async () => {
    const response = await exports.default.fetch('https://example.com/api/meta', {
      method: 'POST',
      headers: { origin: 'https://example.com' },
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    await expect(response.json()).resolves.toEqual({ error: 'auth_required' });
  });
});
