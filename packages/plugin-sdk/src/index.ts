import type { Hono } from 'hono';

/**
 * A plugin is imported statically by the app. Workers cannot discover packages at runtime.
 * Business tables that belong to a tenant include tenant_id from their first migration.
 */
export interface ShipPlugin<Bindings extends object = Record<string, never>> {
  id: string;
  version: string;
  tables?: Readonly<Record<string, unknown>>;
  mount?: (app: Hono<{ Bindings: Bindings }>) => void;
  requiredBindings?: readonly string[];
  clientRoutes?: string;
}

export function listPluginIds(plugins: readonly ShipPlugin[]): string[] {
  return plugins.map((plugin) => plugin.id);
}

export function checkBindings(plugins: readonly ShipPlugin[], env: object): string[] {
  const missing: string[] = [];
  for (const plugin of plugins) {
    for (const binding of plugin.requiredBindings ?? []) {
      if (!hasBinding(env, binding)) missing.push(`${plugin.id}:${binding}`);
    }
  }
  return missing;
}

function hasBinding(env: object, binding: string): boolean {
  if (!(binding in env)) return false;
  const value: unknown = Reflect.get(env, binding);
  return value != null;
}
