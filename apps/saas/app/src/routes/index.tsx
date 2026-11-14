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

  const pending = !failed && schemaVersion === null;

  return (
    <main id="content">
      <h1 className="text-3xl font-semibold tracking-tight">No session yet.</h1>
      <p className="mt-3 max-w-lg text-base leading-7 text-muted">
        Writes return auth_required until the auth plugin is enabled. This page only reads /api/meta.
      </p>
      <dl
        className="mt-8 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
        aria-busy={pending}
      >
        <div className="flex items-baseline justify-between gap-6 px-5 py-4">
          <dt className="text-sm text-muted">Schema version</dt>
          <dd className="text-sm font-medium tabular-nums" data-testid="schema-version">
            {failed ? 'Could not read' : (schemaVersion ?? 'Reading')}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-6 px-5 py-4">
          <dt className="text-sm text-muted">Plugins</dt>
          <dd className="text-right text-sm font-medium">
            {failed
              ? 'Could not read'
              : plugins === null
                ? 'Reading'
                : plugins.length === 0
                  ? 'None enabled'
                  : plugins.join(', ')}
          </dd>
        </div>
      </dl>
    </main>
  );
}
