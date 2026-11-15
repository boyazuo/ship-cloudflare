import type { ShipPlugin } from '@ship/plugin-sdk';
import { apiError } from '@ship/worker-kit';
import type { Context, Hono } from 'hono';
import { z } from 'zod';
import { hashPassword, verifyPassword } from './password';
import { tables } from './schema';

export { auditEvent, session, user } from './schema';

export { hashPassword, verifyPassword };

const COOKIE = '__Host-session';
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const RESET_SECONDS = 60 * 60;
const SESSION_LIST_LIMIT = 20; // shortcut: 20 rows, add a cursor when one page is not enough
const DUMMY_TURNSTILE_SECRET = '1x0000000000000000000000000000000AA';
const UNCONFIGURED_RESEND_KEY = 're_local_unset';

const credentialsSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
});

const signUpSchema = credentialsSchema.extend({
  name: z.string().trim().min(1).max(80),
  turnstileToken: z.string().min(1).max(2048),
});

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  userId: z.string().optional(),
});

const resetConfirmSchema = z.object({
  token: z.string().min(1).max(512),
  password: z.string().min(8).max(128),
});

const revokeSchema = z.object({
  sessionId: z.string().min(1).max(80),
});

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  reset_token_hash: string | null;
  reset_expires_at: number | null;
  created_at: number;
};

type SessionRow = { id: string; user_id: string; expires_at: number; created_at: number };

export interface Principal {
  userId: string;
  sessionId: string;
}

export async function requirePrincipal(
  request: Request,
  db: D1Database,
): Promise<Principal | null> {
  const token = readCookie(request);
  if (!token) return null;
  const row = await db
    .prepare('SELECT id, user_id, expires_at FROM session WHERE token_hash = ?1')
    .bind(await sha256Hex(token))
    .first<SessionRow>();
  if (!row || row.expires_at <= now()) return null;
  return { userId: row.user_id, sessionId: row.id };
}

export const authPlugin = {
  id: 'auth',
  version: '1',
  tables,
  requiredBindings: ['DB', 'LOGIN_RATE_LIMITER', 'TURNSTILE_SECRET_KEY', 'RESEND_API_KEY'],
  clientRoutes: '@ship/auth/client',
  mount<B extends object>(app: Hono<{ Bindings: B }>) {
    app.post('/api/auth/sign-up', (c) => signUp(c));
    app.post('/api/auth/sign-in', (c) => signIn(c));
    app.post('/api/auth/sign-out', (c) => signOut(c));
    app.get('/api/auth/session', (c) => currentSession(c));
    app.get('/api/auth/sessions', (c) => listSessions(c));
    app.post('/api/auth/sessions/revoke', (c) => revokeSession(c));
    app.patch('/api/auth/profile', (c) => updateProfile(c));
    app.get('/api/auth/export', (c) => exportAccount(c));
    app.post('/api/auth/delete', (c) => deleteAccount(c));
    app.post('/api/auth/reset', (c) => requestReset(c));
    app.post('/api/auth/reset/confirm', (c) => confirmReset(c));
  },
} satisfies ShipPlugin;

async function signUp<B extends object>(c: Context<{ Bindings: B }>): Promise<Response> {
  const env = readEnv(c.env);
  const body = await readBody(c, signUpSchema);
  if (body instanceof Response) return body;
  const turnstileOk = await verifyTurnstile(c.req.raw, env, body.turnstileToken);
  if (!turnstileOk) return apiError(c, 'turnstile_failed', 403);
  const passwordHash = await hashPassword(body.password);
  const existing = await env.DB.prepare('SELECT id FROM user WHERE email = ?1')
    .bind(body.email)
    .first<{ id: string }>();
  if (existing) return apiError(c, 'email_taken', 409);

  const userId = crypto.randomUUID();
  const session = await newSession(userId);
  const createdAt = now();
  try {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO user (id, email, name, password_hash, created_at) VALUES (?1, ?2, ?3, ?4, ?5)',
      ).bind(userId, body.email, body.name, passwordHash, createdAt),
      env.DB.prepare(
        'INSERT INTO session (id, user_id, token_hash, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5)',
      ).bind(session.id, userId, session.tokenHash, session.expiresAt, createdAt),
      auditStatement(env.DB, userId, 'sign_in', createdAt),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) return apiError(c, 'email_taken', 409);
    throw error;
  }
  return jsonWithCookie(
    c,
    { user: { id: userId, email: body.email, name: body.name } },
    session.token,
  );
}

