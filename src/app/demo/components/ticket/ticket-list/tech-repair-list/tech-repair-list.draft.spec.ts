import { EventEmitter } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { TechRepairListComponent } from './tech-repair-list.component';

/**
 * Brouillon du wizard de réparation — préremplissage et émission.
 *
 * Logique pure (`Object.create`, sans TestBed) comme `tech-repair-list.component.spec.ts`.
 *
 * Verrouille :
 *  - une nouvelle DI repart d'un formulaire VIERGE : le wizard reste monté entre
 *    deux ouvertures et gardait les Oui/Non de la DI précédente ;
 *  - un brouillon restauré rend saisie, bascules, pièces ET étape, et compte
 *    comme travail non enregistré ;
 *  - le préremplissage n'émet AUCUN brouillon, la saisie et la navigation oui.
 */
function makeWizard(): any {
    const c: any = Object.create(TechRepairListComponent.prototype);
    c.repairForm = new FormGroup({
        di_category_id: new FormControl(null),
        remarqueExtra: new FormControl(''),
        partSelected: new FormControl(null),
        quantity: new FormControl(1),
        worksDone: new FormControl('', Validators.required),
        testsDone: new FormControl('', Validators.required),
        repairSuccess: new FormControl(null),
        testsValidated: new FormControl(null),
        warranty: new FormControl(null),
    });
    c.parts = [];
    c.activeRepairStep = 'works';
    c.draftChange = new EventEmitter();
    return c;
}

function openWith(c: any, prefill: any): void {
    c.prefill = prefill;
    c.ngOnChanges({ prefill: { currentValue: prefill } as any });
}

describe('TechRepairListComponent — brouillon', () => {
    it('une nouvelle DI repart d’un formulaire vierge (plus de bascules héritées)', () => {
        const c = makeWizard();
        openWith(c, { di_category_id: 'cat-A', parts: [] });
        c.repairForm.patchValue({
            worksDone: 'Travaux DI A',
            repairSuccess: true,
            testsValidated: false,
        });
        c.repairForm.markAsDirty();

        openWith(c, { remarqueExtra: '', parts: [] });

        expect(c.repairForm.getRawValue()).toEqual(
            jasmine.objectContaining({
                di_category_id: null,
                worksDone: '',
                testsDone: '',
                repairSuccess: null,
                testsValidated: null,
                warranty: null,
            }),
        );
        expect(c.repairForm.dirty).toBeFalse();
        expect(c.activeRepairStep).toBe('works');
    });

    it('un brouillon restauré rend saisie, bascules, pièces et étape — et reste « non enregistré »', () => {
        const c = makeWizard();
        openWith(c, {
            di_category_id: 'cat-A',
            worksDone: 'Condensateur remplacé',
            testsDone: 'Essai 2 h',
            remarqueExtra: 'RAS',
            repairSuccess: false,
            testsValidated: true,
            warranty: null,
            parts: [{ nameComposant: '7805', reference: '', quantity: 2 }],
            step: 'summary',
            restoredDraft: true,
        });

        expect(c.repairForm.getRawValue()).toEqual(
            jasmine.objectContaining({
                worksDone: 'Condensateur remplacé',
                testsDone: 'Essai 2 h',
                remarqueExtra: 'RAS',
                repairSuccess: false,
                testsValidated: true,
            }),
        );
        expect(c.parts).toEqual([{ nameComposant: '7805', reference: '', quantity: 2 }]);
        expect(c.activeRepairStep).toBe('summary');
        expect(c.hasUnsavedWork).toBeTrue();
    });

    it('le préremplissage n’émet aucun brouillon ; la navigation et flushDraft oui', () => {
        const c = makeWizard();
        const emitted: any[] = [];
        c.draftChange.subscribe((d: any) => emitted.push(d));

        openWith(c, { worksDone: 'Préremplissage', parts: [] });
        expect(emitted.length).toBe(0);

        c.repairForm.patchValue({ testsDone: 'Essai OK' });
        c.onRepairStepChange('summary');
        expect(emitted.length).toBe(1);
        expect(emitted[0].step).toBe('summary');
        expect(emitted[0].value.testsDone).toBe('Essai OK');
        expect(emitted[0].value.worksDone).toBe('Préremplissage');

        c.flushDraft();
        expect(emitted.length).toBe(2);
    });
});
