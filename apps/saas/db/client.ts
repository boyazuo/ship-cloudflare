import { drizzle } from 'drizzle-orm/d1';
import { schema } from './schema';

export function createDb(database: D1Database) {
  return drizzle(database, { schema });
}

export type AppDatabase = ReturnType<typeof createDb>;

/** D1 rejects Drizzle's BEGIN / SAVEPOINT transactions. Multi-statement writes go through batch(). */
export function batch(
  database: D1Database,
  statements: readonly D1PreparedStatement[],
): Promise<D1Result<unknown>[]> {
  const [first, ...rest] = statements;
  if (!first) return Promise.resolve([]);
  return database.batch([first, ...rest]);
}
