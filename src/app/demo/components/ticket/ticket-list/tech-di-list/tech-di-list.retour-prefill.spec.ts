import { FormControl, FormGroup } from '@angular/forms';
import { TechDiListComponent } from './tech-di-list.component';

/**
 * Ouverture du modal de diagnostic sur un RETOUR : formulaire vierge, jamais
 * les données d'un autre cycle ; les cycles antérieurs en lecture seule.
 *
 * Logique pure — pas de TestBed ni d'Apollo (même idiome que
 * `tech-di-list.diag-category.spec.ts`). `diagModal()` lui-même est trop couplé
 * aux requêtes pour être monté ici ; ses morceaux le sont, et le parcours
 * complet est couvert en UI par `fix-back/qa/e2e/di-retour-diag-blank-ui.spec.ts`.
 */

function makeComponent() {
    const c: any = Object.create(TechDiListComponent.prototype);
    // Même structure que le vrai `diagFormTech` (validateurs hors sujet ici).
    c.diagFormTech = new FormGroup({
        _idDi: new FormControl(),
        diag_time: new FormControl(),
        remarqueTech: new FormControl(''),
        symptomes: new FormControl(''),
        remarqueExtra: new FormControl(''),
        isPdr: new FormControl(true),
        isReparable: new FormControl(true),
        isErrorFromFixtronix: new FormControl(false),
        quantity: new FormControl(1),
        composantSelectedDropdown: new FormControl(),
        di_category_id: new FormControl(null),
        composantSelected: new FormControl(),
    });
    c.composantCombo = [];
    c.allComposantLogsAndOriginal = [];
    c.diagPreviousCyclesVm = [];
    c.ignoreCount = 0;
    c.selectedDi = null;
    return c;
}

/** Ligne du flux original, diagnostic COMPLET. */
const CYCLE0 = {
    idIgnore: 0,
    can_be_repaired: true,
    contain_pdr: true,
    isErrorFromFixtronix: null,
    di_category_id: 'cat-0',
    array_composants: [
        { nameComposant: 'Condensateur', quantity: 2 },
        { nameComposant: 'Transistor', quantity: 1 },
    ],
    remarque_tech_diagnostic:
        'Panne origine\n\nRemarque technicien :\nRemarque origine',
    remarque_tech_repair: 'Réparation origine',
};

/** Ce que pose `openRetourCycle`, tel que relu en base : aucune donnée de
 *  diagnostic, mais les défauts du schéma `logsdis` (`contain_pdr: false`…) —
 *  les mêmes qu'une ligne de flux original neuve. */
const CYCLE1_BLANK = {
    idIgnore: 1,
    retourReason: 'panne revenue',
    contain_pdr: false,
    isErrorFromFixtronix: false,
    array_composants: [],
};

describe('tech-di-list — préremplissage du diagnostic sur un retour', () => {
    it('nouveau retour : rien du flux original, même si this.ignoreCount est périmé', () => {
        const c = makeComponent();
        // Le bug : `ignoreCount` valait encore 0 au moment du préremplissage.
        c.ignoreCount = 0;

        c.processDiagnosticWithLogs(
            { _id: 'stat-1', ignoreCount: 1 },
            [CYCLE0, CYCLE1_BLANK],
            1,
        );

        const v = c.diagFormTech.getRawValue();
        expect(c.composantCombo).toEqual([]);
        expect(v.remarqueTech).toBe('');
        expect(v.remarqueExtra).toBe('');
        expect(v.di_category_id).toBeNull();
        // Bascules d'un diagnostic NEUF (ligne vierge), pas le verdict du cycle 0
        // (PDR oui / réparable oui).
        expect(v.isPdr).toBeFalse();
        expect(v.isReparable).toBeTrue();
        expect(v.isErrorFromFixtronix).toBeFalse();
    });

    it('retour en pause : reprend la saisie de SON cycle, remarque redécoupée', () => {
        const c = makeComponent();
        const cycle1 = {
            idIgnore: 1,
            can_be_repaired: true,
            contain_pdr: false,
            di_category_id: 'cat-1',
            array_composants: [{ nameComposant: 'Relais', quantity: 3 }],
            remarque_tech_diagnostic:
                'Panne retour\n\nRemarque technicien :\nRemarque retour',
        };

        c.processDiagnosticWithLogs({ _id: 'stat-1' }, [CYCLE0, cycle1], 1);

        const v = c.diagFormTech.getRawValue();
        expect(c.composantCombo).toEqual([
            { nameComposant: 'Relais', quantity: 3 },
        ]);
        expect(v.remarqueTech).toBe('Panne retour');
        expect(v.remarqueExtra).toBe('Remarque retour');
        expect(v.di_category_id).toBe('cat-1');
        expect(v.isPdr).toBeFalse();
    });

    it("ignore les catégories 'true'/'false' écrites par l'ancien repli", () => {
        const c = makeComponent();
        c.processDiagnosticWithLogs(
            { _id: 'stat-1' },
            [{ idIgnore: 0, di_category_id: 'true' }],
            0,
        );
        expect(c.diagFormTech.getRawValue().di_category_id).toBeNull();
    });
});

