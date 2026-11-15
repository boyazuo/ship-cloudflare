import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  resetTokenHash: text('reset_token_hash').unique(),
  resetExpiresAt: integer('reset_expires_at'),
  createdAt: integer('created_at').notNull(),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: integer('expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('session_user_id').on(table.userId)],
);

/** Append-only. No user foreign key, so a delete can keep the audit row. */
export const auditEvent = sqliteTable(
  'audit_event',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    action: text('action').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('audit_event_user_id').on(table.userId)],
);

export const tables = { user, session, auditEvent };
