import { env, exports } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@ship/auth';

const origin = 'https://example.com';

describe('password hash', () => {
  it('uses webcrypto and finishes inside the request budget', async () => {
    const started = Date.now();
    const hash = await hashPassword('correct-horse');
    const durationMs = Date.now() - started;
    expect(hash.startsWith('pbkdf2$100000$')).toBe(true);
    expect(durationMs).toBeLessThan(1000);
    expect(await verifyPassword('correct-horse', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });
});

describe('auth routes', () => {
  let turnstileAction = 'sign-up';
  const sent: string[] = [];
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    turnstileAction = 'sign-up';
    sent.length = 0;
    globalThis.fetch = async (input, init) => {
      const url = requestUrl(input);
      if (url.startsWith('https://challenges.cloudflare.com/')) {
        return Response.json({ success: true, hostname: 'example.com', action: turnstileAction });
      }
      if (url.startsWith('https://api.resend.com/')) {
        sent.push(typeof init?.body === 'string' ? init.body : '');
        return Response.json({ id: 'email_1' });
      }
      return realFetch(input, init);
    };
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('rejects a write whose origin does not match', async () => {
    const response = await exports.default.fetch('https://example.com/api/auth/sign-in', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'ada@example.com', password: 'correct-horse' }),
    });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'origin_rejected' });
  });

  it('rejects turnstile when the action is wrong', async () => {
    turnstileAction = 'login';
    const response = await signUp('ada-turnstile@example.com');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'turnstile_failed' });
  });

  it('ignores a user id in the body and keeps the session user', async () => {
    const ada = await signedInUser('ada@example.com', 'Ada');
    const grace = await signedInUser('grace@example.com', 'Grace');
    const renamed = await send(
      '/api/auth/profile',
      ada.cookie,
      {
        name: 'Ada Lovelace',
        userId: grace.user.id,
      },
      'PATCH',
    );
    expect(renamed.status).toBe(200);
    const adaAfter = await session(ada.cookie);
    const graceAfter = await session(grace.cookie);
    expect(adaAfter.user).toMatchObject({ id: ada.user.id, name: 'Ada Lovelace' });
    expect(graceAfter.user).toMatchObject({ id: grace.user.id, name: 'Grace' });
  });

  it('invalidates the session after the account is deleted', async () => {
    const ada = await signedInUser('delete@example.com', 'Ada');
    const removed = await send('/api/auth/delete', ada.cookie, { password: 'correct-horse' });
    expect(removed.status).toBe(200);
    const again = await exports.default.fetch('https://example.com/api/auth/session', {
      headers: { cookie: ada.cookie },
    });
    expect(again.status).toBe(401);
    await expect(again.json()).resolves.toEqual({ error: 'auth_required' });
    const audit = await env.DB.prepare(
      'SELECT action FROM audit_event WHERE user_id = ?1 AND action = ?2',
    )
      .bind(ada.user.id, 'delete')
      .first<{ action: string }>();
    expect(audit?.action).toBe('delete');
  });

  it('sends one reset email and ends the old session', async () => {
    const ada = await signedInUser('reset@example.com', 'Ada');
    const requested = await send('/api/auth/reset', undefined, { email: 'reset@example.com' });
    expect(requested.status).toBe(200);
    const payload = JSON.parse(sent[0] ?? '{}') as { text?: string };
    const token = payload.text?.match(/token=([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeTruthy();
    const confirmed = await send('/api/auth/reset/confirm', undefined, {
      token,
      password: 'new-password',
    });
    expect(confirmed.status).toBe(200);
    const oldSession = await exports.default.fetch('https://example.com/api/auth/session', {
      headers: { cookie: ada.cookie },
    });
    expect(oldSession.status).toBe(401);
    const signedIn = await send('/api/auth/sign-in', undefined, {
      email: 'reset@example.com',
      password: 'new-password',
    });
    expect(signedIn.status).toBe(200);
  });
});

async function signedInUser(email: string, name: string) {
  const response = await signUp(email, name);
  expect(response.status).toBe(200);
  const cookie = cookieFrom(response);
  const body = (await response.json()) as { user: { id: string; email: string; name: string } };
  return { cookie, user: body.user };
}

function signUp(email: string, name = 'Ada') {
  return send('/api/auth/sign-up', undefined, {
    name,
    email,
    password: 'correct-horse',
    turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
  });
}

function send(path: string, cookie: string | undefined, body: object, method = 'POST') {
  return exports.default.fetch(`${origin}${path}`, {
    method,
    headers: {
      origin,
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.10',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function session(cookie: string) {
  const response = await exports.default.fetch(`${origin}/api/auth/session`, {
    headers: { cookie },
  });
  expect(response.status).toBe(200);
  return response.json() as Promise<{ user: { id: string; name: string } }>;
}

function cookieFrom(response: Response): string {
  const header = response.headers.get('set-cookie') ?? '';
  const pair = header.split(';')[0] ?? '';
  expect(pair.startsWith('__Host-session=')).toBe(true);
  expect(header).toContain('HttpOnly');
  expect(header).toContain('Secure');
  expect(header).toContain('SameSite=Lax');
  return pair;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}
