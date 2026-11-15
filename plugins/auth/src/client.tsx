import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button, Input, Label } from '@ship/ui';

type User = { id: string; email: string; name: string };
type Session = { id: string; createdAt: number; expiresAt: number; current: boolean };

const errors: Record<string, string> = {
  invalid_body: 'Check the fields and try again.',
  invalid_credentials: 'Email or password is wrong.',
  email_taken: 'That email is already registered.',
  turnstile_failed: 'The verification check failed.',
  rate_limited: 'Too many sign-in attempts. Wait a minute.',
  email_unconfigured: 'Password reset email is not configured.',
  email_failed: 'The reset email could not be sent.',
  reset_invalid: 'This reset link is invalid or expired.',
  auth_required: 'Sign in first.',
  origin_rejected: 'The request origin was rejected.',
};

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<'loading' | 'anonymous' | 'ready'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/session', { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          setStatus('anonymous');
          return;
        }
        if (!response.ok) throw new Error('session');
        const body: unknown = await response.json();
        if (!isRecord(body) || !isUser(body.user)) throw new Error('session');
        setUser(body.user);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus('anonymous');
      });
    return () => controller.abort();
  }, []);

  return { user, status };
}

type Field = {
  name: string;
  label: string;
  type: string;
  autoComplete: string;
  minLength?: number;
  maxLength?: number;
  hint?: string;
  extra?: { href: string; label: string };
};

const passwordBounds = { minLength: 8, maxLength: 128 };

export function SignInPage() {
  return (
    <AuthCard
      title="Sign in"
      lede="Use the email and password for this account."
      alternate={{ href: '/app/sign-up', prompt: 'New here?', label: 'Create an account' }}
    >
      <AuthForm
        path="/api/auth/sign-in"
        fields={[
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          {
            name: 'password',
            label: 'Password',
            type: 'password',
            autoComplete: 'current-password',
            ...passwordBounds,
            extra: { href: '/app/reset', label: 'Forgot password?' },
          },
        ]}
        submitLabel="Sign in"
        pendingLabel="Signing in…"
      />
    </AuthCard>
  );
}

export function SignUpPage({ siteKey }: { siteKey: string }) {
  return (
    <AuthCard
      title="Create an account"
      lede="Your name and email are stored for this account."
      alternate={{ href: '/app/sign-in', prompt: 'Already registered?', label: 'Sign in' }}
    >
      <AuthForm
        path="/api/auth/sign-up"
        siteKey={siteKey}
        fields={[
          { name: 'name', label: 'Name', type: 'text', autoComplete: 'name', maxLength: 80 },
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          {
            name: 'password',
            label: 'Password',
            type: 'password',
            autoComplete: 'new-password',
            ...passwordBounds,
            hint: 'At least 8 characters.',
          },
        ]}
        submitLabel="Create account"
        pendingLabel="Creating account…"
      />
    </AuthCard>
  );
}

