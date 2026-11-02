export function assertTestDatabaseUrl(databaseUrl: string | undefined): void {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for test database operations")

  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error("DATABASE_URL is not a valid URL")
  }

  const databaseName = parsed.pathname.replace(/^\//, "")
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Refusing to modify non-test database "${databaseName || "(none)"}"; the database name must end with "_test"`,
    )
  }
}
