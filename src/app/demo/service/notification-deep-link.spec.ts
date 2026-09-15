import { Router } from '@angular/router';
import {
    DEEP_LINK_RECIPIENTS,
    DEEP_LINK_TABLE,
    DEVIS_BC_UPLOAD_ACTION,
    DEVIS_BC_UPLOAD_ROUTE,
    NotificationDeepLinkService,
    isPageTarget,
    isUploadTarget,
} from './notification-deep-link.service';
import { DiDetailService } from './di-detail.service';
import { DiFilesService } from './di-files.service';
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
            // Une cible de téléversement filtre elle-même par rôle (voir plus bas).
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

    it('chaque notification de document ouvre la modale de SON document', () => {
        const expected: Record<string, string> = {
            DI_NEGOTIATION1: 'devis-bc',
            DI_DOC_DEVIS: 'devis-bc',
            DI_DOC_BC: 'devis-bc',
            DI_REP_FINISHED: 'bl-facture',
            DI_DOC_BL_PENDING: 'bl-facture',
            DI_DOC_BL: 'bl-facture',
        };
        for (const [type, kind] of Object.entries(expected)) {
            const target = DEEP_LINK_TABLE[type];
            expect(target && isUploadTarget(target) ? target.upload : null)
                .withContext(type)
                .toBe(kind);
        }
    });

    it('la modale devis/BC est atteignable par au moins un destinataire de chaque type', () => {
        // Sinon la notification serait un clic mort pour TOUT le monde.
        for (const [type, target] of Object.entries(DEEP_LINK_TABLE)) {
            if (!isUploadTarget(target) || target.upload !== 'devis-bc') continue;
            const recipients = DEEP_LINK_RECIPIENTS[type] ?? [];
            expect(recipients.some((r) => canAccessRoute(r, DEVIS_BC_UPLOAD_ROUTE)))
                .withContext(type)
                .toBeTrue();
        }
    });
});

describe('NotificationDeepLinkService.open — aiguillage du clic', () => {
    let router: jasmine.SpyObj<Router>;
    let diDetail: jasmine.SpyObj<DiDetailService>;
    let diFiles: jasmine.SpyObj<DiFilesService>;
    let service: NotificationDeepLinkService;
    let savedRole: string | null;

    const asRole = (role: string) => localStorage.setItem('role', role);
    const nothingOpened = () => {
        expect(router.navigate).not.toHaveBeenCalled();
        expect(diDetail.openById).not.toHaveBeenCalled();
        expect(diFiles.openById).not.toHaveBeenCalled();
    };

    beforeEach(() => {
        savedRole = localStorage.getItem('role');
        router = jasmine.createSpyObj<Router>('Router', ['navigate']);
        diDetail = jasmine.createSpyObj<DiDetailService>('DiDetailService', ['openById']);
        diFiles = jasmine.createSpyObj<DiFilesService>('DiFilesService', ['openById']);
        service = new NotificationDeepLinkService(router, diDetail, diFiles);
    });

    afterEach(() => {
        if (savedRole === null) localStorage.removeItem('role');
        else localStorage.setItem('role', savedRole);
    });

    it('devis attendu, rôle qui a la page → modale « Approval (devis/BC) »', () => {
        for (const role of [ROLE.MANAGER, ROLE.ADMIN_MANAGER, ROLE.ADMIN_TECH]) {
            router.navigate.calls.reset();
            asRole(role);
            service.open({ type: 'DI_NEGOTIATION1', diId: 'DI_1' });
            expect(router.navigate)
                .withContext(role)
                .toHaveBeenCalledWith([DEVIS_BC_UPLOAD_ROUTE], {
                    queryParams: { di: 'DI_1', action: DEVIS_BC_UPLOAD_ACTION },
                });
        }
    });

    it('coordinatrice sur devis/BC (elle ne peut pas les téléverser) → RIEN', () => {
        asRole(ROLE.COORDIANTOR);
        service.open({ type: 'DI_DOC_DEVIS', diId: 'DI_1' });
        service.open({ type: 'DI_NEGOTIATION1', diId: 'DI_1' });
        nothingOpened();
    });

    it('BL / facture attendus → « Affectation des Fichiers », sans repli sur le dossier', () => {
        asRole(ROLE.COORDIANTOR);
        for (const type of ['DI_REP_FINISHED', 'DI_DOC_BL_PENDING', 'DI_DOC_BL']) {
            diFiles.openById.calls.reset();
            service.open({ type, diId: 'DI_1' });
            expect(diFiles.openById)
                .withContext(type)
                .toHaveBeenCalledWith('DI_1', { onIneligible: 'nothing' });
        }
        expect(diDetail.openById).not.toHaveBeenCalled();
    });

    it('technicien → rien, même pour « BL ajouté, en attente de facture »', () => {
        asRole(ROLE.TECH);
        service.open({ type: 'DI_DOC_BL', diId: 'DI_1' });
        service.open({ type: 'DI_FINISHED', diId: 'DI_1' });
        nothingOpened();
    });

    it('type hors table → dossier (inchangé)', () => {
        asRole(ROLE.MANAGER);
        service.open({ type: 'DI_FINISHED', diId: 'DI_1' });
        expect(diDetail.openById).toHaveBeenCalledWith('DI_1');
    });

    it('cible page inchangée : DI_PRICING → ticket-list ?action=pricing', () => {
        asRole(ROLE.ADMIN_MANAGER);
        service.open({ type: 'DI_PRICING', diId: 'DI_1' });
        expect(router.navigate).toHaveBeenCalledWith(['/tickets/ticket/ticket-list'], {
            queryParams: { di: 'DI_1', action: 'pricing' },
        });
    });

    it('sans DI → rien', () => {
        asRole(ROLE.MANAGER);
        service.open({ type: 'DI_DOC_DEVIS', diId: null });
        nothingOpened();
    });
});
