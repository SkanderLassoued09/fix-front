import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { BehaviorSubject } from 'rxjs';
import { canAffectFiles } from '../components/ticket/shared/di-files-modal/di-files.eligibility';
import { DiDetailService } from './di-detail.service';
import { TicketRefreshService } from './ticket-refresh.service';
import { TicketService } from './ticket.service';
import { NotifyService } from '../../shared/ui/notify.service';

/**
 * Ouvre la modale « Affectation des Fichiers » (`app-di-files-modal`) pour une
 * DI donnée, depuis N'IMPORTE QUELLE page. La modale est montée UNE SEULE FOIS
 * dans le layout (`app.component.html`) et pilotée par ce service — calque
 * exact de `DiDetailService`.
 *
 * POURQUOI PAS UNE NAVIGATION. L'ancien deep-link de la notification BL
 * envoyait vers `ticket-list?di=…&action=affectation`, ce qui échouait de deux
 * façons indépendantes :
 *  1. `DeepLinkConsumer` cherchait la ligne dans les DI DÉJÀ CHARGÉES, or la
 *     liste n'en charge que 10 (les plus récentes) alors qu'une DI en attente de
 *     BL est par construction ancienne → ligne jamais trouvée, repli sur la
 *     modale DÉTAIL après 3,2 s de retries ;
 *  2. la coordinatrice — destinataire PRINCIPALE de l'alerte — est refusée sur
 *     cette route par `routeAccessGuard`, qui la renvoyait sur sa page d'accueil
 *     en PERDANT la query string.
 * En chargeant la DI par son id et en ouvrant la modale sur place, les deux
 * disparaissent : plus de pagination, plus de route, donc plus de guard.
 */
@Injectable({ providedIn: 'root' })
export class DiFilesService {
    readonly di$ = new BehaviorSubject<any>(null);
    readonly visible$ = new BehaviorSubject<boolean>(false);
    readonly loading$ = new BehaviorSubject<boolean>(false);

    constructor(
        private readonly apollo: Apollo,
        private readonly ticket: TicketService,
        private readonly diDetail: DiDetailService,
        private readonly ticketRefresh: TicketRefreshService,
        private readonly notify: NotifyService,
    ) {}

    /** Ligne DI déjà en main (bouton trombone d'une liste) → ouverture
     *  immédiate, AUCUNE requête supplémentaire : le comportement historique. */
    open(row: any): void {
        if (!row?._id) return;
        this.loading$.next(false);
        this.di$.next(row);
        this.visible$.next(true);
    }

    /**
     * Deep-link notification → charge la DI par son id puis ouvre.
     *
     * `network-only` est IMPORTANT : l'alerte BL se réarme à chaque passe du
     * cron, le statut en cache n'est donc pas digne de confiance.
     */
    openById(diId: string): void {
        if (!diId) return;
        this.loading$.next(true);
        this.di$.next(null);
        this.visible$.next(true);
        this.apollo
            .query<any>({
                query: this.ticket.getDiDetail(diId),
                fetchPolicy: 'network-only',
            })
            .subscribe({
                next: ({ data }) => {
                    const di = data?.getDiDetail ?? null;
                    this.loading$.next(false);
                    if (!di) {
                        // DI supprimée / id invalide : ouvrir le détail serait
                        // tout aussi vide → on referme et on le dit.
                        this.visible$.next(false);
                        this.notify.error("Cette DI n'existe plus.", {
                            summary: 'DI introuvable',
                        });
                        return;
                    }
                    if (!canAffectFiles(di)) {
                        // Course normale : un collègue a téléversé le BL entre
                        // l'alerte et le clic. On bascule sur le dossier plutôt
                        // que d'afficher une modale d'upload sans objet —
                        // « jamais un clic mort ».
                        this.visible$.next(false);
                        this.di$.next(null);
                        this.diDetail.openById(diId);
                        return;
                    }
                    this.di$.next(di);
                },
                error: () => {
                    this.loading$.next(false);
                    this.visible$.next(false);
                    this.notify.error(
                        "Impossible d'ouvrir le dossier. Réessayez.",
                    );
                },
            });
    }

    setVisible(v: boolean): void {
        this.visible$.next(v);
        if (!v) this.di$.next(null);
    }

    /**
     * Appelé après un enregistrement réussi. On ne rappelle PAS l'hôte : les
     * listes écoutent déjà `TicketRefreshService` (`ticket-list.component.ts:941`,
     * `coordinator-di-list.component.ts:507`), donc celle qui est affichée se
     * rafraîchit d'elle-même — d'où que la modale ait été ouverte.
     */
    markSaved(): void {
        this.visible$.next(false);
        this.di$.next(null);
        this.ticketRefresh.requestRefresh('ticket-list', {
            source: 'di-files-modal',
        });
        this.ticketRefresh.requestRefresh('coordinator-list', {
            source: 'di-files-modal',
        });
    }
}
