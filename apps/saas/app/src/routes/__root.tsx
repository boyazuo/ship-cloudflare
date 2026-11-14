import { Link, Outlet, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <header className="mb-12 flex items-center justify-between gap-4">
          <Link className="font-semibold text-foreground no-underline" to="/">
            Ship SaaS
          </Link>
          <nav className="flex gap-4 text-sm">
            <a className="text-foreground no-underline" href="/">
              Site
            </a>
            <Link className="text-foreground no-underline" to="/">
              App
            </Link>
            <Link className="text-foreground no-underline" to="/settings">
              Settings
            </Link>
          </nav>
        </header>
        <Outlet />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <main>
      <h1 className="font-serif text-4xl font-medium">Page not in the app shell</h1>
      <p className="mt-3 text-muted">This path is still inside /app, so the shell handles it.</p>
    </main>
  );
}
