# Plugins

Plugins are not loaded by scanning this directory. A Worker bundle must see every import at build time.

`auth` is enabled. It owns `user`, `session`, and `audit_event`. It does not create tenants. The user id comes from the verified session, not from a field the caller chooses. The design note is [auth/DESIGN.md](auth/DESIGN.md).

To enable another plugin:

1. Add the package and import it in `apps/saas/worker/plugins.ts`.
2. Re-export its Drizzle tables from `apps/saas/db/schema.ts`, generate a new SQL file under `apps/saas/migrations/`, and commit that file. Applied migration files are append-only.
3. Declare every binding it requires in `apps/saas/wrangler.jsonc`, including the local config and each environment. Then run `pnpm cf:types` and commit `worker-configuration.d.ts`.
4. If it has a user interface, import `clientRoutes` from the application shell with a static import.

Tables that store a user's data include a non-null `user_id` in the migration that creates them.

Wrangler reads migrations only from `apps/saas/migrations`. SQL checked into a plugin package is a draft until the app copies it into that directory.

What to build next, and in which order, is in the [follow-up plan](../docs/2.%20Ship%20Cloudflare%20后续开发计划.md). Each plugin gets its own design note before implementation.
