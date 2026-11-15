import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Plugin tables are added here by editing this file.
 * Auth does not add tenants. A user-owned table includes a non-null user_id in the migration that creates it.
 */
export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const schema = {
  appMeta,
};
