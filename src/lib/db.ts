export async function firstRow<T>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T | null> {
  return db.prepare(sql).bind(...params).first<T>();
}

export async function runStatement(
  db: D1Database,
  sql: string,
  ...params: unknown[]
) {
  return db.prepare(sql).bind(...params).run();
}