export function ResetPage() {
  const token = new URLSearchParams(window.location.search).get('token');
  if (token) {
    return (
      <AuthCard
        title="Choose a new password"
        lede="This signs out every current session."
        alternate={{ href: '/app/sign-in', label: 'Back to sign in' }}
      >
        <AuthForm
          path="/api/auth/reset/confirm"
          fields={[
            {
              name: 'password',
              label: 'New password',
              type: 'password',
              autoComplete: 'new-password',
              ...passwordBounds,
              hint: 'At least 8 characters.',
            },
          ]}
          hidden={{ token }}
          submitLabel="Update password"
          pendingLabel="Updating…"
          done="Password updated. Sign in with the new password."
          stay
        />
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title="Reset password"
      lede="If the email has an account, a reset link is sent."
      alternate={{ href: '/app/sign-in', label: 'Back to sign in' }}
    >
      <AuthForm
        path="/api/auth/reset"
        fields={[{ name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }]}
        submitLabel="Send reset link"
        pendingLabel="Sending…"
        done="If an account exists, the reset message has been sent."
        stay
      />
    </AuthCard>
  );
}

export function AccountSettings() {
  const { user, status } = useSession();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ tone: 'error' | 'note'; text: string } | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  useEffect(() => {
    if (status !== 'ready') return;
    const controller = new AbortController();
    fetch('/api/auth/sessions', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('sessions');
        const body: unknown = await response.json();
        if (!isRecord(body) || !Array.isArray(body.sessions)) throw new Error('sessions');
        setSessions(body.sessions.filter(isSession));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSessions([]);
      });
    return () => controller.abort();
  }, [status]);

  if (status === 'loading') return <p className="page-lede">Reading account…</p>;
  if (!user) {
    return (
      <p className="page-lede">
        <a href="/app/sign-in">Sign in</a> to see account settings.
      </p>
    );
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await postJson('/api/auth/profile', { name });
    setPending(false);
    setMessage(
      result.ok
        ? { tone: 'note', text: 'Name saved.' }
        : { tone: 'error', text: messageFor(result.error) },
    );
  }

  async function revoke(sessionId: string) {
    setPending(true);
    const result = await postJson('/api/auth/sessions/revoke', { sessionId });
    if (!result.ok) {
      setPending(false);
      setMessage({ tone: 'error', text: messageFor(result.error) });
      return;
    }
    window.location.assign('/app/settings');
  }

  async function download() {
    setPending(true);
    const response = await fetch('/api/auth/export');
    setPending(false);
    if (!response.ok) {
      setMessage({ tone: 'error', text: 'Could not export the account.' });
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'account.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function signOut() {
    setPending(true);
    const result = await postJson('/api/auth/sign-out', {});
    if (!result.ok) {
      setPending(false);
      setMessage({ tone: 'error', text: messageFor(result.error) });
      return;
    }
    window.location.assign('/app/');
  }

  async function remove(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await postJson('/api/auth/delete', { password });
    if (!result.ok) {
      setPending(false);
      setMessage({ tone: 'error', text: messageFor(result.error) });
      return;
    }
    window.location.assign('/app/');
  }

  return (
    <div className="stack">
      {message ? (
        <p
          className={message.tone === 'error' ? 'form-alert' : 'form-note'}
          role={message.tone === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      ) : null}
      <form onSubmit={(event) => void saveName(event)}>
        <h2>Profile</h2>
        <p className="panel-meta">{user.email}</p>
        <div className="field">
          <Label htmlFor="account-name">Name</Label>
          <Input
            id="account-name"
            className="mt-0"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          Save name
        </Button>
      </form>
      <section>
        <h2>Sessions</h2>
        <ul className="session-list">
          {sessions === null ? (
            <li>
              <span className="panel-meta">Reading sessions…</span>
            </li>
          ) : sessions.length === 0 ? (
            <li>
              <span className="panel-meta">No sessions.</span>
            </li>
          ) : (
            sessions.map((session) => (
              <li key={session.id}>
                <span>
                  <span>{session.current ? 'This session' : 'Another session'}</span>
                  <span className="session-when">{formatWhen(session.createdAt)}</span>
                </span>
                <Button variant="ghost" disabled={pending} onClick={() => void revoke(session.id)}>
                  Revoke
                </Button>
              </li>
            ))
          )}
        </ul>
      </section>
      <div className="row-actions">
        <Button variant="ghost" disabled={pending} onClick={() => void download()}>
          Export account
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => void signOut()}>
          Log out
        </Button>
      </div>
      <form className="danger-zone" onSubmit={(event) => void remove(event)}>
        <h2>Delete account</h2>
        <p className="panel-meta">
          This removes the user and signs out every session. An audit row keeps the user id only.
        </p>
        <div className="field">
          <Label htmlFor="delete-password">Password</Label>
          <div className="field-control">
            <Input
              id="delete-password"
              className="mt-0 pr-11"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <PasswordToggle
              shown={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
            />
          </div>
        </div>
        <Button type="submit" variant="danger" disabled={pending}>
          Delete account
        </Button>
      </form>
    </div>
  );
}

function AuthCard({
  title,
  lede,
  alternate,
  children,
}: {
  title: string;
  lede: string;
  alternate?: { href: string; prompt?: string; label: string };
  children: ReactNode;
}) {
  return (
    <main id="content">
      <h1 className="auth-title">{title}</h1>
      <p className="auth-lede">{lede}</p>
      <div className="auth-body">{children}</div>
      {alternate ? (
        <p className="auth-switch">
          {alternate.prompt ? `${alternate.prompt} ` : null}
          <a href={alternate.href}>{alternate.label}</a>
        </p>
      ) : null}
    </main>
  );
}

function AuthForm({
  path,
  fields,
  submitLabel,
  pendingLabel,
  siteKey,
  hidden,
  done,
  stay = false,
}: {
  path: string;
  fields: Field[];
  submitLabel: string;
  pendingLabel: string;
  siteKey?: string;
  hidden?: Record<string, string>;
  done?: string;
  stay?: boolean;
}) {
  const [message, setMessage] = useState<{ tone: 'error' | 'note'; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const widget = useTurnstile(siteKey);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const body: Record<string, string> = { ...hidden };
    for (const field of fields) {
      const value = form.get(field.name);
      body[field.name] = typeof value === 'string' ? value : '';
    }
    if (siteKey) {
      const token = widget.widgetId.current
        ? window.turnstile?.getResponse(widget.widgetId.current)
        : '';
      if (!token) {
        setMessage({ tone: 'error', text: 'Complete the verification check.' });
        return;
      }
      body.turnstileToken = token;
    }
    setPending(true);
    const result = await postJson(path, body);
    setPending(false);
    if (!result.ok) {
      if (widget.widgetId.current) window.turnstile?.reset(widget.widgetId.current);
      setMessage({ tone: 'error', text: messageFor(result.error) });
      return;
    }
    if (stay) {
      setMessage({ tone: 'note', text: done ?? 'Done.' });
      return;
    }
    window.location.assign('/app/');
  }

  return (
    <form className="auth-form" aria-busy={pending} onSubmit={(event) => void onSubmit(event)}>
      {fields.map((field, index) => (
        <div className="field" key={field.name}>
          <div className="field-label-row">
            <Label htmlFor={field.name}>{field.label}</Label>
            {field.extra ? (
              <a className="field-extra" href={field.extra.href}>
                {field.extra.label}
              </a>
            ) : null}
          </div>
          <div className={field.type === 'password' ? 'field-control' : undefined}>
            <Input
              id={field.name}
              name={field.name}
              className={field.type === 'password' ? 'mt-0 pr-11' : 'mt-0'}
              type={field.type === 'password' && showPassword ? 'text' : field.type}
              autoComplete={field.autoComplete}
              autoFocus={index === 0}
              minLength={field.minLength}
              maxLength={field.maxLength}
              inputMode={field.type === 'email' ? 'email' : undefined}
              autoCapitalize={field.type === 'email' ? 'none' : undefined}
              spellCheck={field.type === 'email' ? false : undefined}
              required
            />
            {field.type === 'password' ? (
              <PasswordToggle
                shown={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
              />
            ) : null}
          </div>
          {field.hint ? <p className="field-hint">{field.hint}</p> : null}
        </div>
      ))}
      {siteKey ? <div className="auth-turnstile" ref={widget.ref} /> : null}
      {message ? (
        <p
          className={message.tone === 'error' ? 'form-alert' : 'form-note'}
          role={message.tone === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      ) : null}
      <Button className="auth-submit" type="submit" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}

function useTurnstile(siteKey: string | undefined) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!siteKey || !element || widgetId.current) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(element, {
        sitekey: siteKey,
        action: 'sign-up',
        size: 'flexible',
      });
    };
    if (window.turnstile) {
      render();
      return () => {
        cancelled = true;
      };
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.dataset.turnstile = 'true';
    script.onload = render;
    document.head.appendChild(script);
    return () => {
      cancelled = true;
    };
  }, [siteKey, element]);

  return { ref: setElement, widgetId };
}

