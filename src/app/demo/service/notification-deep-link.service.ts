import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { canAccessRoute } from '../../shared/role-routes';
import { DiDetailService } from './di-detail.service';
import { DiFilesService } from './di-files.service';

/** Cible « page-rôle + action » : on NAVIGUE avec `?di=&action=`, et la page
 *  ouvre sa modale via `DeepLinkConsumer`. */
interface PageTarget {
    route: string;
    action: string;
}

/**
 * Cible « téléversement » : la notification annonce un DOCUMENT ATTENDU. On ouvre
 * la modale où ce document se téléverse — seulement pour qui peut le téléverser,
 * et seulement si la DI l'attend encore ; sinon RIEN ne s'ouvre (décision
 * produit : une notification de document n'ouvre jamais le dossier en lecture).
 *  - `devis-bc`   : « Approval (devis/BC) » de `ticket-list` (`negocite1Modal`) ;
 *  - `bl-facture` : « Affectation des Fichiers », modale GLOBALE sans route.
 */
interface UploadTarget {
    upload: UploadKind;
}

export type UploadKind = 'devis-bc' | 'bl-facture';

export type DeepLinkTarget = PageTarget | UploadTarget;

/** Une cible qui NAVIGUE vers une page-liste. */
export function isPageTarget(t: DeepLinkTarget): t is PageTarget {
    return 'route' in t;
}

/** Une cible qui ouvre une modale de TÉLÉVERSEMENT de document. */
export function isUploadTarget(t: DeepLinkTarget): t is UploadTarget {
    return 'upload' in t;
}

const COORD = '/tickets/ticket/coordinator-di-list';
const MAGASIN = '/tickets/ticket/magasin-di-list';
const ADMIN = '/tickets/ticket/ticket-list';

/** Page qui porte la modale « Approval (devis/BC) », et l'action qui l'ouvre. */
export const DEVIS_BC_UPLOAD_ROUTE = ADMIN;
export const DEVIS_BC_UPLOAD_ACTION = 'approval';

/**
 * Table CENTRALE `type → cible` des deep-links de notification.
 *
 * Trois formes de cible : une PAGE (on navigue avec `?di=&action=`, la page ouvre
 * sa modale via `DeepLinkConsumer`), un TÉLÉVERSEMENT (notification de document,
 * voir `UploadTarget`), ou — type ABSENT de la table (DI_FINISHED, DI_ANNULEE,
 * DI_RETOUR_n, DI_ASSIGNED_DIAG/REP…) — le modal DÉTAIL partagé.
 *
 * Les notifications de document portent le nom du document ARRIVÉ mais annoncent
 * le SUIVANT : `DI_DOC_DEVIS` = « devis ajouté, en attente de BC ». Émetteurs :
 * `fix-back/src/di/di.service.ts` (`addDevisPDF`, `addBCPDF`, `addBlPDF`,
 * entrée en WAITING_DEVIS / WAITING_BL, relance cron `remindPendingBl`).
 *
 * EXPORTÉE pour que le test d'anti-dérive vérifie que chaque destination est
 * ATTEIGNABLE par les rôles qui reçoivent la notification — c'est précisément le
 * contrôle qui manquait quand `DI_DOC_BL_PENDING` pointait vers une page
 * interdite à sa destinataire principale.
 */
export const DEEP_LINK_TABLE: Record<string, DeepLinkTarget> = {
    DI_PENDING1: { route: COORD, action: 'affecter' },
    DI_PENDING2: { route: COORD, action: 'affecter' },
    DI_PENDING3: { route: COORD, action: 'affecter' },
    DI_MAGASIN_ESTIMATION: { route: MAGASIN, action: 'composants' },
    DI_IN_MAGASIN: { route: MAGASIN, action: 'composants' },
    DI_PRICING: { route: ADMIN, action: 'pricing' },
    DI_NEGOTIATION2: { route: ADMIN, action: 'negociation2' },

    // Devis / BC attendus → « Approval (devis/BC) ».
    DI_NEGOTIATION1: { upload: 'devis-bc' }, // en attente de devis
    DI_DOC_DEVIS: { upload: 'devis-bc' }, // devis ajouté, en attente de BC
    // BC ajouté : la DI a en général déjà quitté l'attente documentaire → la page
    // n'ouvre la modale que si le statut l'autorise encore, sinon rien.
    DI_DOC_BC: { upload: 'devis-bc' },

    // BL / facture attendus → « Affectation des Fichiers » SUR PLACE.
    //
    // POURQUOI pas une route. Ces types sont multi-rôles (Coordinator + Manager +
    // Admin_Tech + Admin_Manager) : `ticket-list`, où vit l'autre modale, est
    // refusée à la coordinatrice par `routeAccessGuard` (qui la renvoyait sur sa
    // page d'accueil EN PERDANT le `?di=&action=`), et la liste ne charge que les
    // 10 DI les plus récentes alors qu'une DI en attente de BL est ancienne. Sans
    // route, ni guard ni pagination ne peuvent s'interposer.
    DI_REP_FINISHED: { upload: 'bl-facture' }, // réparation terminée, en attente de BL
    DI_DOC_BL_PENDING: { upload: 'bl-facture' }, // BL à téléverser (+ relance cron)
    DI_DOC_BL: { upload: 'bl-facture' }, // BL ajouté, en attente de facture
};

