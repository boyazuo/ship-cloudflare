import { apiError, createApp, rejectUnauthenticatedWrite } from '@ship/worker-kit';
import { checkBindings, listPluginIds } from '@ship/plugin-sdk';
import { appConfig } from '../app.config';
import { serveAppShell } from './assets';
import { plugins } from './plugins';

/** Result of the binding check. This is process configuration, not request data. */
let bindingsChecked = false;
let missingBindings: readonly string[] = [];

export function createSaasApp() {
  const app = createApp<{ Bindings: Env }>();

  app.use('/api/*', async (c, next) => {
    if (!bindingsChecked) {
      bindingsChecked = true;
      missingBindings = checkBindings(plugins, c.env);
      if (missingBindings.length > 0) {
        console.error(
          JSON.stringify({ message: 'plugin binding missing', missing: missingBindings }),
        );
      }
    }
    if (missingBindings.length > 0) return apiError(c, 'plugin_binding_missing', 500);
    await next();
  });

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.get('/api/meta', async (c) => {
    const row = await c.env.DB.prepare('SELECT value FROM app_meta WHERE key = ?1')
      .bind('schema_version')
      .first<{ value: string }>();
    if (!row) return apiError(c, 'meta_missing', 500);
    return c.json({
      name: appConfig.app.name,
      schemaVersion: row.value,
      plugins: listPluginIds(plugins),
    });
  });

  app.on(['POST', 'PUT', 'PATCH', 'DELETE'], '/api/*', (c) => rejectUnauthenticatedWrite(c));
  app.on(['POST', 'PUT', 'PATCH', 'DELETE'], '/api', (c) => rejectUnauthenticatedWrite(c));
  app.all('/api', (c) => apiError(c, 'not_found', 404));

  app.all('/app', (c) => serveAppShell(c.req.raw, c.env.ASSETS));
  app.all('/app/', (c) => serveAppShell(c.req.raw, c.env.ASSETS));
  app.all('/app/*', (c) => serveAppShell(c.req.raw, c.env.ASSETS));

  app.notFound((c) => {
    if (c.req.path.startsWith('/api')) return apiError(c, 'not_found', 404);
    return c.env.ASSETS.fetch(c.req.raw);
  });

  return app;
}

export default createSaasApp();