describe('tech-di-list — resetDiagnosticDraft', () => {
    it("efface la saisie laissée par la DI ouverte précédemment", () => {
        const c = makeComponent();
        c.selectedDi = 'stat-A';
        c.diagFormTech.patchValue({
            remarqueTech: 'ancienne',
            remarqueExtra: 'ancienne',
            symptomes: 'ancien',
            di_category_id: 'cat-A',
            isPdr: false,
        });
        c.diagFormTech.markAsDirty();
        c.composantCombo = [{ nameComposant: 'X', quantity: 1 }];
        c.diagPreviousCyclesVm = [{ cycle: 0 }];

        c.resetDiagnosticDraft('stat-B');

        const v = c.diagFormTech.getRawValue();
        expect(v.remarqueTech).toBe('');
        expect(v.remarqueExtra).toBe('');
        expect(v.symptomes).toBe('');
        expect(v.di_category_id).toBeNull();
        expect(v.isPdr).toBeTrue();
        expect(v.quantity).toBe(1);
        expect(c.composantCombo).toEqual([]);
        expect(c.diagPreviousCyclesVm).toEqual([]);
        // `diagnosticHasUnsavedWork` repose sur `dirty`.
        expect(c.diagFormTech.dirty).toBeFalse();
    });

    it('garde les symptômes (sans champ serveur) quand on rouvre la MÊME ligne', () => {
        const c = makeComponent();
        c.selectedDi = 'stat-A';
        c.diagFormTech.patchValue({ symptomes: 'bruit au démarrage' });

        c.resetDiagnosticDraft('stat-A');

        expect(c.diagFormTech.getRawValue().symptomes).toBe(
            'bruit au démarrage',
        );
    });
});

describe('tech-di-list — remarque composée / redécoupée', () => {
    it('split est l’inverse exact de compose', () => {
        const c = makeComponent();
        c.diagFormTech.patchValue({
            remarqueTech: 'Description',
            remarqueExtra: 'Remarque',
        });
        const stored = c.composeRemarqueDiagnostic();

        expect(c.splitRemarqueDiagnostic(stored)).toEqual({
            remarqueTech: 'Description',
            remarqueExtra: 'Remarque',
        });
    });

    it('texte sans séparateur → description seule', () => {
        const c = makeComponent();
        expect(c.splitRemarqueDiagnostic('  ancienne remarque ')).toEqual({
            remarqueTech: 'ancienne remarque',
            remarqueExtra: '',
        });
    });

    it('description vide (pause avant saisie) → remarque seule', () => {
        const c = makeComponent();
        c.diagFormTech.patchValue({ remarqueTech: '', remarqueExtra: 'Seule' });

        expect(
            c.splitRemarqueDiagnostic(c.composeRemarqueDiagnostic()),
        ).toEqual({ remarqueTech: '', remarqueExtra: 'Seule' });
    });

    it("valeurs absentes ou littérales 'null' → vide", () => {
        const c = makeComponent();
        for (const v of [null, undefined, 'null', 'undefined', '']) {
            expect(c.splitRemarqueDiagnostic(v)).toEqual({
                remarqueTech: '',
                remarqueExtra: '',
            });
        }
    });
});

describe('tech-di-list — buildPreviousCycles', () => {
    it('retour 2 : cycles antérieurs seulement, du plus récent au plus ancien', () => {
        const c = makeComponent();
        const cycle1 = {
            idIgnore: 1,
            can_be_repaired: false,
            contain_pdr: false,
            isErrorFromFixtronix: true,
            array_composants: [],
        };
        const cycle2 = { idIgnore: 2, array_composants: [] };

        const result = c.buildPreviousCycles([CYCLE0, cycle2, cycle1], 2);

        expect(result.map((p: any) => p.label)).toEqual([
            'Retour 1',
            'Flux original',
        ]);
        expect(result[0]).toEqual(
            jasmine.objectContaining({
                cycle: 1,
                reparable: false,
                pdr: false,
                errorFromFixtronix: true,
                composants: [],
                categoryId: null,
            }),
        );
        expect(result[1]).toEqual(
            jasmine.objectContaining({
                cycle: 0,
                categoryId: 'cat-0',
                reparable: true,
                pdr: true,
                // Question posée aux seuls retours.
                errorFromFixtronix: null,
                remarqueReparation: 'Réparation origine',
            }),
        );
        expect(result[1].composants.map((x: any) => x.nameComposant)).toEqual(
            ['Condensateur', 'Transistor'],
        );
    });

    it('champs absents → null, sans repli sur la DI', () => {
        const c = makeComponent();
        const [p] = c.buildPreviousCycles([{ idIgnore: 0 }, CYCLE1_BLANK], 1);

        expect(p.reparable).toBeNull();
        expect(p.pdr).toBeNull();
        expect(p.categoryId).toBeNull();
        expect(p.composants).toEqual([]);
        expect(p.remarqueDiagnostic).toBe('');
    });

    it('flux original : aucun cycle antérieur', () => {
        const c = makeComponent();
        expect(c.buildPreviousCycles([CYCLE0], 0)).toEqual([]);
    });
});
