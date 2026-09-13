import { TestBed } from '@angular/core/testing';
import { DiagnosticInfoStepComponent } from './diagnostic-info-step.component';
import {
  DiagnosticDiSummary,
  DiagnosticPreviousCycle,
} from '../diagnostic-modal.types';

/** Étape 1 : les diagnostics antérieurs d'un retour, en lecture seule. */

const DI: DiagnosticDiSummary = {
  _id: 'DI1',
  _idnum: 'DI-1',
  title: 'Titre',
  description: 'Description',
  status: 'INDIAGNOSTIC',
  statusLabel: 'En diagnostic',
  clientName: '',
  clientPhone: '',
  companyName: 'Société',
  locationName: '',
  technicianName: '',
  remarqueManager: '',
  ignoreCount: 1,
  entityType: 'company',
} as DiagnosticDiSummary;

const ORIGINAL: DiagnosticPreviousCycle = {
  cycle: 0,
  label: 'Flux original',
  categoryId: 'cat-1',
  reparable: true,
  pdr: true,
  errorFromFixtronix: null,
  composants: [{ nameComposant: 'Condensateur', quantity: 2 }],
  remarqueDiagnostic: 'Panne origine',
  remarqueReparation: '',
};

function render(previousCycles: readonly DiagnosticPreviousCycle[]) {
  const fixture = TestBed.createComponent(DiagnosticInfoStepComponent);
  fixture.componentRef.setInput('di', DI);
  fixture.componentRef.setInput('previousCycles', previousCycles);
  fixture.componentRef.setInput('categories', [
    { _id: 'cat-1', category: 'Afficheur' },
  ]);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('DiagnosticInfoStepComponent — diagnostics précédents', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DiagnosticInfoStepComponent],
    });
  });

  it('flux original : aucune section', () => {
    expect(render([]).querySelector('.prev-cycles')).toBeNull();
  });

  it('retour : une carte par cycle, libellés résolus, aucun champ de saisie', () => {
    const el = render([
      {
        ...ORIGINAL,
        cycle: 1,
        label: 'Retour 1',
        categoryId: 'true',
        pdr: false,
        errorFromFixtronix: true,
        composants: [],
      },
      ORIGINAL,
    ]);

    const cards = el.querySelectorAll('.prev-cycle');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Retour 1');
    // Id sans correspondance → pas affiché brut.
    expect(cards[0].textContent).toContain('Non renseigné');
    expect(cards[0].textContent).not.toContain('true');
    expect(cards[0].textContent).toContain('Erreur Fixtronix');
    expect(cards[0].textContent).toContain('Aucun composant');

    expect(cards[1].textContent).toContain('Flux original');
    expect(cards[1].textContent).toContain('Afficheur');
    expect(cards[1].textContent).toContain('Condensateur');
    expect(cards[1].textContent).not.toContain('Erreur Fixtronix');

    expect(el.querySelectorAll('.prev-cycles input, .prev-cycles textarea').length).toBe(0);
  });
});
