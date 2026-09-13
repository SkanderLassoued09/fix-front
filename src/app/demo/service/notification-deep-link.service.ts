import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { DiDetailService } from './di-detail.service';
import { DiFilesService } from './di-files.service';

/** Cible « page-rôle + action » : on NAVIGUE avec `?di=&action=`, et la page
 *  ouvre sa modale via `DeepLinkConsumer`. */
interface PageTarget {
    route: string;
    action: string;
}

/** Cible « modale globale » : ouverte SUR PLACE, sans navigation ni route. */
interface ModalTarget {
    open: 'files';
}

export type DeepLinkTarget = PageTarget | ModalTarget;

/** Une cible qui NAVIGUE (par opposition à une modale ouverte sur place). */
export function isPageTarget(t: DeepLinkTarget): t is PageTarget {
    return !('open' in t);
}

const COORD = '/tickets/ticket/coordinator-di-list';
const MAGASIN = '/tickets/ticket/magasin-di-list';
const ADMIN = '/tickets/ticket/ticket-list';

/**
 * Table CENTRALE `type → cible` des deep-links de notification.
 *
 * Deux formes de cible : une PAGE (on navigue avec `?di=&action=`, la page ouvre
 * sa modale via `DeepLinkConsumer`) ou une MODALE GLOBALE (ouverte sur place,
 * sans navigation). Tout type ABSENT de la table — informatif ou multi-rôle
 * (DI_DOC_*, DI_NEGOTIATION1, DI_REP_FINISHED, DI_FINISHED), et, jusqu'à P5, la
 * ré-affectation tech (DI_ASSIGNED_DIAG/REP) — retombe sur le modal DÉTAIL
 * partagé : jamais un clic mort.
 *
 * Générique : aucune logique par page ici, seulement la table. Chaque page-rôle
 * sait ouvrir SES actions (fallback détail sinon).
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
    // BL à téléverser → ouvre DIRECTEMENT la modale « Affectation des Fichiers »
    // SUR PLACE, sans navigation.
    //
    // POURQUOI pas une route. Ce type est le SEUL multi-rôle de la table : il
    // part vers Coordinator + Manager + Admin_Tech + Admin_Manager
    // (`fix-back/src/di/di.service.ts:2796` et `:5272`). Il visait `ticket-list`,
    // que la coordinatrice — destinataire PRINCIPALE — n'a pas dans sa liste
    // blanche (`shared/role-routes.ts`) : le guard la renvoyait sur sa page
    // d'accueil EN PERDANT le `?di=&action=`. Et même pour les admins la ligne
    // était introuvable, la liste ne chargeant que les 10 DI les plus récentes
    // alors qu'une DI en attente de BL est ancienne. Sans route, ni guard ni
    // pagination ne peuvent s'interposer.
    DI_DOC_BL_PENDING: { open: 'files' },
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
    DI_DOC_BL_PENDING: [
        'COORDIANTOR',
        'MANAGER',
        'ADMIN_TECH',
        'ADMIN_MANAGER',
    ],
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
     * notification lue (badge/bandeau corrects même sur le fallback détail).
     */
    open(n: { type?: string | null; diId?: string | null } | null | undefined): void {
        const diId = n?.diId;
        if (!diId) return;
        // Le technicien ne consulte JAMAIS le détail d'une DI : ses notifications
        // sont de simples avis SANS lien profond (ni route, ni modal détail).
        // On n'ouvre donc rien pour lui (couvre la cloche ET le toast temps réel).
        // Sans objet pour `DI_DOC_BL_PENDING` (TECH n'en est pas destinataire),
        // mais placé AVANT la table à dessein : si Tech y était ajouté un jour,
        // le clic resterait un no-op délibéré plutôt qu'une surface d'upload.
        let role: string | null = null;
        try {
            role = localStorage.getItem('role');
        } catch {
            role = null;
        }
        if (role === 'TECH') return;
        const target = n?.type ? DEEP_LINK_TABLE[n.type] : undefined;
        if (target) {
            // Modale GLOBALE : on ouvre sur place, aucune navigation — donc ni
            // guard de route ni dépendance à la liste chargée.
            if ('open' in target) {
                this.diFiles.openById(diId);
                return;
            }
            this.router.navigate([target.route], {
                queryParams: { di: diId, action: target.action },
            });
        } else {
            this.diDetail.openById(diId); // fallback détail (comportement v1)
        }
    }
}
