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

/**
 * Valeurs qui signifient « aucun emplacement réel ». Le back renvoie
 * littéralement `'N/A'` quand le populate de `location_id` ne résout rien
 * (di.service : `location_name: (di.location_id)?.location_name ?? 'N/A'`), et
 * `formatTableValue` rend `'—'` pour null/''. On couvre aussi `_` / `Sans`,
 * mêmes sentinelles que la logique « manquant » des archives DI (isDocMissing).
 */
const EMPLACEMENT_VIDE = new Set([
    '',
    'n/a',
    'na',
    TABLE_EMPTY_VALUE.toLowerCase(), // '—'
    '_',
    'sans',
    'null',
    'undefined',
]);

/**
 * L'emplacement AFFICHÉ de la ligne est-il vide ? Pilote la couleur du point de
 * la colonne LOCATION : vide → VERT, renseigné → ROUGE.
 *
 * On évalue la valeur RENDUE (`formatTableValue`) et non le champ brut : c'est
 * exactement ce que l'utilisateur voit, et ça couvre d'un coup null/''/'—'/'N/A'.
 */
export function isEmplacementVide(row: any, field: string): boolean {
    const shown = formatTableValue(row, field).trim().toLowerCase();
    return EMPLACEMENT_VIDE.has(shown);
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

