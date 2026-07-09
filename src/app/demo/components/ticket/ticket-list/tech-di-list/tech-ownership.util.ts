/**
 * Frontend mirror of the backend technician-ownership rule
 * (fix-back/src/auth/tech-ownership.ts). Kept as a tiny pure module so it is
 * unit-testable without spinning up the 4k-line component.
 *
 * A DI row's assigned-technician field (`id_tech_diag` / `id_tech_rep`) usually
 * holds the Profile `_id`, but historically some records hold the `username`.
 * The old check `row.id_tech_diag !== idTech` compared only against the stored
 * `_id`, which greyed an ADMIN_TECH's OWN DIs whenever they were stored under a
 * different identity token. Matching either `_id` OR `username` (both
 * normalized) fixes that without loosening the rule.
 */

export type TechAssignmentKind = 'diag' | 'rep';

/** Coerce an id/name/object identity value to a comparable trimmed string. */
export function normalizeIdentity(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const nested = obj['_id'] ?? obj['username'] ?? obj['id'];
    if (nested !== null && nested !== undefined) {
      return normalizeIdentity(nested);
    }
    // Raw ObjectId / Buffer / etc. → its own string form (hex).
    return String(value).trim();
  }
  return String(value).trim();
}

/**
 * True when `assigned` (the row's id_tech_diag / id_tech_rep) identifies the
 * current user, given the user's identity tokens (its `_id` and `username`).
 * An empty/unknown assignee never matches.
 */
export function techIdentityMatches(
  assigned: unknown,
  currentUserTokens: Array<string | null | undefined>,
): boolean {
  const target = normalizeIdentity(assigned);
  if (target === '') {
    return false;
  }
  return currentUserTokens
    .map((t) => normalizeIdentity(t))
    .some((t) => t !== '' && t === target);
}

/** True when the DI row's <kind> technician is the current user. */
export function isDiAssignedToMe(
  row: any,
  kind: TechAssignmentKind,
  currentUserTokens: Array<string | null | undefined>,
): boolean {
  const assigned = kind === 'diag' ? row?.id_tech_diag : row?.id_tech_rep;
  return techIdentityMatches(assigned, currentUserTokens);
}
