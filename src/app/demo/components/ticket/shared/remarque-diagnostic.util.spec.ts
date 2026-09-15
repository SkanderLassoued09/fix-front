import {
    REMARQUE_TECH_SEPARATOR,
    splitRemarqueDiagnostic,
} from './remarque-diagnostic.util';

describe('splitRemarqueDiagnostic', () => {
    it('sépare la description et la remarque technicien', () => {
        expect(
            splitRemarqueDiagnostic('vghjk;\n\nRemarque technicien :\nvbn,'),
        ).toEqual({ description: 'vghjk;', remarque: 'vbn,' });
    });

    it('sans séparateur : tout le texte est la description', () => {
        expect(splitRemarqueDiagnostic('  Écran cassé  ')).toEqual({
            description: 'Écran cassé',
            remarque: '',
        });
    });

    it('description vide : le texte commence par le séparateur', () => {
        expect(
            splitRemarqueDiagnostic(`${REMARQUE_TECH_SEPARATOR}Nappe à recommander.`),
        ).toEqual({ description: '', remarque: 'Nappe à recommander.' });
    });

    it('null, undefined ou vide → deux parts vides', () => {
        const empty = { description: '', remarque: '' };
        expect(splitRemarqueDiagnostic(null)).toEqual(empty);
        expect(splitRemarqueDiagnostic(undefined)).toEqual(empty);
        expect(splitRemarqueDiagnostic('   ')).toEqual(empty);
    });

    it('ne coupe qu’à la première occurrence du séparateur', () => {
        expect(
            splitRemarqueDiagnostic(
                `A${REMARQUE_TECH_SEPARATOR}B${REMARQUE_TECH_SEPARATOR}C`,
            ),
        ).toEqual({ description: 'A', remarque: `B${REMARQUE_TECH_SEPARATOR}C` });
    });
});