async function signIn<B extends object>(c: Context<{ Bindings: B }>): Promise<Response> {
  const env = readEnv(c.env);
  const ip = c.req.header('cf-connecting-ip') ?? 'local';
  const limit = await env.LOGIN_RATE_LIMITER.limit({ key: ip });
  if (!limit.success) return apiError(c, 'rate_limited', 429);
  const body = await readBody(c, credentialsSchema);
  if (body instanceof Response) return body;
  const row = await env.DB.prepare(
    'SELECT id, email, name, password_hash FROM user WHERE email = ?1',
  )
    .bind(body.email)
    .first<Pick<UserRow, 'id' | 'email' | 'name' | 'password_hash'>>();
  const hash = row?.password_hash ?? (await dummyPasswordHash());
  const matches = await verifyPassword(body.password, hash);
  if (!row || !matches) return apiError(c, 'invalid_credentials', 401);

  const session = await newSession(row.id);
  const createdAt = now();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO session (id, user_id, token_hash, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5)',
    ).bind(session.id, row.id, session.tokenHash, session.expiresAt, createdAt),
    auditStatement(env.DB, row.id, 'sign_in', createdAt),
  ]);
  return jsonWithCookie(
    c,
    { user: { id: row.id, email: row.email, name: row.name } },
    session.token,
  );
}

async function signOut<B extends object>(c: Context<{ Bindings: B }>): Promise<Response> {
  const env = readEnv(c.env);
  const principal = await requirePrincipal(c.req.raw, env.DB);
  if (principal) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM session WHERE id = ?1 AND user_id = ?2').bind(
        principal.sessionId,
        principal.userId,
      ),
      auditStatement(env.DB, principal.userId, 'sign_out', now()),
    ]);
  }
  c.header('Set-Cookie', clearCookie());
  return c.json({ ok: true });
}

async function currentSession<B extends object>(c: Context<{ Bindings: B }>): Promise<Response> {
  const env = readEnv(c.env);
  const principal = await requirePrincipal(c.req.raw, env.DB);
  if (!principal) return apiError(c, 'auth_required', 401);
  const row = await env.DB.prepare('SELECT id, email, name FROM user WHERE id = ?1')
    .bind(principal.userId)
    .first<{ id: string; email: string; name: string }>();
  if (!row) return apiError(c, 'auth_required', 401);
  return c.json({ user: row, sessionId: principal.sessionId });
}

async function listSessions<B extends object>(c: Context<{ Bindings: B }>): Promise<Response> {
  const env = readEnv(c.env);
  const principal = await requirePrincipal(c.req.raw, env.DB);
  if (!principal) return apiError(c, 'auth_required', 401);
  const listed = await env.DB.prepare(
    'SELECT id, created_at, expires_at FROM session WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2',
  )
    .bind(principal.userId, SESSION_LIST_LIMIT)
    .all<{ id: string; created_at: number; expires_at: number }>();
  return c.json({
    sessions: listed.results.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      current: row.id === principal.sessionId,
    })),
  });
}

async function revokeSession<B extends object>(c: Context<{ Bindings: B }>): Promise<Response> {
  const env = readEnv(c.env);
  const principal = await requirePrincipal(c.req.raw, env.DB);
  if (!principal) return apiError(c, 'auth_required', 401);
  const body = await readBody(c, revokeSchema);
  if (body instanceof Response) return body;
  const owned = await env.DB.prepare('SELECT id FROM session WHERE id = ?1 AND user_id = ?2')
    .bind(body.sessionId, principal.userId)
    .first<{ id: string }>();
  if (!owned) return apiError(c, 'not_found', 404);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM session WHERE id = ?1 AND user_id = ?2').bind(
      body.sessionId,
      principal.userId,
    ),
    auditStatement(env.DB, principal.userId, 'sign_out', now()),
  ]);
  if (body.sessionId === principal.sessionId) c.header('Set-Cookie', clearCookie());
  return c.json({ ok: true });
}

async function updateProfile<B extends object>(c: Context<{ Bindings: B }>): Promise<Response> {
  const env = readEnv(c.env);
  const principal = await requirePrincipal(c.req.raw, env.DB);
  if (!principal) return apiError(c, 'auth_required', 401);
  const body = await readBody(c, profileSchema);
  if (body instanceof Response) return body;
  await env.DB.prepare('UPDATE user SET name = ?1 WHERE id = ?2')
    .bind(body.name, principal.userId)
    .run();
  return c.json({ user: { id: principal.userId, name: body.name } });
}

