import { DiFilesModalComponent } from './di-files-modal.component';

/**
 * « Affectation des Fichiers » — emplacements de dépôt.
 *
 * Sur une DI IRRÉPARABLE, les 4 documents (Devis, BC, BL, Facture) se
 * téléversent et chaque emplacement se remplit UNE fois : une fois le document
 * présent, son dépôt est définitivement fermé, les autres restent ouverts.
 * Ailleurs, la modale garde ses deux emplacements de clôture (BL + Facture).
 *
 * Pas de TestBed : les getters sont purs, on les exerce sur le prototype (même
 * idiome que `di-files-modal.cycle-split.spec.ts`).
 */
function make(di: any, pending: Record<string, string> = {}): any {
    const c: any = Object.create(DiFilesModalComponent.prototype);
    c.di = di;
    c.affectationBase64 = { ...pending };
    c.afSelectedMeta = {};
    c.selected = { ...pending };
    c.slotLoading = {};
    return c;
}

const keysOf = (c: any) => c.uploadSlots.map((s: any) => s.key);
const slot = (c: any, key: string) =>
    c.uploadSlots.find((s: any) => s.key === key);

describe('DiFilesModal — emplacements de dépôt', () => {
    it('DI IRREPARABLE : les 4 documents, dans l\'ordre de la chaîne', () => {
        const c = make({ _id: 'X', status: 'IRREPARABLE' });
        expect(keysOf(c)).toEqual(['Devis', 'BC', 'BL', 'Facture']);
    });

    it('clôture documentaire / FINISHED : BL + Facture seulement', () => {
        for (const status of ['WAITING_BL', 'WAITING_FACTURE', 'FINISHED']) {
            expect(keysOf(make({ _id: 'X', status })))
                .withContext(status)
                .toEqual(['BL', 'Facture']);
        }
    });

    it('un document présent ferme SON emplacement, pas les autres', () => {
        const c = make({
            _id: 'X',
            status: 'IRREPARABLE',
            bon_de_livraison: 'https://drive/bl',
        });
        expect(slot(c, 'BL').filled).toBeTrue();
        expect(slot(c, 'Devis').filled).toBeFalse();
        expect(slot(c, 'Facture').filled).toBeFalse();
        expect(slot(c, 'Facture').locked).toBeFalse();
    });

    it('un fichier déposé sur un emplacement rempli est ignoré (drop compris)', () => {
        const c = make({
            _id: 'X',
            status: 'IRREPARABLE',
            facture: 'https://drive/fac',
        });
        c.takeFile(new File(['%PDF'], 'f.pdf', { type: 'application/pdf' }), 'Facture');
        expect(c.afSelectedMeta).toEqual({});
        expect(c.slotLoading).toEqual({});
    });

    it('IRREPARABLE : BC verrouillé sans devis, rouvert par un devis en attente ou présent', () => {
        expect(slot(make({ _id: 'X', status: 'IRREPARABLE' }), 'BC').locked).toBeTrue();
        expect(
            slot(make({ _id: 'X', status: 'IRREPARABLE' }, { Devis: 'd' }), 'BC').locked,
        ).toBeFalse();
        expect(
            slot(
                make({ _id: 'X', status: 'IRREPARABLE', devis: 'https://drive/devis' }),
                'BC',
            ).locked,
        ).toBeFalse();
    });

    it('WAITING_BL : Facture verrouillée tant que le BL manque (inchangé)', () => {
        expect(slot(make({ _id: 'X', status: 'WAITING_BL' }), 'Facture').locked).toBeTrue();
        expect(slot(make({ _id: 'X', status: 'WAITING_FACTURE' }), 'Facture').locked).toBeFalse();
    });

    it('retirer le devis en attente retire aussi le BC qui en dépendait', () => {
        const c = make({ _id: 'X', status: 'IRREPARABLE' }, { Devis: 'd', BC: 'c' });
        expect(c.affectationPendingCount).toBe(2);
        c.clearAffectationSlot('Devis');
        expect(c.affectationBase64).toEqual({});
        expect(c.affectationPendingCount).toBe(0);
    });

    it('« Enregistrer » dépose dans l\'ordre Devis → BC → BL → Facture', async () => {
        const c = make(
            { _id: 'X', status: 'IRREPARABLE' },
            { Facture: 'f', BL: 'b', BC: 'c', Devis: 'd' },
        );
        let accepted: Promise<void> | undefined;
        c.confirm = { confirmSave: (o: any) => (accepted = o.accept()) };
        c.ticketService = {
            addDevis: (_: string, p: string) => `Devis:${p}`,
            addBC: (_: string, p: string) => `BC:${p}`,
            addBL: (_: string, p: string) => `BL:${p}`,
            addFacture: (_: string, p: string) => `Facture:${p}`,
        };
        const runChain = jasmine.createSpy('runChain').and.resolveTo(undefined);
        c.mutationRunner = { runChain };
        c.close = () => {};
        c.saved = { emit: () => {} };

        c.saveAffectationFichiers();
        await accepted;

        const steps = runChain.calls.mostRecent().args[0].steps;
        expect(steps.map((s: any) => s.mutation)).toEqual([
            'Devis:d',
            'BC:c',
            'BL:b',
            'Facture:f',
        ]);
    });
});
