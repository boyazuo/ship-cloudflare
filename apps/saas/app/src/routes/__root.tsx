import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Outlet, createRootRoute, useRouterState } from '@tanstack/react-router';
import { useSession } from '@ship/auth/client';

const authRoutes = new Set(['/sign-in', '/sign-up', '/reset']);

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  const routeId = useRouterState({ select: (state) => state.matches.at(-1)?.routeId });
  const Frame = routeId && authRoutes.has(routeId) ? AuthFrame : Shell;
  return (
    <Frame>
      <Outlet />
    </Frame>
  );
}

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="auth-screen">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <aside className="auth-aside">
        <a className="auth-brand" href="/">
          <Mark ink="var(--foreground)" />
          Ship SaaS
        </a>
        <div className="auth-aside-body">
          <p className="auth-aside-title">
            A SaaS shell
            <br />
            on one Worker.
          </p>
          <p className="auth-aside-copy">
            Signing in opens a session stored in D1. Public pages stay static.
          </p>
        </div>
      </aside>
      <div className="auth-main">
        <a className="auth-brand auth-brand-mobile" href="/">
          <Mark />
          Ship SaaS
        </a>
        {children}
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="app-frame">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <aside className="shell-side">
        <a className="shell-brand" href="/app/">
          <Mark />
          Ship SaaS
        </a>
        <nav aria-label="Application" className="app-nav">
          <Link to="/" activeOptions={{ exact: true }}>
            <HomeIcon />
            Home
          </Link>
        </nav>
        <div className="shell-foot">
          <AccountLink />
        </div>
      </aside>
      <div className="shell-main">
        <div className="shell-content">{children}</div>
      </div>
    </div>
  );
}

function AccountLink() {
  const { user, status } = useSession();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (status === 'loading') {
    return <span className="account-pending" aria-hidden="true" />;
  }
  if (!user) {
    return (
      <Link to="/sign-in" className="sign-in-link">
        Sign in
      </Link>
    );
  }
  const initial = user.name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="account-menu" ref={menu}>
      <button
        type="button"
        className="account-row"
        aria-label={`${user.name}, account`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="account-menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-mark">{initial}</span>
        <span className="account-meta">
          <span className="account-name">{user.name}</span>
          <span className="account-email">{user.email}</span>
        </span>
        <MoreIcon />
      </button>
      {open ? (
        <div id="account-menu" className="account-popover">
          <p className="account-popover-id">
            <span>{user.name}</span>
            <span>{user.email}</span>
          </p>
          <Link to="/settings" onClick={() => setOpen(false)}>
            <SettingsIcon />
            Settings
          </Link>
          <a href="/" onClick={() => setOpen(false)}>
            <HomepageIcon />
            Homepage
          </a>
          <div className="account-popover-foot">
            <button type="button" onClick={() => void logOut()}>
              <LogoutIcon />
              Log out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

async function logOut() {
  const response = await fetch('/api/auth/sign-out', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  if (response.ok) window.location.assign('/app/');
}

function NavGlyph({ children }: { children: ReactNode }) {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

function HomeIcon() {
  return (
    <NavGlyph>
      <path d="M4 10.8 12 4l8 6.8" />
      <path d="M7 10.2V20h10V10.2" />
    </NavGlyph>
  );
}

function SettingsIcon() {
  return (
    <NavGlyph>
      <path d="M4 6H6.2M9.8 6H20M4 12H13.2M16.8 12H20M4 18H5.2M8.8 18H20" />
      <circle cx="8" cy="6" r="1.7" />
      <circle cx="15" cy="12" r="1.7" />
      <circle cx="7" cy="18" r="1.7" />
    </NavGlyph>
  );
}

function MoreIcon() {
  return (
    <svg className="account-more" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <NavGlyph>
      <path d="M10 7V5H5v14h5v-2" />
      <path d="M10 12h9" />
      <path d="m16 8 4 4-4 4" />
    </NavGlyph>
  );
}

function HomepageIcon() {
  return (
    <NavGlyph>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9h17" />
    </NavGlyph>
  );
}

function Mark({ ink = 'var(--background)' }: { ink?: string }) {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M16 7.5 24.5 23h-4.1L16 15.2 11.6 23H7.5Z" fill={ink} />
    </svg>
  );
}

function NotFound() {
  return (
    <main id="content" className="page">
      <header className="page-head">
        <h1>Page not in the app shell</h1>
        <p className="page-lede">This path is still inside /app, so the shell handles it.</p>
      </header>
      <div className="page-actions">
        <Link to="/" className="text-button">
          Back to home
        </Link>
      </div>
    </main>
  );
}
