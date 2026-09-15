import { buildFinanceRows, computeEcart } from './di-finance.util';

/**
 * Tableau « Finances » du modal « Dossier d'intervention ».
 *
 * Écart = Facturé − (Coût réel + Composants), soustraction simple. Ces tests
 * figent la disparition du plancher 150 TND (250 facturé pour 60,881 de coût
 * affichait +100 au lieu de +189,119) et l'entrée des pièces dans l'écart de
 * la réparation.
 */
describe('di-finance.util', () => {
    describe('computeEcart', () => {
        it('soustrait le coût du facturé, sans plancher 150', () => {
            const e = computeEcart(250, 60.881);
            expect(e.absent).toBeFalse();
            expect(e.montant).toBe(189.119);
            expect(e.percent).toBeCloseTo(310.64, 1);
            expect(e.tone).toBe('pos');
        });

        it('négatif quand le facturé est sous le coût', () => {
            const e = computeEcart(100, 150);
            expect(e.montant).toBe(-50);
            expect(e.percent).toBeCloseTo(-33.33, 1);
            expect(e.tone).toBe('neg');
        });

        it('facturé absent → absent', () => {
            expect(computeEcart(null, 10).absent).toBeTrue();
        });

        it('facturé 0 est un montant, pas une absence', () => {
            const e = computeEcart(0, 10);
            expect(e.absent).toBeFalse();
            expect(e.montant).toBe(-10);
        });

        it('coût nul → pourcentage null', () => {
            const e = computeEcart(50, 0);
            expect(e.montant).toBe(50);
            expect(e.percent).toBeNull();
        });

        it('écart négligeable → neutral', () => {
            expect(computeEcart(100.2, 100).tone).toBe('neutral');
        });
    });

    describe('buildFinanceRows', () => {
        const base = {
            diagLabor: 60.881,
            repLabor: 50,
            composants: 750,
            factureDiag: 250,
            factureRep: 900,
            nonPayant: false,
        };

        it('diagnostic : pas de composants, écart contre la main-d’œuvre', () => {
            const [diag] = buildFinanceRows(base);
            expect(diag.coutReel).toBe(60.881);
            expect(diag.composants).toBeNull();
            expect(diag.facture).toBe(250);
            expect(diag.ecart?.montant).toBe(189.119);
        });

        it('réparation : écart = estimation − (main-d’œuvre + composants)', () => {
            const [, rep] = buildFinanceRows(base);
            expect(rep.coutReel).toBe(50);
            expect(rep.composants).toBe(750);
            expect(rep.facture).toBe(900);
            expect(rep.ecart?.montant).toBe(100);
            expect(rep.ecart?.percent).toBeCloseTo(12.5, 5);
        });

        it('total : somme des facturés contre le coût complet', () => {
            const [, , total] = buildFinanceRows(base);
            expect(total.isTotal).toBeTrue();
            expect(total.coutReel).toBe(110.881);
            expect(total.composants).toBe(750);
            expect(total.facture).toBe(1150);
            expect(total.ecart?.montant).toBe(289.119);
        });

        it('diagnostic non payant : « Non facturé », total = estimation seule', () => {
            const [diag, , total] = buildFinanceRows({
                ...base,
                factureDiag: 0,
                nonPayant: true,
            });
            expect(diag.nonPayant).toBeTrue();
            expect(diag.facture).toBeNull();
            expect(diag.ecart).toBeNull();
            expect(total.nonPayant).toBeUndefined();
            expect(total.facture).toBe(900);
            expect(total.ecart?.montant).toBe(39.119);
        });

        it('estimation réparation absente (irréparable) → « — »', () => {
            const [, rep, total] = buildFinanceRows({ ...base, factureRep: null });
            expect(rep.facture).toBeNull();
            expect(rep.ecart?.absent).toBeTrue();
            expect(total.facture).toBe(250);
        });

        it('pièces par phase : prix du diagnostic, hausse visible en réparation', () => {
            const [diag, rep, total] = buildFinanceRows({
                ...base,
                composantsDiag: 600,
                composantsDiagRecorded: true,
            });
            expect(diag.composants).toBe(600);
            expect(diag.composantsUnrecorded).toBeFalse();
            // L'écart du diagnostic reste la main-d'œuvre seule.
            expect(diag.ecart?.montant).toBe(189.119);
            expect(rep.composants).toBe(750);
            expect(rep.composantsRise).toBe(150);
            // Pièces comptées une seule fois, au prix de la réparation.
            expect(total.composants).toBe(750);
            expect(total.ecart?.montant).toBe(289.119);
        });

        it('prix du diagnostic non enregistré : signalé, aucune hausse', () => {
            const [diag, rep] = buildFinanceRows({
                ...base,
                composantsDiag: 750,
                composantsDiagRecorded: false,
            });
            expect(diag.composantsUnrecorded).toBeTrue();
            expect(rep.composantsRise).toBeNull();
        });

        it('aucun facturé → total absent', () => {
            const [, , total] = buildFinanceRows({
                ...base,
                factureDiag: null,
                factureRep: null,
            });
            expect(total.facture).toBeNull();
            expect(total.ecart?.absent).toBeTrue();
        });
    });
});
