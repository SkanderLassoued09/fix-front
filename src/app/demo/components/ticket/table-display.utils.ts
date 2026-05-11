export const TABLE_EMPTY_VALUE = '—';

export function formatTableValue(row: any, field: string): string {
    const value = row?.[field];

    if (value === null || value === undefined || value === '') {
        return TABLE_EMPTY_VALUE;
    }

    if (typeof value !== 'object') {
        return String(value);
    }

    if (Array.isArray(value)) {
        return value.length ? String(value.length) : TABLE_EMPTY_VALUE;
    }

    const firstLast = [value.first_name || value.firstName, value.last_name || value.lastName]
        .filter(Boolean)
        .join(' ');

    return (
        firstLast ||
        value.company_name ||
        value.name ||
        value.location_name ||
        value.username ||
        value.title ||
        value._idnum ||
        value._id ||
        TABLE_EMPTY_VALUE
    );
}

export function rowHasLoadedComposants(row: any): boolean {
    const candidates = [
        row?.array_composants,
        row?.composants,
        row?.composantCombo,
        row?.allComposants,
    ];

    return candidates.some((value) => Array.isArray(value) && value.length > 0);
}

export function isLocationColumn(field: string): boolean {
    return [
        'location',
        'location_id',
        'location_name',
        'emplacement',
    ].includes(field);
}

export function trackByColumn(_: number, col: any): string {
    return col?.field || col?.name || String(_);
}

