import { FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { TechDiListComponent } from './tech-di-list.component';

/**
 * Création d'une catégorie de diagnostic DEPUIS le dropdown de l'étape
 * « Panne ». Logique pure — pas de TestBed, pas d'Apollo monté (même idiome
 * que `composant-management.component.spec.ts`).
 *
 * Le test le plus important est celui du CACHE PAR RÉFÉRENCE : `diagCategoryOptions`
 * mémoïse sur l'identité du tableau source. Un `.push()` laisserait le cache
 * périmé et la catégorie tout juste créée n'apparaîtrait JAMAIS dans la liste —
 * une panne silencieuse, invisible à la relecture du diff.
 */

const notBlank: ValidatorFn = (c) =>
    String(c.value ?? '').trim() ? null : { required: true };

function makeComponent(categories: Array<{ category: string; value: string }>) {
    const c: any = Object.create(TechDiListComponent.prototype);

    c.diagFormTech = new FormGroup({
        remarqueTech: new FormControl('', [Validators.required, notBlank]),
        // `remarqueExtra` est OBLIGATOIRE et entre dans `diagFailureComplete` :
        // sans ce contrôle, `form.get('remarqueExtra')` vaut `null` et l'étape
        // « Panne » ne serait JAMAIS complète, quels que soient les autres
        // champs.
        remarqueExtra: new FormControl('', [Validators.required, notBlank]),
        di_category_id: new FormControl(null, Validators.required),
    });
    c.categorieDiListDropDown = categories;
    c.diagCategorySourceRef = null;
    c.diagCategoryOptionsCache = [];
    c.diagCategoryCreating = false;
    c.diagCategoryCreatedTick = 0;

    c.toasts = [] as any[];
    // Double de `NotifyService` : la sévérité n'est plus un argument d'appel,
    // c'est la MÉTHODE qui la porte. On la reconstitue pour garder les
    // assertions lisibles.
    const rec = (severity: string) => (detail: any, opts: any) =>
        c.toasts.push({ severity, detail, ...(opts ?? {}) });
    c.notify = {
        success: rec('success'),
        error: rec('error'),
        info: rec('info'),
        warn: rec('warn'),
    };
    // Le document GraphQL est CONSTRUIT avant l'appel à `run` : sans ce stub,
    // l'expression lève et tous les chemins retombent dans le `catch`.
    c.ticketSerice = { addCatgoryDi: (n: string) => ({ __gql: n }) };
    c.mutationRunner = { run: jasmine.createSpy('run') };
    c.allCategoryDi = jasmine.createSpy('allCategoryDi');
    // `refreshDiagnosticVm` touche `this.di`, le timer, la sidebar… : hors sujet
    // ici, on ne teste que la logique de création/sélection.
    c.refreshDiagnosticVm = () => {};

    return c;
}

const BASE = [
    { category: 'Carte mère', value: 'cat-1' },
    { category: 'Alimentation', value: 'cat-2' },
];

describe('tech-di-list — création de catégorie de diagnostic', () => {
    it('expose la catégorie créée dans les options (piège du cache par référence)', async () => {
        const c = makeComponent([...BASE]);
        c.mutationRunner.run.and.returnValue(
            Promise.resolve({
                createDiCategory: {
                    _id: 'cat-9',
                    category: 'Condensateur',
                    created: true,
                },
            }),
        );

        // Amorce le cache : `diagCategorySourceRef` retient CETTE référence.
        expect(c.diagCategoryOptions.length).toBe(2);

        await c.onDiagCreateCategory('Condensateur');

        const labels = c.diagCategoryOptions.map((o: any) => o.category);
        expect(labels).toContain('Condensateur');
        expect(c.diagCategoryOptions.length).toBe(3);
    });

    it('échouerait avec un push() — le remplacement de référence est obligatoire', () => {
        const c = makeComponent([...BASE]);
        expect(c.diagCategoryOptions.length).toBe(2); // amorce

        // Ce que l'on ne doit PAS faire : muter le tableau en place.
        c.categorieDiListDropDown.push({ category: 'Fusible', value: 'cat-8' });

        // Le cache est rendu tel quel : la mutation en place est invisible.
        expect(c.diagCategoryOptions.length).toBe(2);
    });

    it('sélectionne la catégorie créée', async () => {
        const c = makeComponent([...BASE]);
        c.mutationRunner.run.and.returnValue(
            Promise.resolve({
                createDiCategory: { _id: 'cat-9', category: 'Fusible', created: true },
            }),
        );

        await c.onDiagCreateCategory('Fusible');

        expect(c.diagFormTech.get('di_category_id')!.value).toBe('cat-9');
        expect(c.toasts[0].severity).toBe('success');
    });

    it('sur doublon LOCAL : sélectionne sans appeler la mutation', async () => {
        const c = makeComponent([...BASE]);

        await c.onDiagCreateCategory('  carte MÈRE  '); // trim + casse

        expect(c.mutationRunner.run).not.toHaveBeenCalled();
        expect(c.diagFormTech.get('di_category_id')!.value).toBe('cat-1');
        expect(c.toasts[0].severity).toBe('success');
        expect(c.toasts[0].summary).toBe('Catégorie déjà existante');
    });

    it('sur doublon détecté par le SERVEUR : toast succès, jamais « créée »', async () => {
        const c = makeComponent([...BASE]);
        c.mutationRunner.run.and.returnValue(
            Promise.resolve({
                createDiCategory: {
                    _id: 'cat-1',
                    category: 'Carte mère',
                    created: false,
                },
            }),
        );

        // Libellé différent localement (liste périmée) → la mutation part.
        await c.onDiagCreateCategory('Carte mere');

        expect(c.mutationRunner.run).toHaveBeenCalled();
        expect(c.toasts[0].severity).toBe('success');
        expect(c.toasts[0].summary).toBe('Catégorie déjà existante');
    });

    it('ignore un nom vide', async () => {
        const c = makeComponent([...BASE]);
        await c.onDiagCreateCategory('   ');
        expect(c.mutationRunner.run).not.toHaveBeenCalled();
        expect(c.toasts.length).toBe(0);
    });

    it('avale le double-clic sans toast d’erreur (mutation-in-flight)', async () => {
        const c = makeComponent([...BASE]);
        c.mutationRunner.run.and.returnValue(
            Promise.reject(new Error('mutation-in-flight')),
        );

        await c.onDiagCreateCategory('Fusible');

        expect(c.toasts.length).toBe(0);
        expect(c.allCategoryDi).not.toHaveBeenCalled();
    });

    it('toast d’erreur + relecture de la liste sur un vrai échec', async () => {
        const c = makeComponent([...BASE]);
        c.mutationRunner.run.and.returnValue(Promise.reject(new Error('boom')));

        await c.onDiagCreateCategory('Fusible');

        expect(c.toasts[0].severity).toBe('error');
        expect(c.allCategoryDi).toHaveBeenCalled();
    });

    it('ferme le panneau (tick) après création ET après doublon local', async () => {
        const c = makeComponent([...BASE]);
        c.mutationRunner.run.and.returnValue(
            Promise.resolve({
                createDiCategory: { _id: 'cat-9', category: 'Fusible', created: true },
            }),
        );

        await c.onDiagCreateCategory('Fusible');
        expect(c.diagCategoryCreatedTick).toBe(1);

        await c.onDiagCreateCategory('Carte mère'); // doublon local
        expect(c.diagCategoryCreatedTick).toBe(2);
    });
});

describe('tech-di-list — complétude de l’étape « Panne »', () => {
    /** `activeDiagStep` pilote le message ; on se place sur l'étape Panne. */
    function onFailureStep(c: any) {
        c.activeDiagStep = 'failure';
        return c;
    }

    it('bloque tant que la catégorie manque', () => {
        const c = onFailureStep(makeComponent([...BASE]));
        c.diagFormTech.patchValue({ remarqueTech: 'Écran cassé' });
        expect(c.diagNextBlockedReason).toContain('catégorie');
    });

    it('bloque sur une description faite d’ESPACES (Validators.required ne suffit pas)', () => {
        const c = onFailureStep(makeComponent([...BASE]));
        c.diagFormTech.patchValue({
            di_category_id: 'cat-1',
            remarqueTech: '     ',
        });

        expect(c.diagNextBlockedReason).not.toBeNull();
        // Le formulaire doit être D'ACCORD avec le gate : sans `notBlank`, il
        // dirait « valide » pendant que « Suivant » reste grisé.
        expect(c.diagFormTech.get('remarqueTech')!.invalid).toBe(true);
    });

    it('bloque tant que la remarque technicien manque', () => {
        // La remarque technicien est devenue OBLIGATOIRE : l'étape n'est pas
        // complète avec la seule description.
        const c = onFailureStep(makeComponent([...BASE]));
        c.diagFormTech.patchValue({
            di_category_id: 'cat-1',
            remarqueTech: 'Écran cassé',
        });

        expect(c.diagNextBlockedReason).not.toBeNull();
        expect(c.diagFormTech.get('remarqueExtra')!.invalid).toBe(true);
    });

    it('débloque quand les TROIS champs sont réellement renseignés', () => {
        const c = onFailureStep(makeComponent([...BASE]));
        c.diagFormTech.patchValue({
            di_category_id: 'cat-1',
            remarqueTech: 'Écran cassé',
            remarqueExtra: 'Nappe à recommander.',
        });

        expect(c.diagNextBlockedReason).toBeNull();
        expect(c.diagFormTech.get('remarqueTech')!.valid).toBe(true);
        expect(c.diagFormTech.get('remarqueExtra')!.valid).toBe(true);
        expect(c.diagFormTech.get('di_category_id')!.valid).toBe(true);
    });
});

/**
 * Quantité éditable dans « Composants sélectionnés » + clôture gatée par le
 * verdict écrit du technicien. Logique pure, même idiome que ci-dessus.
 */
function makeDiagComponent(
    combo: Array<{ nameComposant: string; quantity: number }> = [],
): any {
    const c: any = Object.create(TechDiListComponent.prototype);
    c.diagFormTech = new FormGroup({
        remarqueTech: new FormControl('', [Validators.required, notBlank]),
        remarqueExtra: new FormControl('', [Validators.required, notBlank]),
        isPdr: new FormControl(true),
        isReparable: new FormControl(true),
    });
    c.composantCombo = combo;
    // Effets de bord hors sujet : on ne teste que le calcul.
    c.persistActiveDialogState = () => {};
    c.refreshDiagnosticVm = () => {};
    c.cdr = { detectChanges: () => {} };
    return c;
}

describe('tech-di-list — quantité éditable des composants', () => {
    it('remplace la quantité de la BONNE ligne et laisse les autres intactes', () => {
        const c = makeDiagComponent([
            { nameComposant: '7805', quantity: 3 },
            { nameComposant: '1N5819WS', quantity: 2 },
        ]);
        c.updateDisableValues = () => {};

        c.onDiagComposantQuantityChange({
            nameComposant: '1N5819WS',
            quantity: 5,
        });

        expect(c.composantCombo).toEqual([
            { nameComposant: '7805', quantity: 3 },
            { nameComposant: '1N5819WS', quantity: 5 },
        ]);
    });

    it('REMPLACE le tableau au lieu de le muter (snapshot OnPush)', () => {
        // Tout l'aval s'appuie sur l'égalité de RÉFÉRENCE du contexte : une
        // mutation en place laisserait le total « N pièces » et le résumé sur
        // l'ancienne valeur.
        const before = [{ nameComposant: '7805', quantity: 3 }];
        const c = makeDiagComponent(before);
        c.updateDisableValues = () => {};

        c.onDiagComposantQuantityChange({ nameComposant: '7805', quantity: 4 });

        expect(c.composantCombo).not.toBe(before);
        expect(before[0].quantity).toBe(3);
    });

    it('normalise toute quantité non exploitable vers un entier >= 1', () => {
        // Le widget émet `null` dès que le champ est vidé, et la quantité part
        // BRUTE dans le document GraphQL : une valeur non finie y produirait
        // une erreur de PARSING, pas une erreur de validation.
        const cases: Array<[any, number]> = [
            [null, 1],
            [undefined, 1],
            [0, 1],
            [-3, 1],
            [NaN, 1],
            ['abc', 1],
            [2.7, 2],
            [12, 12],
        ];

        for (const [input, expected] of cases) {
            const c = makeDiagComponent([
                { nameComposant: '7805', quantity: 3 },
            ]);
            c.updateDisableValues = () => {};
            c.onDiagComposantQuantityChange({
                nameComposant: '7805',
                quantity: input,
            });
            expect(c.composantCombo[0].quantity)
                .withContext(`quantité ${String(input)}`)
                .toBe(expected);
        }
    });

    it('ignore un nom absent du tableau', () => {
        const c = makeDiagComponent([{ nameComposant: '7805', quantity: 3 }]);
        c.updateDisableValues = () => {};

        c.onDiagComposantQuantityChange({ nameComposant: 'azerty', quantity: 9 });

        expect(c.composantCombo).toEqual([
            { nameComposant: '7805', quantity: 3 },
        ]);
    });
});

describe('tech-di-list — clôture gatée par le verdict écrit', () => {
    it('exige la description de la panne', () => {
        const c = makeDiagComponent();
        c.diagFormTech.patchValue({ remarqueExtra: 'Nappe à recommander.' });
        expect(c.diagFinishBlockedReason).toContain('description');
    });

    it('exige la remarque technicien', () => {
        const c = makeDiagComponent();
        c.diagFormTech.patchValue({ remarqueTech: 'Écran cassé' });
        expect(c.diagFinishBlockedReason).toContain('remarque');
    });

    it('rejette une remarque faite uniquement d’ESPACES', () => {
        const c = makeDiagComponent();
        c.diagFormTech.patchValue({
            remarqueTech: 'Écran cassé',
            remarqueExtra: '    ',
        });
        expect(c.diagFinishBlockedReason).not.toBeNull();
    });

    it('ne bloque plus quand les deux remarques sont remplies', () => {
        const c = makeDiagComponent();
        c.diagFormTech.patchValue({
            remarqueTech: 'Écran cassé',
            remarqueExtra: 'Nappe à recommander.',
        });
        expect(c.diagFinishBlockedReason).toBeNull();
    });

    it('grise les TROIS drapeaux — donc les quatre boutons de clôture', () => {
        const c = makeDiagComponent();
        c.diagFormTech.patchValue({ remarqueTech: 'Écran cassé' });

        c.updateDisableValues();

        // Polarité : true = GRISÉ.
        expect(c.disabledDiagnostiqueValue).toBe(true);
        expect(c.disabledDiagnostiqueRetourValue).toBe(true);
        expect(c.techRetourSendFinished).toBe(true);
    });

    it('libère les TROIS drapeaux dès que la remarque est saisie', () => {
        const c = makeDiagComponent();
        c.diagFormTech.patchValue({
            remarqueTech: 'Écran cassé',
            remarqueExtra: 'Nappe à recommander.',
        });

        c.updateDisableValues();

        expect(c.disabledDiagnostiqueValue).toBe(false);
        expect(c.disabledDiagnostiqueRetourValue).toBe(false);
        expect(c.techRetourSendFinished).toBe(false);
    });

    it('reste libre même sans composant avec PDR activé (pas de régression)', () => {
        // Le routage PDR/réparable est serveur-autoritaire : il ne doit plus
        // griser quoi que ce soit. Seul le verdict écrit bloque.
        const c = makeDiagComponent([]);
        c.diagFormTech.patchValue({
            remarqueTech: 'Écran cassé',
            remarqueExtra: 'Aucune pièce nécessaire.',
            isPdr: true,
        });

        c.updateDisableValues();

        expect(c.disabledDiagnostiqueValue).toBe(false);
    });
});

describe('tech-di-list — composition de remarque_tech_diagnostic', () => {
    it('range la remarque technicien sous la description', () => {
        // `remarqueExtra` n'a pas de champ backend : sans cette composition, la
        // remarque — obligatoire — serait saisie puis JETÉE à l'envoi.
        const c = makeDiagComponent();
        c.diagFormTech.patchValue({
            remarqueTech: 'Écran cassé',
            remarqueExtra: 'Nappe à recommander.',
        });

        expect(c.composeRemarqueDiagnostic()).toBe(
            'Écran cassé\n\nRemarque technicien :\nNappe à recommander.',
        );
    });

    it('n’ajoute aucun en-tête quand la remarque est vide', () => {
        // Chemin pause : la clôture est gatée, mais une pause peut survenir
        // avant que la remarque soit saisie.
        const c = makeDiagComponent();
        c.diagFormTech.patchValue({ remarqueTech: 'Écran cassé' });

        expect(c.composeRemarqueDiagnostic()).toBe('Écran cassé');
    });

    it('ébarbe les deux champs', () => {
        const c = makeDiagComponent();
        c.diagFormTech.patchValue({
            remarqueTech: '  Écran cassé  ',
            remarqueExtra: '  Nappe  ',
        });

        expect(c.composeRemarqueDiagnostic()).toBe(
            'Écran cassé\n\nRemarque technicien :\nNappe',
        );
    });
});
