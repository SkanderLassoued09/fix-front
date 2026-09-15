import { DateTime, Duration } from 'luxon';

/**
 * SOURCE UNIQUE du traitement des dates côté front (Luxon).
 *
 * Toute date affichée à l'utilisateur passe par ici : même fuseau (Tunis, sans
 * heure d'été), même format, même lecture des chaînes héritées. Avant, trois
 * formateurs coexistaient (Intl, `DatePipe` au fuseau du NAVIGATEUR,
 * `toLocaleString`) et une chaîne de pause `2026/09/14:10:05:33` passée à
 * `new Date()` donnait silencieusement le 01/09 à 14 h 10 — jour et heure faux.
 */
export const APP_ZONE = 'Africa/Tunis';
export const APP_LOCALE = 'fr';

export type DateInput = Date | DateTime | string | number | null | undefined;

/** Format écrit par `tech-di-list` (`moment().format('YYYY/MM/DD:HH:mm:ss')`),
 *  heure MURALE du poste — donc de Tunis. */
const LEGACY_PAUSE_RE = /^\d{4}\/\d{2}\/\d{2}:\d{2}:\d{2}:\d{2}$/;
/** Epoch en millisecondes sérialisé en chaîne. ≥ 10 chiffres : « 2026 » seul
 *  reste une année, pas 2 secondes après 1970. */
const EPOCH_RE = /^\d{10,}$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMMSS_RE = /^(\d+):([0-5]\d):([0-5]\d)$/;

function parseString(raw: string): DateTime | null {
    const s = raw.trim();
    if (!s) return null;
    if (LEGACY_PAUSE_RE.test(s)) {
        return DateTime.fromFormat(s, 'yyyy/MM/dd:HH:mm:ss', { zone: APP_ZONE });
    }
    if (EPOCH_RE.test(s)) return DateTime.fromMillis(Number(s));
    // Date seule : lue en UTC, exactement comme `new Date('yyyy-MM-dd')`, pour
    // ne pas décaler les écrans qui l'affichaient déjà ainsi.
    if (DATE_ONLY_RE.test(s)) return DateTime.fromISO(s, { zone: 'utc' });
    // ISO : un décalage explicite (`Z`, `+01:00`) fixe l'instant ; sans
    // décalage, c'est une heure murale de Tunis.
    const iso = DateTime.fromISO(s, { zone: APP_ZONE });
    if (iso.isValid) return iso;
    const sql = DateTime.fromSQL(s, { zone: APP_ZONE });
    if (sql.isValid) return sql;
    // Dernier recours : RFC 2822 / `Date#toString()` (données héritées).
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : DateTime.fromJSDate(d);
}

/** Toute entrée de date → `DateTime` au fuseau de l'application, ou `null`.
 *  Ne lève jamais. */
export function toDateTime(v: DateInput): DateTime | null {
    if (v === null || v === undefined) return null;
    let dt: DateTime | null = null;
    if (DateTime.isDateTime(v)) dt = v;
    else if (v instanceof Date) {
        dt = Number.isNaN(v.getTime()) ? null : DateTime.fromJSDate(v);
    } else if (typeof v === 'number') {
        dt = Number.isFinite(v) ? DateTime.fromMillis(v) : null;
    } else if (typeof v === 'string') {
        dt = parseString(v);
    }
    if (!dt || !dt.isValid) return null;
    return dt.setZone(APP_ZONE).setLocale(APP_LOCALE);
}

/** Instant en millisecondes, ou `null` si l'entrée n'est pas une date. */
export function toEpochMs(v: DateInput): number | null {
    return toDateTime(v)?.toMillis() ?? null;
}

/** « dd/MM/yyyy HH:mm » (ou « …:ss »), heure de Tunis. */
export function fmtDateTime(
    v: DateInput,
    opts: { seconds?: boolean; fallback?: string } = {},
): string {
    const dt = toDateTime(v);
    if (!dt) return opts.fallback ?? '—';
    return dt.toFormat(opts.seconds ? 'dd/MM/yyyy HH:mm:ss' : 'dd/MM/yyyy HH:mm');
}

/**
 * Durée EXACTE à la seconde : « 2 j 03 h 12 min 05 s », « 1 min 05 s »,
 * « 4 s », « 0 s ». La première unité n'est pas complétée, les suivantes le
 * sont sur 2 chiffres. `days: false` replie les jours dans les heures
 * (« 44 h 06 min 55 s ») — c'est l'unité du temps facturé, tarifé à l'heure.
 */
export function fmtDurationPrecise(
    ms: number | null | undefined,
    opts: { days?: boolean; fallback?: string } = {},
): string {
    const fallback = opts.fallback ?? '—';
    if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) {
        return fallback;
    }
    const units =
        opts.days === false
            ? (['hours', 'minutes', 'seconds'] as const)
            : (['days', 'hours', 'minutes', 'seconds'] as const);
    const o = Duration.fromMillis(Math.floor(ms / 1000) * 1000)
        .shiftTo(...units)
        .toObject();
    const parts: Array<[number, string]> = [
        [o.days ?? 0, 'j'],
        [o.hours ?? 0, 'h'],
        [o.minutes ?? 0, 'min'],
        [o.seconds ?? 0, 's'],
    ];
    const first = parts.findIndex(([n]) => n > 0);
    // Un écart réel de quelques millisecondes n'est pas « 0 s » : on le dit.
    if (first < 0) return ms > 0 ? '< 1 s' : '0 s';
    return parts
        .slice(first)
        .map(([n, u], i) => `${i === 0 ? n : String(n).padStart(2, '0')} ${u}`)
        .join(' ');
}

/** « HH:MM:SS » persisté (heures illimitées, espace hérité toléré) → ms. */
export function hhmmssToMs(v: string | null | undefined): number | null {
    if (typeof v !== 'string') return null;
    const m = HHMMSS_RE.exec(v.trim());
    if (!m) return null;
    return (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000;
}

/** ms → « HH:MM:SS » (heures au-delà de 99 permises), format du back. */
export function msToHhmmss(ms: number | null | undefined): string {
    if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) {
        return '—';
    }
    const total = Math.floor(ms / 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Libellé exact d'un cumul « HH:MM:SS » persisté (heures par défaut). */
export function fmtHhmmss(
    v: string | null | undefined,
    opts: { days?: boolean; fallback?: string } = {},
): string {
    const ms = hhmmssToMs(v);
    if (ms === null) return opts.fallback ?? '—';
    return fmtDurationPrecise(ms, { days: opts.days ?? false });
}