async function exportAccount<B extends object>(c: Context<{ Bindings: B }>): Promise<Response> {
  const env = readEnv(c.env);
  const principal = await requirePrincipal(c.req.raw, env.DB);
  if (!principal) return apiError(c, 'auth_required', 401);
  const row = await env.DB.prepare('SELECT id, email, name, created_at FROM user WHERE id = ?1')
    .bind(principal.userId)
    .first<{ id: string; email: string; name: string; created_at: number }>();
  if (!row) return apiError(c, 'auth_required', 401);
  const listed = await env.DB.prepare(
    'SELECT id, created_at, expires_at FROM session WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2',
  )
    .bind(principal.userId, SESSION_LIST_LIMIT)
    .all<{ id: string; created_at: number; expires_at: number }>();
  c.header('Content-Disposition', 'attachment; filename="account.json"');
  return c.json({
    user: { id: row.id, email: row.email, name: row.name, createdAt: row.created_at },
    sessions: listed.results.map((session) => ({
      id: session.id,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
    })),
  });
}

async function deleteAccount<B extends object>(c: Context<{ Bindings: B }>): Promise<Response> {
  const env = readEnv(c.env);
  const principal = await requirePrincipal(c.req.raw, env.DB);
  if (!principal) return apiError(c, 'auth_required', 401);
  const body = await readBody(c, z.object({ password: z.string().min(1).max(128) }));
  if (body instanceof Response) return body;
  const row = await env.DB.prepare('SELECT password_hash FROM user WHERE id = ?1')
    .bind(principal.userId)
    .first<{ password_hash: string }>();
  if (!row || !(await verifyPassword(body.password, row.password_hash))) {
    return apiError(c, 'invalid_credentials', 401);
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM session WHERE user_id = ?1').bind(principal.userId),
    env.DB.prepare('DELETE FROM user WHERE id = ?1').bind(principal.userId),
    auditStatement(env.DB, principal.userId, 'delete', now()),
  ]);
  c.header('Set-Cookie', clearCookie());
  return c.json({ ok: true });
}

async function requestReset<B extends object>(c: Context<{ Bindings: B }>): Promise<Response> {
  const env = readEnv(c.env);
  if (env.RESEND_API_KEY === UNCONFIGURED_RESEND_KEY) return apiError(c, 'email_unconfigured', 501);
  const body = await readBody(c, z.object({ email: z.email().trim().toLowerCase() }));
  if (body instanceof Response) return body;
  const row = await env.DB.prepare('SELECT id FROM user WHERE email = ?1')
    .bind(body.email)
    .first<{ id: string }>();
  if (!row) return c.json({ ok: true });

  const token = randomToken();
  const expiresAt = now() + RESET_SECONDS;
  await env.DB.prepare('UPDATE user SET reset_token_hash = ?1, reset_expires_at = ?2 WHERE id = ?3')
    .bind(await sha256Hex(token), expiresAt, row.id)
    .run();
  const url = new URL('/app/reset', c.req.url);
  url.searchParams.set('token', token);
  const sent = await sendResetEmail(env, body.email, url.href);
  if (!sent) {
    await env.DB.prepare(
      'UPDATE user SET reset_token_hash = NULL, reset_expires_at = NULL WHERE id = ?1',
    )
      .bind(row.id)
      .run();
    return apiError(c, 'email_failed', 502);
  }
  return c.json({ ok: true });
}

async function confirmReset<B extends object>(c: Context<{ Bindings: B }>): Promise<Response> {
  const env = readEnv(c.env);
  const body = await readBody(c, resetConfirmSchema);
  if (body instanceof Response) return body;
  const row = await env.DB.prepare(
    'SELECT id FROM user WHERE reset_token_hash = ?1 AND reset_expires_at > ?2',
  )
    .bind(await sha256Hex(body.token), now())
    .first<{ id: string }>();
  if (!row) return apiError(c, 'reset_invalid', 400);
  const passwordHash = await hashPassword(body.password);
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE user SET password_hash = ?1, reset_token_hash = NULL, reset_expires_at = NULL WHERE id = ?2',
    ).bind(passwordHash, row.id),
    env.DB.prepare('DELETE FROM session WHERE user_id = ?1').bind(row.id),
  ]);
  return c.json({ ok: true });
}

