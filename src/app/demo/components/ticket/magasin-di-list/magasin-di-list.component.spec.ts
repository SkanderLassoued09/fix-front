import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MagasinDiListComponent } from './magasin-di-list.component';

describe('MagasinDiListComponent', () => {
  let component: MagasinDiListComponent;
  let fixture: ComponentFixture<MagasinDiListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MagasinDiListComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MagasinDiListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

/**
 * Rappel « pensez à Enregistrer » du modal « Affectation pour les composants ».
 *
 * Instanciation DIRECTE plutôt que TestBed : le constructeur ne fait que bâtir
 * `formUpdateComposant`, il ne touche à aucun service injecté — et le bloc
 * TestBed ci-dessus déclare le composant en `imports`, ce qui ne fonctionne pas
 * pour un composant non-standalone (échec PRÉEXISTANT, hors périmètre).
 */
describe('MagasinDiListComponent — rappel « Enregistrer »', () => {
    let component: MagasinDiListComponent;

    const fillValidForm = () =>
        component.formUpdateComposant.patchValue({
            name: 'CAP-100',
            package: 'SMD',
            category_composant_id: 'C_Composant1',
            prix_achat: 3,
            prix_vente: 5,
            coming_date: new Date(),
            quantity_stocked: 4,
            status: 'En stock',
        });

    beforeEach(() => {
        component = new MagasinDiListComponent(
            null as any,
            null as any,
            null as any,
            null as any,
            null as any,
            null as any,
            null as any,
            null as any,
            null as any,
        );
        component.activeLine = { nameComposant: 'CAP-100', quantity: 2 };
    });

    it('reste muet tant que le formulaire est pristine', () => {
        fillValidForm(); // `patchValue` = chargement, PAS une modification
        expect(component.hasUnsavedComposant).toBeFalse();
        expect(component.saveReminder).toBeNull();
        expect(component.saveNeedsAttention).toBeFalse();
    });

    it('reste muet quand aucune ligne n’est active (tout validé)', () => {
        fillValidForm();
        component.formUpdateComposant.markAsDirty();
        component.activeLine = null;
        expect(component.saveReminder).toBeNull();
        expect(component.saveNeedsAttention).toBeFalse();
    });

    it('modifié + valide → rappel ambre et reflet', () => {
        fillValidForm();
        component.formUpdateComposant.markAsDirty();
        expect(component.formUpdateComposant.valid).toBeTrue();
        expect(component.saveNeedsAttention).toBeTrue();
        expect(component.saveReminder).toContain('non enregistrées');
    });

    it('modifié + incomplet → rappel « complétez », sans halo', () => {
        fillValidForm();
        component.formUpdateComposant.patchValue({ package: null });
        component.formUpdateComposant.markAsDirty();
        expect(component.formUpdateComposant.valid).toBeFalse();
        expect(component.saveNeedsAttention).toBeFalse();
        expect(component.saveReminder).toContain(
            'Complétez les champs obligatoires',
        );
    });

    it('markAsPristine (chargement / sauvegarde) éteint le rappel', () => {
        fillValidForm();
        component.formUpdateComposant.markAsDirty();
        expect(component.saveNeedsAttention).toBeTrue();

        component.formUpdateComposant.markAsPristine();
        expect(component.saveReminder).toBeNull();
        expect(component.saveNeedsAttention).toBeFalse();
    });

    it('« Valider ce composant » grisé tant que « Enregistrer » brille', () => {
        fillValidForm();
        expect(component.canValidateActive).toBeTrue(); // pristine + valide

        component.formUpdateComposant.markAsDirty(); // saisie non enregistrée
        expect(component.saveNeedsAttention).toBeTrue();
        expect(component.canValidateActive).toBeFalse();

        component.formUpdateComposant.markAsPristine(); // sauvegarde réussie
        expect(component.saveNeedsAttention).toBeFalse();
        expect(component.canValidateActive).toBeTrue();
    });
});
