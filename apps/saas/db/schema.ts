import { auditEvent, session, user } from '@ship/auth';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Plugin tables are added here by editing this file.
 * Auth does not add tenants. A user-owned table includes a non-null user_id in the migration that creates it.
 */
export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export { auditEvent, session, user };

export const schema = {
  appMeta,
  user,
  session,
  auditEvent,
};
