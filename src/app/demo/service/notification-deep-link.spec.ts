import {
    DEEP_LINK_RECIPIENTS,
    DEEP_LINK_TABLE,
    isPageTarget,
} from './notification-deep-link.service';
import { ROLE, canAccessRoute } from '../../shared/role-routes';

/**
 * GARDE ANTI-DÉRIVE des deep-links de notification.
 *
 * `role-routes.spec.ts` vérifie déjà que tout lien du MENU est autorisé par la
 * matrice. Rien ne vérifiait l'équivalent pour les DESTINATIONS DE DEEP-LINK — et
 * c'est exactement par ce trou qu'est passée la panne : `DI_DOC_BL_PENDING`
 * envoyait la coordinatrice (sa destinataire citée en PREMIER côté back) vers
 * `/tickets/ticket/ticket-list`, une route que `routeAccessGuard` lui refuse. Le
 * guard la renvoyait sur sa page d'accueil en perdant le `?di=&action=` : l'alerte
 * BL, qui bat et sonne jusqu'au téléversement, était un clic mort pour elle.
 *
 * Le premier test ci-dessous ÉCHOUERAIT sur le code d'avant le correctif.
 */
describe('deep-links de notification — atteignabilité par destinataire', () => {
    it('chaque destination NAVIGUÉE est accessible à TOUS ses destinataires', () => {
        for (const [type, target] of Object.entries(DEEP_LINK_TABLE)) {
            // Une modale globale n'a pas de route : ni guard ni pagination ne
            // peuvent s'interposer, il n'y a donc rien à vérifier.
            if (!isPageTarget(target)) continue;
            const recipients = DEEP_LINK_RECIPIENTS[type] ?? [];
            expect(recipients.length)
                .withContext(`${type} n'a aucun destinataire déclaré`)
                .toBeGreaterThan(0);
            for (const role of recipients) {
                expect(canAccessRoute(role, target.route))
                    .withContext(
                        `${type} → ${target.route} est INTERDIT à ${role} : ` +
                            `le guard le redirigerait en perdant ?di=&action=. ` +
                            `Soit ouvrir une modale globale, soit élargir ROLE_ROUTES.`,
                    )
                    .toBeTrue();
            }
        }
    });

    it('les deux tables déclarent exactement les mêmes types', () => {
        // Empêche d'ajouter un deep-link sans déclarer son audience (et
        // inversement, de laisser une audience orpheline).
        expect(Object.keys(DEEP_LINK_TABLE).sort()).toEqual(
            Object.keys(DEEP_LINK_RECIPIENTS).sort(),
        );
    });

    it('ne déclare que des rôles qui existent réellement', () => {
        const known = Object.values(ROLE) as string[];
        for (const [type, roles] of Object.entries(DEEP_LINK_RECIPIENTS)) {
            for (const role of roles) {
                expect(known)
                    .withContext(`${type} cite un rôle inconnu : ${role}`)
                    .toContain(role);
            }
        }
    });

    it('le BL est bien une modale globale, pas une route', () => {
        // Verrou explicite sur le correctif : si quelqu'un le remet en route,
        // le premier test de ce fichier tombe — celui-ci dit pourquoi.
        const bl = DEEP_LINK_TABLE['DI_DOC_BL_PENDING'];
        expect(isPageTarget(bl))
            .withContext(
                'DI_DOC_BL_PENDING doit ouvrir la modale SUR PLACE : il est le seul ' +
                    'type multi-rôle, et aucune page-liste n’est accessible à ses 4 ' +
                    'destinataires à la fois.',
            )
            .toBeFalse();
        expect(DEEP_LINK_RECIPIENTS['DI_DOC_BL_PENDING']).toContain(
            ROLE.COORDIANTOR,
        );
    });
});
