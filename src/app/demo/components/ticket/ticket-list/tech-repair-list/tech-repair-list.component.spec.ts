import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TechRepairListComponent } from './tech-repair-list.component';

/**
 * Garde de clôture du wizard de réparation + résolution de la catégorie.
 *
 * Logique pure — pas de TestBed, pas d'Apollo monté (même idiome que
 * `tech-di-list.diag-category.spec.ts`), donc insensible aux échecs
 * préexistants des specs `should create`.
 *
 * Ce qui est verrouillé ici :
 *  - « Tests effectués » est OBLIGATOIRE, et une chaîne d'espaces ne compte pas
 *    (`Validators.required` à lui seul l'accepterait) ;
 *  - le bouton désactivé DIT pourquoi — c'est toute la raison d'être de
 *    `finishBlockedReason`, et la garde en dérive (source unique) ;
 *  - la catégorie se résout par ID **ou** par LIBELLÉ : les projections
 *    divergent et les DI héritées stockent le libellé dans `di_category_id`.
 */

function makeComponent(
    categories: Array<{ _id: string; category: string }> = [],
): any {
    const c: any = Object.create(TechRepairListComponent.prototype);
    c.repairForm = new FormGroup({
        di_category_id: new FormControl(null),
        remarqueExtra: new FormControl(''),
        worksDone: new FormControl('', Validators.required),
        testsDone: new FormControl('', Validators.required),
        repairSuccess: new FormControl(null),
        testsValidated: new FormControl(null),
    });
    c.categories = categories;
    c.finishing = false;
    return c;
}

/** Toutes les conditions de clôture réunies. */
function fillAll(c: any): any {
    c.repairForm.patchValue({
        worksDone: 'Remplacement du condensateur C12',
        testsDone: 'Test de charge 2 h — OK',
        repairSuccess: true,
        testsValidated: true,
    });
    return c;
}

describe('TechRepairListComponent — garde de clôture', () => {
    it('autorise la clôture quand tout est renseigné', () => {
        const c = fillAll(makeComponent());
        expect(c.finishBlockedReason).toBeNull();
        expect(c.computeFinishDisabled()).toBe(false);
    });

    it('bloque tant que « Tests effectués » est vide', () => {
        const c = fillAll(makeComponent());
        c.repairForm.patchValue({ testsDone: '' });
        expect(c.computeFinishDisabled()).toBe(true);
        expect(c.finishBlockedReason).toBe('Renseignez les tests effectués.');
    });

    it('bloque sur des tests faits d’ESPACES (required ne suffit pas)', () => {
        const c = fillAll(makeComponent());
        c.repairForm.patchValue({ testsDone: '     ' });
        // Le contrôle est « valide » pour Angular…
        expect(c.repairForm.get('testsDone')!.valid).toBe(true);
        // …mais la garde, elle, trime.
        expect(c.computeFinishDisabled()).toBe(true);
        expect(c.finishBlockedReason).toBe('Renseignez les tests effectués.');
    });

    it('bloque tant que « Travaux effectués » est vide, en priorité', () => {
        const c = fillAll(makeComponent());
        c.repairForm.patchValue({ worksDone: '  ', testsDone: '' });
        expect(c.finishBlockedReason).toBe('Renseignez les travaux effectués.');
    });

    it('bloque tant que les deux validations Oui/Non manquent', () => {
        const c = fillAll(makeComponent());
        c.repairForm.patchValue({ repairSuccess: null });
        expect(c.finishBlockedReason).toBe(
            'Indiquez si la réparation est réussie.',
        );
        c.repairForm.patchValue({ repairSuccess: false, testsValidated: null });
        expect(c.finishBlockedReason).toBe(
            'Indiquez si les tests sont validés.',
        );
    });

    it('accepte « Non » comme réponse — seul `null` bloque', () => {
        const c = fillAll(makeComponent());
        c.repairForm.patchValue({ repairSuccess: false, testsValidated: false });
        expect(c.finishBlockedReason).toBeNull();
        expect(c.computeFinishDisabled()).toBe(false);
    });

    it('reste bloqué pendant une clôture en vol (anti double-soumission)', () => {
        const c = fillAll(makeComponent());
        c.finishing = true;
        expect(c.computeFinishDisabled()).toBe(true);
        // …sans pour autant inventer un champ manquant.
        expect(c.finishBlockedReason).toBeNull();
    });
});

describe('TechRepairListComponent — libellé de catégorie', () => {
    const CATEGORIES = [
        { _id: 'c7f1e2a0-uuid', category: 'Carte électronique' },
        { _id: 'b2d9c4f1-uuid', category: 'Moteur' },
    ];

    it('résout un _id de DiCategory', () => {
        const c = makeComponent(CATEGORIES);
        c.repairForm.patchValue({ di_category_id: 'b2d9c4f1-uuid' });
        expect(c.categoryLabel).toBe('Moteur');
    });

    it('résout un LIBELLÉ hérité stocké dans di_category_id', () => {
        const c = makeComponent(CATEGORIES);
        c.repairForm.patchValue({ di_category_id: 'Carte électronique' });
        expect(c.categoryLabel).toBe('Carte électronique');
    });

    it('affiche la valeur brute plutôt que « Non définie » si hors référentiel', () => {
        const c = makeComponent(CATEGORIES);
        c.repairForm.patchValue({ di_category_id: 'Catégorie supprimée' });
        expect(c.categoryLabel).toBe('Catégorie supprimée');
    });

    it('rend une chaîne vide quand la DI n’a pas de catégorie', () => {
        const c = makeComponent(CATEGORIES);
        c.repairForm.patchValue({ di_category_id: null });
        expect(c.categoryLabel).toBe('');
        c.repairForm.patchValue({ di_category_id: '   ' });
        expect(c.categoryLabel).toBe('');
    });

    it('ne prétend pas résoudre quand le référentiel n’est pas chargé', () => {
        // Régression : `repairCategories` était alimenté depuis le mauvais
        // catalogue et restait vide — la catégorie était alors toujours
        // « Non définie ». On affiche au moins la valeur brute.
        const c = makeComponent([]);
        c.repairForm.patchValue({ di_category_id: 'c7f1e2a0-uuid' });
        expect(c.categoryLabel).toBe('c7f1e2a0-uuid');
    });
});
