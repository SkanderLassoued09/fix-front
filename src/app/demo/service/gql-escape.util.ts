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

/**
 * Date → GraphQL literal `"YYYY-MM-DD"`, with no timezone shift: an ISO string
 * is cut textually, a Date object uses its LOCAL parts. Empty, sentinel or
 * invalid → `""` — never the text « Invalid Date » nor a raw `Date.toString()`,
 * both of which used to be written into `composants.coming_date`.
 */
export const gqlDateLiteral = (value: any): string => {
    if (value === null || value === undefined || value === '') return gqlStr('');
    if (typeof value === 'string') {
        const iso = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
        if (iso) return gqlStr(iso[1]);
    }
    const dt = value instanceof Date ? value : new Date(value);
    if (isNaN(dt.getTime())) return gqlStr('');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return gqlStr(`${dt.getFullYear()}-${mm}-${dd}`);
};
