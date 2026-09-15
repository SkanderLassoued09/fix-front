import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TicketListComponent } from './ticket-list.component';

describe('TicketListComponent', () => {
  let component: TicketListComponent;
  let fixture: ComponentFixture<TicketListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketListComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TicketListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

/**
 * Calcul du PRIX FINAL — « Affectation du prix final » (négociation 1 et 2).
 *
 * La base de la remise est la SOMME « prix du diagnostic facturé + estimation
 * de réparation » (les deux montants saisis à l'étape de tarification), et non
 * plus le seul prix du diagnostic. Cas particulier NON PAYANT : le back a déjà
 * calculé et persisté un total serveur-autoritaire (réparation + main-d'œuvre
 * diagnostic + pièces) — c'est lui la base.
 *
 * Ces méthodes sont de la logique pure : on les exerce sur le prototype, sans
 * TestBed, pour ne pas dépendre du graphe Apollo/PrimeNG du composant.
 */
describe('TicketListComponent — base du prix final', () => {
    /** Instance nue : aucun constructeur, aucune injection. */
    function makeComponent(state: Partial<TicketListComponent> = {}): any {
        const c: any = Object.create(TicketListComponent.prototype);
        c.price = null;
        c.negoRepairEstimate = null;
        c.negoServerFinalPrice = null;
        c.discountPercent = 0;
        c.finalPrice = null;
        c.discountedPriceNeg = 0;
        c.dataById = null;
        c.selectedRowInNegociate2 = null;
        Object.assign(c, state);
        return c;
    }

    /** Façonne la réponse `getDiById` telle que la lit `negoNonPayant`. */
    function withDiagnosticPayant(payant: boolean) {
        return { dataById: { getDiById: { di: { diagnosticPayant: payant } } } };
    }

    describe('toMoney', () => {
        it('distingue le montant ZÉRO (légitime) du champ ABSENT', () => {
            const c = makeComponent();
            // Piège : Number(null) === 0 — un test de finitude seul ferait
            // passer un champ absent pour un montant nul.
            expect(c.toMoney(0)).toBe(0);
            expect(c.toMoney(null)).toBeNull();
            expect(c.toMoney(undefined)).toBeNull();
            expect(c.toMoney('')).toBeNull();
            expect(c.toMoney('abc')).toBeNull();
            expect(c.toMoney('150.5')).toBe(150.5);
        });
    });

    describe('negoBaseAmount', () => {
        it('PAYANT : somme le diagnostic et l’estimation de réparation', () => {
            const c = makeComponent({
                price: 300,
                negoRepairEstimate: 150,
            } as any);
            expect(c.negoBaseAmount).toBe(450);
        });

        it('NON PAYANT : retient le total serveur, pas price + estimation', () => {
            const c = makeComponent({
                price: 0,
                negoRepairEstimate: 150,
                negoServerFinalPrice: 310, // 150 + main-d'œuvre 100 + pièces 60
                ...withDiagnosticPayant(false),
            } as any);
            expect(c.negoBaseAmount).toBe(310);
        });

        it('NON PAYANT sans total serveur : retombe sur la somme', () => {
            const c = makeComponent({
                price: 0,
                negoRepairEstimate: 150,
                negoServerFinalPrice: null,
                ...withDiagnosticPayant(false),
            } as any);
            expect(c.negoBaseAmount).toBe(150);
        });

        it('IRRÉPARABLE : sans estimation, la base est le diagnostic seul', () => {
            // L'étape 2 de la tarification est masquée quand la DI est
            // irréparable → aucune estimation n'a jamais été saisie.
            const c = makeComponent({
                price: 300,
                negoRepairEstimate: null,
            } as any);
            expect(c.negoBaseAmount).toBe(300);
        });

        it('rien de chargé : 0 (jamais NaN)', () => {
            expect(makeComponent().negoBaseAmount).toBe(0);
        });

        it('arrondit à 3 décimales', () => {
            const c = makeComponent({
                price: 0.0005,
                negoRepairEstimate: 0.0005,
            } as any);
            expect(c.negoBaseAmount).toBe(0.001);
        });
    });

    describe('montant persisté à la confirmation', () => {
        // Reproduit le calcul de `confirmerNegociation` : c'est cette valeur
        // qui part dans `managerAdminManager_InMagasin` comme `final_price`.
        const persisted = (c: any) =>
            c.toMoney(c.finalPrice) ?? c.negoBaseAmount;

        it('prix final non calculé : retombe sur la BASE, jamais sur 0', () => {
            // Piège : `Number(null) === 0` est fini — une coercition naïve
            // persisterait 0 et effacerait le montant à facturer.
            const c = makeComponent({
                price: 300,
                negoRepairEstimate: 150,
                finalPrice: null,
            } as any);
            expect(persisted(c)).toBe(450);
        });

        it('NON PAYANT : n’écrase plus le total serveur par 0', () => {
            // Bug corrigé : à remise 0 le front envoyait `final_price = price`,
            // or `price` vaut 0 en non payant → le total calculé par le
            // serveur était effacé.
            const c = makeComponent({
                price: 0,
                negoServerFinalPrice: 310,
                finalPrice: null,
                ...withDiagnosticPayant(false),
            } as any);
            expect(persisted(c)).toBe(310);
        });

        it('un prix final de 0 reste 0 (valeur légitime)', () => {
            const c = makeComponent({ price: 300, finalPrice: 0 } as any);
            expect(persisted(c)).toBe(0);
        });
    });

    describe('onDiscountChange', () => {
        it('applique la remise à la SOMME, pas au seul diagnostic', () => {
            const c = makeComponent({
                price: 300,
                negoRepairEstimate: 150,
                discountPercent: 10,
            } as any);
            c.onDiscountChange();
            // 10 % de 450 = 45 → 405 (et non 10 % de 300 = 30 → 270).
            expect(c.discountedPriceNeg).toBe(45);
            expect(c.finalPrice).toBe(405);
        });

        it('remise 0 % : le prix final vaut la base sommée', () => {
            const c = makeComponent({
                price: 300,
                negoRepairEstimate: 150,
                discountPercent: 0,
            } as any);
            c.onDiscountChange();
            expect(c.finalPrice).toBe(450);
        });

        it('NON PAYANT : remise appliquée au total serveur', () => {
            const c = makeComponent({
                price: 0,
                negoRepairEstimate: 150,
                negoServerFinalPrice: 310,
                discountPercent: 10,
                ...withDiagnosticPayant(false),
            } as any);
            c.onDiscountChange();
            expect(c.discountedPriceNeg).toBe(31);
            expect(c.finalPrice).toBe(279);
        });

        it('remise non numérique : neutralise le prix final', () => {
            const c = makeComponent({
                price: 300,
                negoRepairEstimate: 150,
                discountPercent: NaN,
            } as any);
            c.onDiscountChange();
            expect(c.finalPrice).toBeNull();
            expect(c.discountedPriceNeg).toBe(0);
        });

        it('arrondit le prix final à 3 décimales', () => {
            const c = makeComponent({
                price: 100.001,
                negoRepairEstimate: 0,
                discountPercent: 7.3,
            } as any);
            c.onDiscountChange();
            expect(c.finalPrice).toBe(
                Math.round(c.finalPrice * 1000) / 1000,
            );
            expect(String(c.finalPrice).split('.')[1]?.length ?? 0)
                .toBeLessThanOrEqual(3);
        });
    });
});

/**
 * Modal « Modifier la DI » : formulaire détaché de la ligne, préremplissage
 * complet et input envoyé à `updateDiInfo`. Instance RÉELLE (les initialiseurs
 * de champs créent `updateDiForm`) avec dépendances bouchonnées — ni TestBed,
 * ni Apollo.
 */
describe('TicketListComponent — modal « Modifier la DI »', () => {
    let runner: { run: jasmine.Spy };
    let accepted: Promise<void> | undefined;

    const COMPANY_ROW = {
        _id: 'DI_1',
        title: 'Ecran',
        description: 'Ne s allume plus',
        nSerie: 'SN1',
        client_id: 'null', // chaîne littérale écrite par createDi
        company_id: 'CO1',
        company_name: 'ACME',
        location_id: 'L1',
        remarque_manager: '',
        diagnosticPayant: true,
        diagnosticEstimate: 150,
        image: '',
    };

    function makeComponent(): any {
        runner = { run: jasmine.createSpy('run').and.resolveTo({}) };
        accepted = undefined;
        const c: any = new (TicketListComponent as any)(
            { configUpdate$: { subscribe: () => ({}) } }, // layoutService
            { updateDiInfo: () => 'UPDATE_DI_INFO' }, // ticketSerice
            {}, // apollo
            { markForCheck() {} }, // cdr
            { success() {}, error: jasmine.createSpy('error') }, // notify
            {}, // notificationService
            {}, // config
            { confirmSave: (o: any) => (accepted = o.accept()) }, // confirm
            {}, // ticketRefreshService
            runner, // mutationRunner
            {}, // route
            {}, // router
            {}, // diDetail
            {}, // diFiles
        );
        c.loadData = jasmine.createSpy('loadData');
        c.companiesListDropDown = [];
        return c;
    }

    const sentInput = () => runner.run.calls.mostRecent().args[0].variables.input;

    it('préremplit une DI société (référence « null » héritée ignorée)', () => {
        const c = makeComponent();
        c.updateDi({ ...COMPANY_ROW });
        const v = c.updateDiForm.getRawValue();
        expect(c.updateticketView).toBeTrue();
        expect(v.typeClient).toBe('COMPANY');
        expect(v.company_id).toBe('CO1');
        expect(v.client_id).toBeNull();
        expect(v.location).toBe('L1');
        expect(v.nSerie).toBe('SN1');
        expect(v.diagnosticEstimate).toBe(150);
        // Liste de sociétés sans l'option : injectée pour que la présélection s'affiche.
        expect(c.companiesListDropDown).toContain(
            jasmine.objectContaining({ value: 'CO1', company_name: 'ACME' }),
        );
    });

    it('Annuler ferme le modal sans toucher la ligne', () => {
        const c = makeComponent();
        const row = { ...COMPANY_ROW };
        c.updateDi(row);
        c.updateDiForm.patchValue({ title: 'Modifié' });
        c.cancelUpdateDi();
        expect(c.updateticketView).toBeFalse();
        expect(row.title).toBe('Ecran');
    });

    it('sans modification : aucune mutation, modal fermé', () => {
        const c = makeComponent();
        c.updateDi({ ...COMPANY_ROW });
        c.saveUpdateTicket();
        expect(accepted).toBeUndefined();
        expect(runner.run).not.toHaveBeenCalled();
        expect(c.updateticketView).toBeFalse();
    });

    it('société → client : les deux parties partent, la société à null', async () => {
        const c = makeComponent();
        c.updateDi({ ...COMPANY_ROW });
        c.updateDiForm.patchValue({ typeClient: 'CLIENT', client_id: 'CL9' });
        c.saveUpdateTicket();
        await accepted;
        expect(sentInput()).toEqual({
            _id: 'DI_1',
            client_id: 'CL9',
            company_id: null,
        });
        expect(c.loadData).toHaveBeenCalled();
        expect(c.updateticketView).toBeFalse();
    });

    it('non payant : estimation envoyée à null', async () => {
        const c = makeComponent();
        c.updateDi({ ...COMPANY_ROW });
        c.updateDiForm.patchValue({ diagnosticPayant: false });
        c.saveUpdateTicket();
        await accepted;
        expect(sentInput()).toEqual({
            _id: 'DI_1',
            diagnosticPayant: false,
            diagnosticEstimate: null,
        });
    });

    it('photo envoyée seulement si une nouvelle a été déposée', async () => {
        const c = makeComponent();
        c.updateDi({ ...COMPANY_ROW });
        c.updateDiForm.patchValue({ nSerie: 'SN2' });
        c.saveUpdateTicket();
        await accepted;
        expect(sentInput()).toEqual({ _id: 'DI_1', nSerie: 'SN2' });

        c.updateDi({ ...COMPANY_ROW });
        c.editImageDropFile = new File(['x'], 'p.png', { type: 'image/png' });
        c.editImagePayload = 'data:image/png;base64,eA==';
        c.saveUpdateTicket();
        await accepted;
        expect(sentInput()).toEqual({
            _id: 'DI_1',
            image: 'data:image/png;base64,eA==',
        });
    });

    it('photo déposée mais pas encore lue : enregistrement bloqué', () => {
        const c = makeComponent();
        c.updateDi({ ...COMPANY_ROW });
        c.editImageDropFile = new File(['x'], 'p.png', { type: 'image/png' });
        expect(c.canSaveEditDi).toBeFalse();
    });

    it('refus serveur : message affiché, modal laissé ouvert', async () => {
        const c = makeComponent();
        runner.run.and.rejectWith(new Error('DI non modifiable à ce stade'));
        c.updateDi({ ...COMPANY_ROW });
        c.updateDiForm.patchValue({ title: 'Autre' });
        c.saveUpdateTicket();
        await accepted;
        expect(c.notify.error).toHaveBeenCalledWith(
            'DI non modifiable à ce stade',
            jasmine.anything(),
        );
        expect(c.updateticketView).toBeTrue();
        expect(c.loadData).not.toHaveBeenCalled();
    });
});

/**
 * Tarification — « Prix du diagnostic à facturer ? » accepte 0 PARTOUT (flux
 * original, retour, irréparable) : « Valider le prix » s'active dès qu'un
 * montant positif OU NUL est saisi ; un champ VIDE reste bloquant.
 * Getters purs, exercés sur le prototype (même idiome que plus haut).
 */
describe('TicketListComponent — prix du diagnostic à 0', () => {
    function makePricing(state: Record<string, any> = {}): any {
        const c: any = Object.create(TicketListComponent.prototype);
        c.price = null;
        c.repairEstimate = null;
        c.pricingDiagnosticPayant = true;
        c.pricingDiagnosticEstimate = null;
        c.ignoreCountPricing = 0;
        c.seletedRow = { can_be_repaired: true };
        c.isLoading = false;
        c.dataById = null;
        c.selectedRowInNegociate2 = null;
        Object.assign(c, state);
        return c;
    }

    function withDocsReady(c: any): any {
        Object.defineProperty(c, 'bcReady', { value: true });
        Object.defineProperty(c, 'devisReady', { value: true });
        return c;
    }

    it('flux original, payant : 0 + estimation → « Valider le prix » actif', () => {
        const c = makePricing({ price: 0, repairEstimate: 300 });
        expect(c.reelValid).toBeTrue();
        expect(c.reelState).toBe('ok');
        expect(c.pricingStatus.text).toBe('Tout est prêt');
        expect(c.pricingSubmitDisabled).toBeFalse();
    });

    it('champ vide : toujours bloquant (il faut saisir une valeur, 0 compris)', () => {
        const c = makePricing({ price: null, repairEstimate: 300 });
        expect(c.reelValid).toBeFalse();
        expect(c.pricingSubmitDisabled).toBeTrue();
    });

    it('irréparable : 0 suffit (aucune estimation de réparation)', () => {
        const c = makePricing({
            price: 0,
            seletedRow: { can_be_repaired: false },
        });
        expect(c.pricingSubmitDisabled).toBeFalse();
    });

    it('retour payant : 0 reste accepté', () => {
        const c = makePricing({
            price: 0,
            repairEstimate: 300,
            ignoreCountPricing: 1,
        });
        expect(c.pricingSubmitDisabled).toBeFalse();
    });

    it('montant négatif : refusé', () => {
        const c = makePricing({ price: -1, repairEstimate: 300 });
        expect(c.pricingSubmitDisabled).toBeTrue();
    });

    it('« Confirmer le prix final » : une DI du flux original tarifée à 0 n’est pas bloquée', () => {
        expect(withDocsReady(makePricing({ price: 0 })).prixFinalCanConfirm).toBeTrue();
        expect(withDocsReady(makePricing({ price: null })).prixFinalCanConfirm).toBeFalse();
    });
});
