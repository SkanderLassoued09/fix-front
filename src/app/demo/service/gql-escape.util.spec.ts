import { gqlDateLiteral, gqlStr } from './gql-escape.util';

describe('gqlStr', () => {
    it('échappe et remplace null/undefined par ""', () => {
        expect(gqlStr('a"b')).toBe('"a\\"b"');
        expect(gqlStr(null)).toBe('""');
        expect(gqlStr(undefined)).toBe('""');
    });
});

describe('gqlDateLiteral', () => {
    it('Date → "YYYY-MM-DD" en composantes locales', () => {
        expect(gqlDateLiteral(new Date(2026, 5, 10))).toBe('"2026-06-10"');
    });

    it('date ISO textuelle recopiée sans décalage de fuseau', () => {
        expect(gqlDateLiteral('2026-06-10')).toBe('"2026-06-10"');
        expect(gqlDateLiteral('2026-06-10T00:00:00.000Z')).toBe('"2026-06-10"');
    });

    it('vide, sentinelle ou date invalide → "" (jamais « Invalid Date »)', () => {
        for (const v of [null, undefined, '', 'Invalid Date', 'null', 'undefined', new Date('x')]) {
            expect(gqlDateLiteral(v)).toBe('""');
        }
    });
});
