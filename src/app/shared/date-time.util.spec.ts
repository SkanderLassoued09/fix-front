import { DateTime } from 'luxon';
import {
    fmtDateTime,
    fmtDurationPrecise,
    fmtHhmmss,
    hhmmssToMs,
    msToHhmmss,
    toDateTime,
    toEpochMs,
} from './date-time.util';

/** Tous les instants attendus sont en ISO UTC : le résultat ne dépend pas du
 *  fuseau de la machine qui exécute les tests. */
const iso = (v: any) => toDateTime(v)?.toUTC().toISO();

describe('toDateTime', () => {
    it('lit la chaîne de pause héritée comme une heure murale de Tunis', () => {
        expect(iso('2026/07/29:11:45:24')).toBe('2026-07-29T10:45:24.000Z');
    });

    it('corrige le cas signalé que `new Date()` rendait au 01/09 à 13 h 10 UTC', () => {
        expect(iso('2026/09/14:10:05:33')).toBe('2026-09-14T09:05:33.000Z');
    });

    it('conserve l’instant d’un ISO avec décalage, d’une Date et d’un epoch', () => {
        const at = '2026-08-26T08:46:29.079Z';
        expect(iso(at)).toBe(at);
        expect(iso('2026-08-26T09:46:29.079+01:00')).toBe(at);
        expect(iso(new Date(at))).toBe(at);
        expect(iso(Date.parse(at))).toBe(at);
        expect(iso(String(Date.parse(at)))).toBe(at);
        expect(iso(DateTime.fromISO(at))).toBe(at);
    });

    it('lit un ISO SANS décalage comme heure de Tunis', () => {
        expect(iso('2026-09-14T10:00:00')).toBe('2026-09-14T09:00:00.000Z');
    });

    it('lit une date seule comme `new Date()` (minuit UTC)', () => {
        expect(iso('2026-09-14')).toBe('2026-09-14T00:00:00.000Z');
    });

    it('rend null sur toute entrée invalide, sans lever', () => {
        for (const bad of [
            null,
            undefined,
            '',
            '   ',
            'abc',
            NaN,
            Infinity,
            new Date('x'),
            '2026/13/40:99:99:99',
            {} as any,
        ]) {
            expect(toDateTime(bad)).withContext(String(bad)).toBeNull();
        }
        expect(toEpochMs('abc')).toBeNull();
    });

    it('Tunis n’a pas d’heure d’été : UTC+1 en hiver comme en été', () => {
        expect(toDateTime('2026-01-15T12:00:00Z')?.offset).toBe(60);
        expect(toDateTime('2026-07-15T12:00:00Z')?.offset).toBe(60);
    });
});

describe('fmtDateTime', () => {
    it('formate à la minute ou à la seconde, heure de Tunis', () => {
        expect(fmtDateTime('2026-08-26T08:46:29.079Z')).toBe('26/08/2026 09:46');
        expect(fmtDateTime('2026-08-26T08:46:29.079Z', { seconds: true })).toBe(
            '26/08/2026 09:46:29',
        );
    });

    it('bascule de jour et d’année selon Tunis, pas selon UTC', () => {
        expect(fmtDateTime('2026-12-31T23:30:00Z')).toBe('01/01/2027 00:30');
        expect(fmtDateTime('2026-03-01T23:00:00Z')).toBe('02/03/2026 00:00');
    });

    it('rend le repli sur une date absente', () => {
        expect(fmtDateTime(null)).toBe('—');
        expect(fmtDateTime('nope', { fallback: 'n/c' })).toBe('n/c');
    });
});

describe('fmtDurationPrecise', () => {
    const D = 86_400_000;
    const H = 3_600_000;
    const M = 60_000;
    it('rend la durée exacte à la seconde', () => {
        expect(fmtDurationPrecise(0)).toBe('0 s');
        expect(fmtDurationPrecise(999)).toBe('< 1 s');
        expect(fmtDurationPrecise(4000)).toBe('4 s');
        expect(fmtDurationPrecise(65_000)).toBe('1 min 05 s');
        expect(fmtDurationPrecise(H)).toBe('1 h 00 min 00 s');
        expect(fmtDurationPrecise(2 * D + 3 * H + 12 * M + 5000)).toBe(
            '2 j 03 h 12 min 05 s',
        );
    });

    it('replie les jours dans les heures pour un cumul facturé', () => {
        expect(fmtDurationPrecise(158_809_780, { days: false })).toBe(
            '44 h 06 min 49 s',
        );
    });

    it('rend le repli sur une durée impossible', () => {
        expect(fmtDurationPrecise(-1)).toBe('—');
        expect(fmtDurationPrecise(NaN)).toBe('—');
        expect(fmtDurationPrecise(Infinity)).toBe('—');
        expect(fmtDurationPrecise(null)).toBe('—');
    });
});

describe('HH:MM:SS', () => {
    it('lit les cumuls persistés, y compris hérités avec espace', () => {
        expect(hhmmssToMs('44:06:55')).toBe(158_815_000);
        expect(hhmmssToMs(' 01:58:50')).toBe(7_130_000);
        expect(hhmmssToMs('120:00:00')).toBe(432_000_000);
        expect(hhmmssToMs('1:2:3')).toBeNull();
        expect(hhmmssToMs('00:60:00')).toBeNull();
        expect(hhmmssToMs(null)).toBeNull();
    });

    it('fait l’aller-retour et produit un libellé lisible', () => {
        expect(msToHhmmss(hhmmssToMs('44:06:55'))).toBe('44:06:55');
        expect(msToHhmmss(-5)).toBe('—');
        expect(fmtHhmmss('44:06:55')).toBe('44 h 06 min 55 s');
        expect(fmtHhmmss('00:00:00')).toBe('0 s');
        expect(fmtHhmmss('')).toBe('—');
    });
});
