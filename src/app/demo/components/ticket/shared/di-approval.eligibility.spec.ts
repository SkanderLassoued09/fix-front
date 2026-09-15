import { canOpenApproval } from './di-approval.eligibility';

describe('canOpenApproval — modale « Approval (devis/BC) »', () => {
    it('s’ouvre quand un devis ou un bon de commande est attendu', () => {
        for (const status of [
            'WAITING_DEVIS',
            'WAITING_BC',
            'NEGOTIATION1',
            'ATTENTE_BC_DEVIS',
        ]) {
            expect(canOpenApproval({ status }))
                .withContext(status)
                .toBeTrue();
        }
    });

    it('reste fermée quand la DI a quitté l’attente documentaire', () => {
        // Cas typique d'une notification périmée : le BC est arrivé, la DI est
        // partie en confirmation composants ou en réparation.
        for (const status of [
            'PENDING3',
            'CONFIRMATION',
            'PRICING_DIAG',
            'WAITING_BL',
            'WAITING_FACTURE',
            'FINISHED',
        ]) {
            expect(canOpenApproval({ status }))
                .withContext(status)
                .toBeFalse();
        }
    });

    it('IRREPARABLE : seulement sur un retour non imputable à Fixtronix', () => {
        expect(canOpenApproval({ status: 'IRREPARABLE', ignoreCount: 1 })).toBeTrue();
        expect(canOpenApproval({ status: 'IRREPARABLE', ignoreCount: 0 })).toBeFalse();
        expect(canOpenApproval({ status: 'IRREPARABLE' })).toBeFalse();
        expect(
            canOpenApproval({
                status: 'IRREPARABLE',
                ignoreCount: 2,
                isErrorFromFixtronix: true,
            }),
        ).toBeFalse();
    });

    it('DI absente ou sans statut → fermée', () => {
        expect(canOpenApproval(null)).toBeFalse();
        expect(canOpenApproval(undefined)).toBeFalse();
        expect(canOpenApproval({})).toBeFalse();
        expect(canOpenApproval({ status: null })).toBeFalse();
    });
});
