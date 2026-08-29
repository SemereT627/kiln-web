/**
 * Sanitizes a user-supplied string before it's spliced into a raw PostgREST
 * `.or()`/`.ilike()` filter string (e.g. `q.or(\`name.ilike.%${term}%\`)`).
 * The Supabase JS client has no built-in escaping for these — comma and
 * parens are structural (condition separator / grouping) in `.or()`, so an
 * unescaped one lets the caller inject extra filter clauses. Stripped rather
 * than escaped: PostgREST's own escaping rules are version-finicky, and a
 * search term never legitimately needs these characters.
 */
export function sanitizeSearchTerm(input: string): string {
  return input.replace(/[,()%*\\"]/g, "").trim();
}

/**
 * Restricts a caller-supplied `sortBy` value to a known-safe set of columns
 * before it reaches `.order()`. An unrecognized column name there throws a
 * raw Postgres error straight back to the client — this just falls back to
 * the default instead.
 */
export function pickSortColumn(
  value: string,
  allowed: readonly string[],
  fallback: string,
): string {
  return allowed.includes(value) ? value : fallback;
}
