import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
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

  return (
    <main>
      <p className="mb-3 text-sm font-medium tracking-wide text-accent uppercase">Workspace</p>
      <h1 className="font-serif text-5xl font-medium tracking-tight">No session yet.</h1>
      <p className="mt-4 max-w-xl text-muted">
        Writes return auth_required until the auth plugin is enabled. This page only reads
        /api/meta.
      </p>
      <dl className="mt-8 grid gap-4 rounded-lg border border-border bg-card p-5 text-sm">
        <div>
          <dt className="text-muted">Schema version</dt>
          <dd className="font-medium" data-testid="schema-version">
            {failed ? 'Unavailable' : (schemaVersion ?? 'Loading')}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Plugins</dt>
          <dd className="font-medium">
            {failed
              ? 'Unavailable'
              : plugins === null
                ? 'Loading'
                : plugins.length === 0
                  ? 'None enabled'
                  : plugins.join(', ')}
          </dd>
        </div>
      </dl>
    </main>
  );
}