/**
 * Destinataires RÉELS de chaque type deep-linké, en valeurs de rôle PROFIL —
 * miroir des appels `emitDiHandoff` du back (`fix-back/src/di/di.service.ts`)
 * résolus par `fix-back/src/notifications/role-mapping.ts`.
 *
 * Le front ne peut pas lire ces tableaux : on les DÉCLARE ici et le test
 * d'anti-dérive exige que les deux tables aient exactement les mêmes clés, pour
 * qu'un nouveau deep-link ne puisse pas être ajouté sans déclarer son audience.
 */
export const DEEP_LINK_RECIPIENTS: Record<string, readonly string[]> = {
    DI_PENDING1: ['COORDIANTOR'],
    DI_PENDING2: ['COORDIANTOR'],
    DI_PENDING3: ['COORDIANTOR'],
    DI_MAGASIN_ESTIMATION: ['MAGASIN'],
    DI_IN_MAGASIN: ['MAGASIN'],
    DI_PRICING: ['ADMIN_MANAGER', 'ADMIN_TECH'],
    DI_NEGOTIATION2: ['ADMIN_MANAGER'],
    DI_NEGOTIATION1: ['MANAGER', 'COORDIANTOR', 'ADMIN_TECH', 'ADMIN_MANAGER'],
    DI_DOC_DEVIS: ['MANAGER', 'COORDIANTOR', 'ADMIN_TECH', 'ADMIN_MANAGER'],
    DI_DOC_BC: ['MANAGER', 'ADMIN_MANAGER'],
    DI_REP_FINISHED: ['COORDIANTOR', 'MANAGER', 'ADMIN_TECH', 'ADMIN_MANAGER'],
    DI_DOC_BL_PENDING: ['COORDIANTOR', 'MANAGER', 'ADMIN_TECH', 'ADMIN_MANAGER'],
    DI_DOC_BL: ['TECH', 'MANAGER', 'ADMIN_TECH', 'ADMIN_MANAGER', 'COORDIANTOR'],
};

/** Aiguilleur des clics de notification (cloche et toast temps réel). */
@Injectable({ providedIn: 'root' })
export class NotificationDeepLinkService {
    constructor(
        private readonly router: Router,
        private readonly diDetail: DiDetailService,
        private readonly diFiles: DiFilesService,
    ) {}

    /**
     * Ouvre la bonne cible pour une notification. L'appelant a DÉJÀ marqué la
     * notification lue (badge/bandeau corrects même quand rien ne s'ouvre).
     */
    open(n: { type?: string | null; diId?: string | null } | null | undefined): void {
        const diId = n?.diId;
        if (!diId) return;
        // Le technicien ne consulte JAMAIS le détail d'une DI : ses notifications
        // sont de simples avis SANS lien profond (ni route, ni modale). On n'ouvre
        // donc rien pour lui (couvre la cloche ET le toast temps réel) — y compris
        // `DI_DOC_BL`, dont il est destinataire : décision produit, il ne gère pas
        // la facture depuis ses écrans.
        let role: string | null = null;
        try {
            role = localStorage.getItem('role');
        } catch {
            role = null;
        }
        if (role === 'TECH') return;
        const target = n?.type ? DEEP_LINK_TABLE[n.type] : undefined;
        if (!target) {
            this.diDetail.openById(diId); // fallback détail (comportement v1)
            return;
        }
        if (isPageTarget(target)) {
            this.router.navigate([target.route], {
                queryParams: { di: diId, action: target.action },
            });
            return;
        }
        this.openUpload(target.upload, diId, role);
    }

    private openUpload(kind: UploadKind, diId: string, role: string | null): void {
        if (kind === 'bl-facture') {
            // Modale GLOBALE : ouverte sur place, aucune navigation — donc ni guard
            // de route ni dépendance à la liste chargée. Plus rien à téléverser →
            // aucune modale (pas de repli sur le dossier).
            this.diFiles.openById(diId, { onIneligible: 'nothing' });
            return;
        }
        // Devis / BC : la modale vit sur `ticket-list`. Qui n'y a pas accès ne peut
        // pas téléverser ces documents → on n'ouvre RIEN (décision produit).
        if (!canAccessRoute(role, DEVIS_BC_UPLOAD_ROUTE)) return;
        this.router.navigate([DEVIS_BC_UPLOAD_ROUTE], {
            queryParams: { di: diId, action: DEVIS_BC_UPLOAD_ACTION },
        });
    }
}
