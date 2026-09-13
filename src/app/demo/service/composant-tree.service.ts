import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { TreeNode } from 'primeng/api';
import { TicketService } from './ticket.service';

/** Sentinelle du fourre-tout — doit rester alignée sur le back
 *  (`ComposantService.UNCATEGORIZED_ID`). */
export const UNCATEGORIZED_ID = '__uncategorized__';

/**
 * Taille d'une page d'enfants chargée à l'ouverture d'un nœud.
 *
 * Dimensionnée pour couvrir n'importe quelle catégorie réelle du catalogue
 * (~186 composants au total, toutes catégories confondues) en UN aller-retour.
 * La pagination existe quand même côté serveur — elle borne le pire cas et
 * sert la recherche — mais on ne pagine pas DANS une branche de l'arbre :
 * voir `truncatedNode()` pour la raison (contrainte du widget).
 */
const PAGE_SIZE = 200;

/** En dessous, la recherche serveur n'est pas déclenchée. */
export const MIN_SEARCH_LENGTH = 2;

/** Charge utile portée par un nœud de l'arbre. */
export interface ComposantNodeData {
    readonly kind: 'category' | 'composant' | 'truncated';
    readonly _id: string;
    readonly name: string;
    /** `kind: 'truncated'` seulement — la catégorie concernée. */
    readonly categoryId?: string;
}

interface CategoryPage {
    nodes: TreeNode[];
    total: number;
    loaded: number;
}

/**
 * Arbre « Catégorie → Composant » du picker du modal diagnostic.
 *
 * POURQUOI UN SERVICE. `tech-di-list.component.ts` dépasse 5 000 lignes ;
 * la construction des nœuds, la pagination et le cache n'ont rien à y faire.
 *
 * CE QU'IL GARANTIT
 *  - les enfants d'une catégorie ne sont chargés qu'à l'OUVERTURE du nœud,
 *    une page à la fois (`browseComposants`, projection à 3 champs) ;
 *  - ré-ouvrir une catégorie déjà chargée ne refait AUCUNE requête (cache) ;
 *  - les composants déjà ajoutés au tableau du diagnostic sont MASQUÉS de
 *    l'arbre — c'est le comportement historique du dropdown plat, qui les
 *    retirait de sa liste d'options ;
 *  - un échec réseau ne casse jamais le picker : on retombe sur un arbre/une
 *    page vide, comme `ComposantCatalogService`.
 *
 * Les catégories du back sont PLATES (aucun champ parent) : l'arbre fait donc
 * exactement deux niveaux, et un nœud composant est toujours une feuille.
 */
@Injectable({ providedIn: 'root' })
export class ComposantTreeService {
    /** categoryId → page déjà chargée. Vidé par `invalidate()`. */
    private readonly cache = new Map<string, CategoryPage>();
    /** Racines mémorisées, pour ne pas re-interroger à chaque ouverture. */
    private roots: TreeNode[] | null = null;

    constructor(
        private readonly apollo: Apollo,
        private readonly ticket: TicketService,
    ) {}

    /**
     * Vide le cache. À appeler après la création d'un composant : sans ça, la
     * nouvelle pièce n'apparaît pas dans l'arbre tant que le modal reste ouvert.
     */
    invalidate(): void {
        this.cache.clear();
        this.roots = null;
    }

    /** Racines = catégories. `leaf` quand la catégorie est vide (pas de flèche). */
    loadCategories(): Observable<TreeNode[]> {
        if (this.roots) {
            return of(this.roots.map((n) => ({ ...n })));
        }
        return this.apollo
            .query<any>({
                query: this.ticket.composantCategoryTree(),
                fetchPolicy: 'no-cache',
            })
            .pipe(
                map(({ data }) => {
                    const rows: any[] = data?.composantCategoryTree ?? [];
                    this.roots = rows.map((row) => this.categoryNode(row));
                    return this.roots.map((n) => ({ ...n }));
                }),
                catchError(() => of([] as TreeNode[])),
            );
    }

    /**
     * Enfants d'une catégorie (une page). `excludedNames` = les composants déjà
     * présents dans le tableau du diagnostic, à masquer.
     *
     * Le filtrage des déjà-ajoutés se fait à l'AFFICHAGE, pas dans le cache :
     * le cache garde la page brute, sinon retirer puis re-retirer un composant
     * du tableau laisserait un trou permanent dans l'arbre.
     */
    loadChildren(
        categoryId: string,
        excludedNames: ReadonlySet<string>,
        append = false,
    ): Observable<TreeNode[]> {
        const cached = this.cache.get(categoryId);
        if (cached && !append) {
            return of(this.renderPage(categoryId, cached, excludedNames));
        }

        const first = append ? (cached?.loaded ?? 0) : 0;
        return this.apollo
            .query<any>({
                query: this.ticket.browseComposants(),
                variables: { input: { categoryId, rows: PAGE_SIZE, first } },
                fetchPolicy: 'no-cache',
            })
            .pipe(
                map(({ data }) => {
                    const page = data?.browseComposants;
                    const rows: any[] = page?.composantRecord ?? [];
                    const total = Number(page?.totalComposantCount ?? 0);
                    const nodes = rows.map((row) => this.composantNode(row));

                    const merged: CategoryPage = append && cached
                        ? {
                              nodes: [...cached.nodes, ...nodes],
                              total,
                              loaded: cached.loaded + rows.length,
                          }
                        : { nodes, total, loaded: rows.length };

                    this.cache.set(categoryId, merged);
                    return this.renderPage(categoryId, merged, excludedNames);
                }),
                catchError(() => of([] as TreeNode[])),
            );
    }