function auditStatement(db: D1Database, userId: string, action: string, createdAt: number) {
  // shortcut: rows stay after account delete, purge them when a retention period exists
  return db
    .prepare('INSERT INTO audit_event (id, user_id, action, created_at) VALUES (?1, ?2, ?3, ?4)')
    .bind(crypto.randomUUID(), userId, action, createdAt);
}

async function newSession(userId: string) {
  const token = randomToken();
  return {
    id: crypto.randomUUID(),
    userId,
    token,
    tokenHash: await sha256Hex(token),
    expiresAt: now() + SESSION_SECONDS,
  };
}

let cachedDummyHash: string | null = null;

async function dummyPasswordHash(): Promise<string> {
  cachedDummyHash ??= await hashPassword('dummy-password-for-missing-users');
  return cachedDummyHash;
}

async function verifyTurnstile(request: Request, env: AuthEnv, token: string): Promise<boolean> {
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) body.set('remoteip', ip);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  if (!response.ok) return false;
  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.success !== true) return false;
  const dummyPass =
    env.APP_ENV === 'development' &&
    env.TURNSTILE_SECRET_KEY === DUMMY_TURNSTILE_SECRET &&
    payload.hostname === 'example.com' &&
    payload.action == null;
  if (dummyPass) return true;
  return payload.hostname === new URL(request.url).hostname && payload.action === 'sign-up';
}

async function sendResetEmail(env: AuthEnv, to: string, url: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.AUTH_EMAIL_FROM,
        to,
        subject: 'Reset your password',
        text: `Reset your password:\n\n${url}\n\nThis link expires in one hour. If you did not ask for it, ignore this message.\n`,
      }),
    });
    if (!response.ok) {
      console.error(JSON.stringify({ message: 'reset email failed', status: response.status }));
      return false;
    }
    return true;
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error';
    console.error(JSON.stringify({ message: 'reset email failed', error: name }));
    return false;
  }
}

interface AuthEnv {
  DB: D1Database;
  LOGIN_RATE_LIMITER: RateLimit;
  TURNSTILE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  AUTH_EMAIL_FROM: string;
  APP_ENV: string;
}

function readEnv(env: object): AuthEnv {
  const db = Reflect.get(env, 'DB');
  const limiter = Reflect.get(env, 'LOGIN_RATE_LIMITER');
  const turnstile = Reflect.get(env, 'TURNSTILE_SECRET_KEY');
  const resend = Reflect.get(env, 'RESEND_API_KEY');
  const from = Reflect.get(env, 'AUTH_EMAIL_FROM');
  const appEnv = Reflect.get(env, 'APP_ENV');
  if (!isD1(db) || !isRateLimit(limiter)) throw new Error('auth bindings missing');
  if (typeof turnstile !== 'string' || typeof resend !== 'string' || typeof from !== 'string') {
    throw new Error('auth secrets missing');
  }
  if (typeof appEnv !== 'string') throw new Error('auth env missing');
  return {
    DB: db,
    LOGIN_RATE_LIMITER: limiter,
    TURNSTILE_SECRET_KEY: turnstile,
    RESEND_API_KEY: resend,
    AUTH_EMAIL_FROM: from,
    APP_ENV: appEnv,
  };
}

function isD1(value: unknown): value is D1Database {
  return (
    isRecord(value) && typeof value.prepare === 'function' && typeof value.batch === 'function'
  );
}

function isRateLimit(value: unknown): value is RateLimit {
  return isRecord(value) && typeof value.limit === 'function';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readBody<T, B extends object>(
  c: Context<{ Bindings: B }>,
  schema: z.ZodType<T>,
): Promise<T | Response> {
  const text = await c.req.text();
  if (text.length > 4096) return apiError(c, 'invalid_body', 413);
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    return apiError(c, 'invalid_body', 400);
  }
}

function jsonWithCookie<B extends object>(
  c: Context<{ Bindings: B }>,
  body: unknown,
  token: string,
): Response {
  c.header('Set-Cookie', sessionCookie(token));
  return c.json(body);
}

function readCookie(request: Request): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const splitAt = trimmed.indexOf('=');
    if (splitAt === -1 || trimmed.slice(0, splitAt) !== COOKIE) continue;
    const value = trimmed.slice(splitAt + 1);
    return value.length > 0 ? value : null;
  }
  return null;
}

function sessionCookie(token: string): string {
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}`;
}

function clearCookie(): string {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE');
}
