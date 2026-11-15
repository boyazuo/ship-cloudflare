import type { Hono } from 'hono';

/**
 * A plugin is imported statically by the app. Workers cannot discover packages at runtime.
 * Auth is users and sessions only. A user-owned table includes user_id from its first migration.
 */
export interface ShipPlugin {
  id: string;
  version: string;
  tables?: Readonly<Record<string, unknown>>;
  /** Generic because Hono's Bindings parameter is invariant across apps. */
  mount?: <Bindings extends object>(app: Hono<{ Bindings: Bindings }>) => void;
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