    /**
     * Recherche profonde : interroge directement les composants, toutes
     * catégories confondues, et REGROUPE les résultats sous leur catégorie
     * (nœuds dépliés d'office — l'utilisateur cherche un composant, pas une
     * catégorie).
     *
     * Volontairement NON mise en cache : le terme change à chaque frappe.
     */
    search(
        term: string,
        excludedNames: ReadonlySet<string>,
    ): Observable<TreeNode[]> {
        const trimmed = (term ?? '').trim();
        if (trimmed.length < MIN_SEARCH_LENGTH) {
            return of([]);
        }
        return this.apollo
            .query<any>({
                query: this.ticket.browseComposants(),
                variables: {
                    input: { search: trimmed, rows: PAGE_SIZE, first: 0 },
                },
                fetchPolicy: 'no-cache',
            })
            .pipe(
                map(({ data }) => {
                    const rows: any[] = data?.browseComposants?.composantRecord ?? [];
                    return this.groupByCategory(rows, excludedNames);
                }),
                catchError(() => of([] as TreeNode[])),
            );
    }

    // ── Construction des nœuds ──────────────────────────────────────────────

    private categoryNode(row: any): TreeNode {
        const count = Number(row?.composantCount ?? 0);
        const id = String(row?._id ?? '');
        const label = String(row?.category_composant ?? '').trim() || 'Sans nom';
        return {
            key: `cat:${id}`,
            label: count > 0 ? `${label} (${count})` : label,
            // Une catégorie n'est jamais SÉLECTIONNABLE : on choisit une pièce,
            // pas une famille. Sans ça le formulaire reçoit un nœud catégorie
            // et « Ajouter composant » n'a aucun nom à utiliser.
            selectable: false,
            leaf: count === 0,
            data: { kind: 'category', _id: id, name: label } as ComposantNodeData,
            children: [],
        };
    }

    private composantNode(row: any): TreeNode {
        const name = String(row?.name ?? '').trim();
        return {
            key: `cmp:${String(row?._id ?? name)}`,
            label: name,
            leaf: true,
            selectable: true,
            data: {
                kind: 'composant',
                _id: String(row?._id ?? ''),
                name,
            } as ComposantNodeData,
        };
    }

    /**
     * Avis de TRONCATURE — informatif, volontairement NON cliquable.
     *
     * POURQUOI PAS UN « Charger plus… » CLIQUABLE : dans `p-tree`,
     * `onNodeClick` sort immédiatement quand `node.selectable === false` — un
     * tel nœud ne recevrait donc jamais le clic. Et le rendre sélectionnable
     * est pire : `TreeSelect.onSelect` appelle `hide()` en mode `single`, donc
     * le clic FERMERAIT le panneau au lieu de charger la suite, en plus de
     * faire passer un faux nœud par le formulaire.
     *
     * On affiche donc un repère honnête qui renvoie vers la recherche — qui,
     * elle, interroge le serveur sur TOUT le catalogue.
     */
    private truncatedNode(categoryId: string, remaining: number): TreeNode {
        return {
            key: `truncated:${categoryId}`,
            label: `+ ${remaining} autre${remaining > 1 ? 's' : ''} — utilisez la recherche`,
            leaf: true,
            selectable: false,
            data: {
                kind: 'truncated',
                _id: `truncated:${categoryId}`,
                name: '',
                categoryId,
            } as ComposantNodeData,
        };
    }

    /** Applique le masquage des déjà-ajoutés + ajoute « Charger plus… ». */
    private renderPage(
        categoryId: string,
        page: CategoryPage,
        excludedNames: ReadonlySet<string>,
    ): TreeNode[] {
        const visible = page.nodes.filter(
            (n) => !excludedNames.has(this.nameOf(n)),
        );
        const remaining = page.total - page.loaded;
        if (remaining > 0) {
            visible.push(this.truncatedNode(categoryId, remaining));
        }
        return visible;
    }

    /** Résultats de recherche → arbre à 2 niveaux, catégories dépliées. */
    private groupByCategory(
        rows: any[],
        excludedNames: ReadonlySet<string>,
    ): TreeNode[] {
        const labelOf = new Map<string, string>(
            (this.roots ?? []).map((n) => [
                String((n.data as ComposantNodeData)._id),
                String((n.data as ComposantNodeData).name),
            ]),
        );

        const buckets = new Map<string, TreeNode[]>();
        for (const row of rows) {
            const node = this.composantNode(row);
            if (excludedNames.has(this.nameOf(node))) {
                continue;
            }
            const raw = String(row?.category_composant_id ?? '').trim();
            // Une valeur inconnue (libellé hérité, sentinelle « undefined »…)
            // ne doit pas faire disparaître le résultat : elle tombe dans le
            // fourre-tout, exactement comme côté serveur.
            const key = labelOf.has(raw) ? raw : UNCATEGORIZED_ID;
            const list = buckets.get(key);
            if (list) {
                list.push(node);
            } else {
                buckets.set(key, [node]);
            }
        }

        return [...buckets.entries()].map(([categoryId, children]) => ({
            key: `cat:${categoryId}`,
            label: `${labelOf.get(categoryId) ?? 'Sans catégorie'} (${children.length})`,
            selectable: false,
            leaf: false,
            expanded: true,
            data: {
                kind: 'category',
                _id: categoryId,
                name: labelOf.get(categoryId) ?? 'Sans catégorie',
            } as ComposantNodeData,
            children,
        }));
    }

    private nameOf(node: TreeNode): string {
        return String((node.data as ComposantNodeData)?.name ?? '');
    }
}
