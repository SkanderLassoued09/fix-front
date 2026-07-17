import { isEmplacementVide, formatTableValue, isLocationColumn } from './table-display.utils';

describe('isEmplacementVide — couleur du point de la colonne LOCATION', () => {
    const F = 'location_name';
    const row = (v: any) => ({ [F]: v });

    describe('emplacement RENSEIGNÉ → rouge (isEmplacementVide = false)', () => {
        ['A0', 'A01', 'A03', 'A05', 'A13', 'A75'].forEach((v) => {
            it(`« ${v} » est renseigné`, () => {
                expect(isEmplacementVide(row(v), F)).toBe(false);
            });
        });
    });

    describe('emplacement VIDE → vert (isEmplacementVide = true)', () => {
        // Sentinelles validées : null, '', N/A, —, _, Sans.
        // 'N/A' vient du back : di.service renvoie `?? 'N/A'` quand le populate
        // de location_id ne résout rien ; '—' vient de formatTableValue.
        const vides = [null, undefined, '', 'N/A', 'n/a', ' N/A ', '—', '_', 'Sans', 'sans', 'SANS'];
        vides.forEach((v) => {
            it(`${JSON.stringify(v) ?? 'undefined'} est vide`, () => {
                expect(isEmplacementVide(row(v), F)).toBe(true);
            });
        });
    });

    it('ne dépend PAS des composants de la ligne (le bug corrigé)', () => {
        // Avant, la couleur était pilotée par array_composants → un même emplacement
        // apparaissait tantôt vert tantôt rouge selon les composants chargés.
        const avecComposants = { [F]: 'A0', array_composants: [1, 2, 3] };
        const sansComposants = { [F]: 'A0', array_composants: [] };
        expect(isEmplacementVide(avecComposants, F)).toBe(isEmplacementVide(sansComposants, F));
        expect(isEmplacementVide(avecComposants, F)).toBe(false); // A0 = renseigné = rouge
    });

    it('résout un location_id peuplé via son location_name', () => {
        expect(isEmplacementVide({ location_id: { location_name: 'A13' } }, 'location_id')).toBe(false);
        expect(isEmplacementVide({ location_id: null }, 'location_id')).toBe(true);
    });
});

describe('formatTableValue', () => {
    it('rend le placeholder pour null / undefined / chaîne vide', () => {
        expect(formatTableValue({ x: null }, 'x')).toBe('—');
        expect(formatTableValue({}, 'x')).toBe('—');
        expect(formatTableValue({ x: '' }, 'x')).toBe('—');
    });

    it('rend les scalaires tels quels', () => {
        expect(formatTableValue({ x: 'A0' }, 'x')).toBe('A0');
        expect(formatTableValue({ x: 42 }, 'x')).toBe('42');
    });
});

describe('isLocationColumn', () => {
    it('reconnaît les colonnes emplacement', () => {
        ['location', 'location_id', 'location_name', 'emplacement'].forEach((f) =>
            expect(isLocationColumn(f)).toBe(true)
        );
    });

    it('ignore les autres colonnes', () => {
        expect(isLocationColumn('status')).toBe(false);
    });
});
