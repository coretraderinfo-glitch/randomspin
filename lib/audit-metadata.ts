export function serializeAuditMetadata<T = unknown>(metadata: unknown): T {
  if (process.env.SQLITE_DATABASE_URL && !process.env.DATABASE_URL) {
    return JSON.stringify(metadata) as T;
  }

  return metadata as T;
}
