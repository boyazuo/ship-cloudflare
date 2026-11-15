import { useEffect, useState } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useSession } from '@ship/auth/client';
import { z } from 'zod';

const metaSchema = z.object({
  name: z.string(),
  schemaVersion: z.string(),
  plugins: z.array(z.string()),
});

export const Route = createFileRoute('/')({
  component: AppHome,
});

function AppHome() {
  const [schemaVersion, setSchemaVersion] = useState<string | null>(null);
  const [plugins, setPlugins] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const session = useSession();

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/meta', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`meta ${response.status}`);
        const body: unknown = await response.json();
        const meta = metaSchema.parse(body);
        setSchemaVersion(meta.schemaVersion);
        setPlugins(meta.plugins);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFailed(true);
      });
    return () => controller.abort();
  }, []);

  const pending = !failed && schemaVersion === null;
  const title =
    session.status === 'loading'
      ? 'Home'
      : session.user
        ? session.user.name
        : 'Sign in to continue';
  const lede =
    session.status === 'loading'
      ? 'Reading session…'
      : session.user
        ? session.user.email
        : 'Writes stay closed until a session exists.';

  return (
    <main id="content" className="page">
      <header className="page-head">
        <h1>{title}</h1>
        <p className="page-lede">{lede}</p>
      </header>
      {session.status === 'anonymous' ? (
        <div className="page-actions">
          <Link to="/sign-in" className="text-button">
            Sign in
          </Link>
          <Link to="/sign-up" className="text-button-ghost">
            Create an account
          </Link>
        </div>
      ) : null}
      <section className="page-section" aria-busy={pending} aria-label="This Worker">
        <h2>This Worker</h2>
        <dl className="fact-list">
          <div>
            <dt>Schema version</dt>
            <dd className="tabular-nums" data-testid="schema-version">
              {failed ? 'Could not read' : (schemaVersion ?? 'Reading…')}
            </dd>
          </div>
          <div>
            <dt>Plugins</dt>
            <dd>
              {failed
                ? 'Could not read'
                : plugins === null
                  ? 'Reading…'
                  : plugins.length === 0
                    ? 'None enabled'
                    : plugins.join(', ')}
            </dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
