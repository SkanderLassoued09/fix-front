import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { TicketService } from './ticket.service';
import {
    CatalogComposant,
    buildComposantIndex,
    cleanComposantValue,
} from '../components/ticket/shared/composant-enrichment.util';

export interface ComposantCatalog {
    /** `name` (clé de jointure des lignes de DI) → fiche catalogue. */
    byName: Map<string, CatalogComposant>;
    /** `C_Composant<N>` → libellé de catégorie. */
    categoryById: Map<string, string>;
}

const EMPTY: ComposantCatalog = {
    byName: new Map(),
    categoryById: new Map(),
};

/**
 * Catalogue composants MIS EN CACHE pour la session.
 *
 * Une ligne de DI ne porte que `{ nameComposant, quantity }` : pour afficher
 * prix / statut / arrivage / stock il faut joindre le catalogue, et la seule
 * clé qui existe est le NOM.
 *
 * Pourquoi charger le catalogue ENTIER une fois plutôt que N `findOneComposant` :
 * cette query LÈVE une erreur `NOT_FOUND` pour chaque nom introuvable
 * (`composant.service.findOneComposant`), donc un seul composant hérité ferait
 * échouer la section entière — en plus du N+1 réseau. `findAllComposant` est
 * déjà chargé tel quel par `magasin-di-list` : on réutilise la même requête, en
 * la mutualisant.
 *
 * L'échec n'est JAMAIS bloquant : on retombe sur un catalogue vide et le modal
 * affiche nom + quantité, comme avant.
 */
@Injectable({ providedIn: 'root' })
export class ComposantCatalogService {
    /** Au-delà, un prix modifié dans « Catalogue composants » serait périmé. */
    private static readonly TTL_MS = 5 * 60 * 1000;

    private cache$: Observable<ComposantCatalog> | null = null;
    private loadedAt = 0;

    constructor(
        private readonly apollo: Apollo,
        private readonly ticket: TicketService,
    ) {}

    load(): Observable<ComposantCatalog> {
        const expired = Date.now() - this.loadedAt > ComposantCatalogService.TTL_MS;
        if (!this.cache$ || expired) {
            this.loadedAt = Date.now();
            this.cache$ = forkJoin({
                composants: this.apollo
                    .query<any>({ query: this.ticket.getAllComposant() })
                    .pipe(catchError(() => of(null))),
                categories: this.apollo
                    .query<any>({ query: this.ticket.findAllComposant_Category() })
                    .pipe(catchError(() => of(null))),
            }).pipe(
                map(({ composants, categories }) => this.build(composants, categories)),
                catchError(() => of(EMPTY)),
                shareReplay({ bufferSize: 1, refCount: false }),
            );
        }
        return this.cache$;
    }

    /** À appeler après une écriture de composant (écrans d'édition). */
    invalidate(): void {
        this.cache$ = null;
        this.loadedAt = 0;
    }

    private build(composants: any, categories: any): ComposantCatalog {
        const rows: CatalogComposant[] = Array.isArray(
            composants?.data?.findAllComposant,
        )
            ? composants.data.findAllComposant
            : [];
        const cats: any[] = Array.isArray(
            categories?.data?.findAllComposant_Category,
        )
            ? categories.data.findAllComposant_Category
            : [];

        const categoryById = new Map<string, string>();
        for (const c of cats) {
            const id = cleanComposantValue(c?._id);
            const label = cleanComposantValue(c?.category_composant);
            if (id && label) categoryById.set(id, label);
        }

        return { byName: buildComposantIndex(rows), categoryById };
    }
}
