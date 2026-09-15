import { canAffectFiles } from './di-files.eligibility';

/**
 * Règle partagée du bouton trombone et du deep-link de notification : sur quelles
 * DI la modale « Affectation des Fichiers » a-t-elle un objet ?
 */
describe('canAffectFiles', () => {
    it('TOUTE DI IRREPARABLE est éligible — cycle 0, retour ou erreur Fixtronix', () => {
        expect(canAffectFiles({ status: 'IRREPARABLE', ignoreCount: 0 })).toBeTrue();
        expect(canAffectFiles({ status: 'IRREPARABLE', ignoreCount: 2 })).toBeTrue();
        expect(
            canAffectFiles({
                status: 'IRREPARABLE',
                ignoreCount: 1,
                isErrorFromFixtronix: true,
            }),
        ).toBeTrue();
        expect(
            canAffectFiles({ status: 'IRREPARABLE', isErrorFromFixtronix: true }),
        ).toBeTrue();
    });

    it('la clôture documentaire et FINISHED restent éligibles', () => {
        for (const status of [
            'WAITING_BL',
            'WAITING_FACTURE',
            'CLOSING',
            'ATTENTE_BL_FACTURE',
            'FINISHED',
        ]) {
            expect(canAffectFiles({ status })).withContext(status).toBeTrue();
        }
    });

    it('ailleurs : rien à téléverser', () => {
        for (const status of ['ANNULER', 'INREPARATION', 'PENDING1', 'WAITING_DEVIS']) {
            expect(canAffectFiles({ status })).withContext(status).toBeFalse();
        }
        expect(canAffectFiles(null)).toBeFalse();
        expect(canAffectFiles({})).toBeFalse();
    });
});
