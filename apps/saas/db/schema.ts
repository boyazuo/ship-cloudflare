import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Plugin tables are added here by editing this file.
 * A table that stores tenant data must include a non-null tenant_id in the migration that creates it.
 * This template has no tenant rows yet, because there is no session to take the id from.
 */
export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const schema = {
  appMeta,
};
