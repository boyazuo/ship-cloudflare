import type { ReactNode } from 'react';
import { Link, Outlet, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <div className="md:grid md:min-h-screen md:grid-cols-[14.5rem_minmax(0,1fr)]">
        <aside className="border-b border-border md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-r md:border-b-0">
          <a
            className="flex items-center gap-2 px-4 py-4 text-[0.95rem] font-semibold tracking-tight text-foreground no-underline md:px-5 md:pt-6"
            href="/app/"
          >
            <Mark />
            Ship SaaS
          </a>
          <nav
            aria-label="Application"
            className="app-nav flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:px-3"
          >
            <Link to="/" activeOptions={{ exact: true }}>
              Home
            </Link>
            <Link to="/settings">Settings</Link>
            <a className="md:mt-auto" href="/">
              Public site
            </a>
          </nav>
        </aside>
        <div className="px-5 py-8 md:px-12 md:py-12">
          <div className="w-full max-w-xl">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Mark() {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M16 7.5 24.5 23h-4.1L16 15.2 11.6 23H7.5Z" fill="var(--background)" />
    </svg>
  );
}

function NotFound() {
  return (
    <main id="content">
      <p className="text-sm font-medium text-muted">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Page not in the app shell</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-muted">
        This path is still inside /app, so the shell handles it.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground no-underline hover:bg-accent-hover"
      >
        Back to home
      </Link>
    </main>
  );
}