async function postJson(
  path: string,
  body: object,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await fetch(path, {
    method: path.endsWith('/profile') ? 'PATCH' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.ok) return { ok: true };
  const payload: unknown = await response.json().catch(() => null);
  const error =
    isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'request_failed';
  return { ok: false, error };
}

function messageFor(code: string): string {
  return errors[code] ?? 'The request failed.';
}

function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="field-reveal"
      aria-pressed={shown}
      aria-label={shown ? 'Hide password' : 'Show password'}
      onClick={onToggle}
    >
      {shown ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.73 5.08a10.74 10.74 0 0 1 11.2 6.57 1 1 0 0 1 0 .7 10.7 10.7 0 0 1-1.44 2.49" />
      <path d="M14.08 14.16a3 3 0 0 1-4.24-4.24" />
      <path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

function formatWhen(seconds: number): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(seconds * 1000));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUser(value: unknown): value is User {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.email === 'string' &&
    typeof value.name === 'string'
  );
}

function isSession(value: unknown): value is Session {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.createdAt === 'number' &&
    typeof value.expiresAt === 'number' &&
    typeof value.current === 'boolean'
  );
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: { sitekey: string; action: string; size?: 'flexible' },
      ) => string;
      getResponse: (widgetId: string) => string;
      reset: (widgetId: string) => void;
    };
  }
}
