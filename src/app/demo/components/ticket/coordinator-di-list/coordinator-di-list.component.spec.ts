import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoordinatorDiListComponent } from './coordinator-di-list.component';

describe('CoordinatorDiListComponent', () => {
  let component: CoordinatorDiListComponent;
  let fixture: ComponentFixture<CoordinatorDiListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoordinatorDiListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CoordinatorDiListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Timeline « Contrôles par étape » — état des 5 étapes.
//
// Tests UNITAIRES PURS : le composant est instancié via `Object.create` pour
// sauter son constructeur (11 dépendances Apollo/PrimeNG/Router). On ne teste
// ici que de la dérivation d'état à partir du document DI — aucun DOM, donc
// rien qui dépende du TestBed ci-dessus.
// ─────────────────────────────────────────────────────────────────────────────
describe('CoordinatorDiListComponent — état des étapes du flow', () => {
    /** Composant nu, avec le seul état que lisent les helpers d'étape. */
    function makeComponent(di: any): CoordinatorDiListComponent {
        const c: any = Object.create(CoordinatorDiListComponent.prototype);
        c.di = di;
        c.adminSentAt = di?.pricingRequestSentAt ?? null;
        c.magasinConfirmedAt = di?.componentsConfirmedAt ?? null;
        c.componentConfirmedFromCoordinator = null;
        return c as CoordinatorDiListComponent;
    }

    /** DI avec composants — sans quoi l'étape Magasin est toujours « sautée ». */
    function withComponents(status: string, extra: any = {}) {
        return {
            status,
            contain_pdr: true,
            array_composants: [{ nameComposant: 'C1', quantity: 1 }],
            ...extra,
        };
    }

    it('INDIAGNOSTIC : le diagnostic est en cours, la suite non démarrée', () => {
        const c = makeComponent(withComponents('INDIAGNOSTIC'));
        expect(c.getFlowStepState('diagnostic')).toBe('current');
        expect(c.getFlowStepState('magasin')).toBe('pending');
        expect(c.getFlowStepState('admin')).toBe('pending');
        expect(c.getFlowStepState('repair')).toBe('pending');
        expect(c.getFlowStepState('closure')).toBe('pending');
    });

    it('DI sans composant : l\'étape Magasin est SAUTÉE, pas « en attente »', () => {
        const c = makeComponent({
            status: 'INDIAGNOSTIC',
            contain_pdr: false,
            array_composants: [],
        });
        expect(c.getFlowStepState('magasin')).toBe('skipped');
        expect(c.getFlowStepLabel('magasin')).toBe('Sauté');
    });

    it('contain_pdr sans liste de composants : Magasin sautée aussi', () => {
        const c = makeComponent({
            status: 'INDIAGNOSTIC',
            contain_pdr: true,
            array_composants: [],
        });
        expect(c.getFlowStepState('magasin')).toBe('skipped');
    });

    it('Retour sans pièces : Magasin ET Administration sont sautées', () => {
        const c = makeComponent(
            withComponents('PENDING3', { needsDevisBeforeRepair: true }),
        );
        expect(c.getFlowStepState('magasin')).toBe('skipped');
        expect(c.getFlowStepState('admin')).toBe('skipped');
        expect(c.getFlowStepState('repair')).toBe('current');
    });

    it('PENDING2 : diagnostic terminé, administration en cours', () => {
        const c = makeComponent(withComponents('PENDING2'));
        expect(c.getFlowStepState('diagnostic')).toBe('done');
        expect(c.getFlowStepState('admin')).toBe('current');
        expect(c.getFlowStepState('repair')).toBe('pending');
    });

    it('ATTENTE_CONFIRMATION_COORDINATION : Magasin est l\'étape en cours', () => {
        const c = makeComponent(
            withComponents('ATTENTE_CONFIRMATION_COORDINATION'),
        );
        expect(c.getFlowStepState('magasin')).toBe('current');
    });

    it('CONFIRMATION_COMPOSANTS (valeur legacy) est traitée comme Magasin', () => {
        const c = makeComponent(withComponents('CONFIRMATION_COMPOSANTS'));
        expect(c.getFlowStepState('magasin')).toBe('current');
    });

    it('componentsConfirmedAt marque Magasin terminée même après la phase', () => {
        const c = makeComponent(
            withComponents('PENDING3', {
                componentsConfirmedAt: '2026-09-01T10:00:00.000Z',
            }),
        );
        expect(c.getFlowStepState('magasin')).toBe('done');
    });

    it('IRREPARABLE : le diagnostic est fait, la réparation ne l\'est PAS', () => {
        const c = makeComponent(withComponents('IRREPARABLE'));
        expect(c.getFlowStepState('diagnostic')).toBe('done');
        expect(c.getFlowStepState('repair')).not.toBe('done');
    });

    it('FINISHED : toutes les étapes du flux sont terminées', () => {
        const c = makeComponent(withComponents('FINISHED'));
        expect(c.getFlowStepState('diagnostic')).toBe('done');
        expect(c.getFlowStepState('repair')).toBe('done');
        expect(c.getFlowStepState('closure')).toBe('done');
        expect(c.getFlowStepLabel('closure')).toBe('Terminé');
    });

    it('INREPARATION : la clôture est en cours, pas terminée', () => {
        const c = makeComponent(withComponents('INREPARATION'));
        expect(c.getFlowStepState('repair')).toBe('current');
        expect(c.getFlowStepState('closure')).toBe('pending');
        expect(c.getFlowStepLabel('closure')).toBe('Non démarrée');
    });

    it('WAITING_BL : la clôture documentaire est l\'étape en cours', () => {
        const c = makeComponent(withComponents('WAITING_BL'));
        expect(c.getFlowStepState('closure')).toBe('current');
    });

    it('ANNULER / RETOUR : aucune étape n\'est marquée « en cours »', () => {
        for (const status of ['ANNULER', 'RETOUR1', 'RETOUR2', 'RETOUR3']) {
            const c = makeComponent(withComponents(status));
            const states = (
                ['diagnostic', 'magasin', 'admin', 'repair', 'closure'] as const
            ).map((s) => c.getFlowStepState(s));
            expect(states).not.toContain('current');
        }
    });

    it('chaque état a un libellé et une icône', () => {
        const c = makeComponent(withComponents('PENDING2'));
        expect(c.getFlowStepLabel('diagnostic')).toBe('Terminé');
        expect(c.getFlowStepLabel('admin')).toBe('En attente');
        expect(c.getFlowStepLabel('repair')).toBe('Non démarrée');
        expect(c.getFlowStepIcon('diagnostic')).toBe('pi pi-check-circle');
        expect(c.getFlowStepClass('admin')).toBe('cf-step--current');
    });

    it('DI absente : tout est « non démarrée », sans planter', () => {
        const c = makeComponent(null);
        expect(c.getFlowStepState('diagnostic')).toBe('pending');
        expect(c.getFlowStepState('closure')).toBe('pending');
    });
});

describe('CoordinatorDiListComponent — libellé de statut', () => {
    function labelFor(status: any): string {
        const c: any = Object.create(CoordinatorDiListComponent.prototype);
        return c.getStatusLabel(status);
    }

    // La tarification était le SEUL statut affiché en casse mixte (« Pricing »),
    // au milieu de PENDING2 / INDIAGNOSTIC / WAITING_BL. Exception supprimée.
    it('affiche PRICING en majuscules, pour les deux valeurs de base', () => {
        expect(labelFor('PRICING_DIAG')).toBe('PRICING');
        expect(labelFor('PRICING')).toBe('PRICING');
    });

    it('laisse les autres statuts en majuscules brutes', () => {
        expect(labelFor('INDIAGNOSTIC')).toBe('INDIAGNOSTIC');
        expect(labelFor('PENDING2')).toBe('PENDING2');
    });

    it('rend « — » quand le statut est absent', () => {
        expect(labelFor(null)).toBe('—');
        expect(labelFor('')).toBe('—');
    });
});

describe('CoordinatorDiListComponent — pastille de statut', () => {
    function toneFor(status: string | null): string {
        const c: any = Object.create(CoordinatorDiListComponent.prototype);
        c.di = status === null ? null : { status };
        return c.diCurrentStatusTone;
    }

    it('suit la famille du statut', () => {
        expect(toneFor('INDIAGNOSTIC')).toBe('cf-pill--green');
        expect(toneFor('PENDING2')).toBe('cf-pill--amber');
        expect(toneFor('ATTENTE_CONFIRMATION_COORDINATION')).toBe(
            'cf-pill--amber',
        );
        expect(toneFor('FINISHED')).toBe('cf-pill--green');
    });

    it('signale en rouge les états qui demandent une reprise', () => {
        expect(toneFor('RETOUR1')).toBe('cf-pill--red');
        expect(toneFor('IRREPARABLE')).toBe('cf-pill--red');
    });

    it('neutralise une DI annulée ou absente', () => {
        expect(toneFor('ANNULER')).toBe('cf-pill--slate');
        expect(toneFor(null)).toBe('cf-pill--slate');
    });
});
