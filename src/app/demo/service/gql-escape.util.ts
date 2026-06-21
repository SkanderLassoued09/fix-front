/**
 * Serialize a value as a GraphQL string literal (including the surrounding
 * quotes), safely escaping double-quotes, backslashes and newlines. Use this
 * instead of `"${value}"` when interpolating user input into a gql template so
 * a stray `"` (e.g. in an address, description or password) can't break the
 * query and silently fail the request.
 *
 *   first_name: ${gqlStr(info.first_name)}
 */
export const gqlStr = (value: any): string => JSON.stringify(value ?? '');
