import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Consommateur GÉNÉRIQUE d'un deep-link `?di=&action=` sur une page-liste rôle.
 * La mécanique est IDENTIQUE pour toutes les pages (aucun cas particulier) :
 *   1. lit les query params `di` + `action` ;
 *   2. retrouve la ligne DI dans la liste DÉJÀ chargée de la page ;
 *   3. délègue l'ouverture à la page via `onOpen(row, diId, action)`.
 * Si la ligne n'est pas (encore) présente, on retente brièvement — le temps que
 * la liste se charge après la navigation — puis on appelle `onOpen(null, …)` :
 * à la page de retomber sur le modal détail (jamais un clic mort).
 *
 * L'URL est nettoyée dès qu'un deep-link est consommé (`replaceUrl`) pour éviter
 * toute ré-ouverture (les modales pricing/négo MUTENT le statut à l'ouverture).
 */
export class DeepLinkConsumer {
    private attempts = 0;
    private destroyed = false;
    private static readonly MAX_ATTEMPTS = 8;
    private static readonly RETRY_MS = 400;

    constructor(
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        private readonly getRows: () => any[],
        private readonly onOpen: (
            row: any | null,
            diId: string,
            action: string,
        ) => void,
    ) {}

    /** À appeler dans `ngOnInit` ; se désabonne via le `destroy$` de la page. */
    listen(destroy$: Observable<void>): void {
        this.route.queryParamMap
            .pipe(takeUntil(destroy$))
            .subscribe((pm) => {
                const diId = pm.get('di');
                const action = pm.get('action');
                if (diId && action) {
                    this.attempts = 0;
                    this.tryConsume(diId, action);
                }
            });
    }

    /** À appeler dans `ngOnDestroy` (stoppe une éventuelle relance en attente). */
    destroy(): void {
        this.destroyed = true;
    }

    private tryConsume(diId: string, action: string): void {
        if (this.destroyed) return;
        const row = (this.getRows() ?? []).find((d: any) => d?._id === diId);
        if (row) {
            this.clearUrl();
            this.onOpen(row, diId, action);
            return;
        }
        if (this.attempts++ < DeepLinkConsumer.MAX_ATTEMPTS) {
            // Liste pas encore chargée → on retente le temps du chargement.
            setTimeout(
                () => this.tryConsume(diId, action),
                DeepLinkConsumer.RETRY_MS,
            );
            return;
        }
        // Liste chargée mais DI absente (pagination/filtre) → fallback détail.
        this.clearUrl();
        this.onOpen(null, diId, action);
    }

    private clearUrl(): void {
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true,
        });
    }
}
