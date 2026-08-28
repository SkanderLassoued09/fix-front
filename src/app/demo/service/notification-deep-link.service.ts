import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { DiDetailService } from './di-detail.service';

/** Cible d'un deep-link de notification : page-rôle + action à ouvrir. */
interface DeepLinkTarget {
    route: string;
    action: string;
}

/**
 * Table CENTRALE `type → { route, action }` des deep-links de notification.
 * Un clic sur une notification ACTIONNABLE navigue vers la page-rôle concernée
 * avec `?di=&action=` ; la page ouvre alors sa modale d'action (via
 * `DeepLinkConsumer`). Tout type ABSENT de la table — informatif ou multi-rôle
 * (DI_DOC_*, DI_NEGOTIATION1, DI_REP_FINISHED, DI_FINISHED), et, jusqu'à P5, la
 * ré-affectation tech (DI_ASSIGNED_DIAG/REP) — retombe sur le modal DÉTAIL
 * partagé : jamais un clic mort.
 *
 * Générique : aucune logique par page ici, seulement la table. Chaque page-rôle
 * sait ouvrir SES actions (fallback détail sinon).
 */
@Injectable({ providedIn: 'root' })
export class NotificationDeepLinkService {
    private static readonly COORD = '/tickets/ticket/coordinator-di-list';
    private static readonly MAGASIN = '/tickets/ticket/magasin-di-list';
    private static readonly ADMIN = '/tickets/ticket/ticket-list';

    private static readonly TABLE: Record<string, DeepLinkTarget> = {
        DI_PENDING1: { route: NotificationDeepLinkService.COORD, action: 'affecter' },
        DI_PENDING2: { route: NotificationDeepLinkService.COORD, action: 'affecter' },
        DI_PENDING3: { route: NotificationDeepLinkService.COORD, action: 'affecter' },
        DI_MAGASIN_ESTIMATION: {
            route: NotificationDeepLinkService.MAGASIN,
            action: 'composants',
        },
        DI_IN_MAGASIN: {
            route: NotificationDeepLinkService.MAGASIN,
            action: 'composants',
        },
        DI_PRICING: { route: NotificationDeepLinkService.ADMIN, action: 'pricing' },
        DI_NEGOTIATION2: {
            route: NotificationDeepLinkService.ADMIN,
            action: 'negociation2',
        },
        // BL à téléverser → ouvre DIRECTEMENT la modale « Affectation des
        // Fichiers » (upload BL/Facture) sur la liste tickets.
        DI_DOC_BL_PENDING: {
            route: NotificationDeepLinkService.ADMIN,
            action: 'affectation',
        },
    };

    constructor(
        private readonly router: Router,
        private readonly diDetail: DiDetailService,
    ) {}

    /**
     * Ouvre la bonne cible pour une notification. L'appelant a DÉJÀ marqué la
     * notification lue (badge/bandeau corrects même sur le fallback détail).
     */
    open(n: { type?: string | null; diId?: string | null } | null | undefined): void {
        const diId = n?.diId;
        if (!diId) return;
        // Le technicien ne consulte JAMAIS le détail d'une DI : ses notifications
        // sont de simples avis SANS lien profond (ni route, ni modal détail).
        // On n'ouvre donc rien pour lui (couvre la cloche ET le toast temps réel).
        let role: string | null = null;
        try {
            role = localStorage.getItem('role');
        } catch {
            role = null;
        }
        if (role === 'TECH') return;
        const target = n?.type
            ? NotificationDeepLinkService.TABLE[n.type]
            : undefined;
        if (target) {
            this.router.navigate([target.route], {
                queryParams: { di: diId, action: target.action },
            });
        } else {
            this.diDetail.openById(diId); // fallback détail (comportement v1)
        }
    }
}
