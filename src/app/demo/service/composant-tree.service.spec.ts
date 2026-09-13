import { TestBed } from '@angular/core/testing';
import { Apollo } from 'apollo-angular';
import { of, throwError } from 'rxjs';
import { TreeNode } from 'primeng/api';
import {
    ComposantNodeData,
    ComposantTreeService,
    UNCATEGORIZED_ID,
} from './composant-tree.service';
import { TicketService } from './ticket.service';

/**
 * Gardes du picker en arbre du modal diagnostic :
 *  - les catégories ne sont JAMAIS sélectionnables (on choisit une pièce) ;
 *  - les composants déjà ajoutés au tableau sont masqués, mais le CACHE garde
 *    la page brute (retirer puis remettre doit les faire réapparaître) ;
 *  - ré-ouvrir une catégorie ne refait aucune requête ;
 *  - un résultat de recherche dont la catégorie est inconnue (libellé hérité,
 *    sentinelle « undefined ») tombe dans « Sans catégorie » au lieu de
 *    disparaître ;
 *  - un échec réseau rend un arbre vide, jamais une exception.
 */
describe('ComposantTreeService', () => {
    let service: ComposantTreeService;
    let apollo: jasmine.SpyObj<Apollo>;

    const CATEGORIES = [
        { _id: 'C_Composant1', category_composant: 'Résistance', composantCount: 2 },
        { _id: 'C_Composant2', category_composant: 'Condensateur', composantCount: 0 },
    ];

    const dataOf = (payload: unknown) => of({ data: payload } as any);
    const none: ReadonlySet<string> = new Set<string>();
    const dataOfNode = (n: TreeNode) => n.data as ComposantNodeData;

    beforeEach(() => {
        apollo = jasmine.createSpyObj<Apollo>('Apollo', ['query']);
        TestBed.configureTestingModule({
            providers: [
                ComposantTreeService,
                { provide: Apollo, useValue: apollo },
                {
                    provide: TicketService,
                    useValue: {
                        composantCategoryTree: () => 'CAT_QUERY',
                        browseComposants: () => 'BROWSE_QUERY',
                    },
                },
            ],
        });
        service = TestBed.inject(ComposantTreeService);
    });

    describe('loadCategories', () => {
        it('rend des racines NON sélectionnables, et feuilles si vides', (done) => {
            apollo.query.and.returnValue(
                dataOf({ composantCategoryTree: CATEGORIES }),
            );

            service.loadCategories().subscribe((nodes) => {
                expect(nodes.length).toBe(2);
                // Sélectionner une CATÉGORIE ne donnerait aucun nom au
                // formulaire → « Ajouter composant » échouerait.
                expect(nodes.every((n) => n.selectable === false)).toBeTrue();
                expect(nodes[0].label).toContain('Résistance');
                expect(nodes[0].leaf).toBeFalse();
                // Catégorie vide → pas de flèche d'expansion.
                expect(nodes[1].leaf).toBeTrue();
                done();
            });
        });

        it('ne relance pas la requête au second appel', (done) => {
            apollo.query.and.returnValue(
                dataOf({ composantCategoryTree: CATEGORIES }),
            );

            service.loadCategories().subscribe(() => {
                service.loadCategories().subscribe(() => {
                    expect(apollo.query).toHaveBeenCalledTimes(1);
                    done();
                });
            });
        });

        it('rend un arbre vide quand la requête échoue', (done) => {
            apollo.query.and.returnValue(throwError(() => new Error('offline')));

            service.loadCategories().subscribe((nodes) => {
                expect(nodes).toEqual([]);
                done();
            });
        });
    });

    describe('loadChildren', () => {
        const page = (rows: unknown[], total: number) =>
            dataOf({
                browseComposants: {
                    composantRecord: rows,
                    totalComposantCount: total,
                },
            });

        it('demande la catégorie et la première page au serveur', (done) => {
            apollo.query.and.returnValue(page([{ _id: 'X', name: 'R10' }], 1));

            service.loadChildren('C_Composant1', none).subscribe((nodes) => {
                const args = apollo.query.calls.mostRecent().args[0] as any;
                expect(args.variables.input.categoryId).toBe('C_Composant1');
                expect(args.variables.input.first).toBe(0);
                expect(nodes.length).toBe(1);
                expect(nodes[0].selectable).toBeTrue();
                expect(dataOfNode(nodes[0]).name).toBe('R10');
                done();
            });
        });

        it('signale la troncature quand la page ne couvre pas le total', (done) => {
            apollo.query.and.returnValue(page([{ _id: 'X', name: 'R10' }], 80));

            service.loadChildren('C_Composant1', none).subscribe((nodes) => {
                const last = nodes[nodes.length - 1];
                // Informatif et NON sélectionnable : un nœud cliquable est
                // impossible ici (p-tree ignore le clic sur un nœud non
                // sélectionnable, et le rendre sélectionnable fermerait le
                // panneau via TreeSelect.onSelect en mode single).
                expect(dataOfNode(last).kind).toBe('truncated');
                expect(last.selectable).toBeFalse();
                expect(last.label).toContain('79');
                done();
            });
        });

        it('demande une page assez large pour couvrir une catégorie entière', (done) => {
            apollo.query.and.returnValue(page([], 0));

            service.loadChildren('C_Composant1', none).subscribe(() => {
                const args = apollo.query.calls.mostRecent().args[0] as any;
                expect(args.variables.input.rows).toBe(200);
                done();
            });
        });

        it('masque les composants déjà ajoutés SANS les perdre du cache', (done) => {
            apollo.query.and.returnValue(
                page([{ _id: 'A', name: 'R10' }, { _id: 'B', name: 'R20' }], 2),
            );

            service
                .loadChildren('C_Composant1', new Set(['R10']))
                .subscribe((filtered) => {
                    expect(filtered.map((n) => n.label)).toEqual(['R20']);

                    // Le composant retiré du tableau doit REDEVENIR visible :
                    // le cache garde la page brute, pas la page filtrée.
                    service
                        .loadChildren('C_Composant1', none)
                        .subscribe((restored) => {
                            expect(restored.map((n) => n.label)).toEqual([
                                'R10',
                                'R20',
                            ]);
                            expect(apollo.query).toHaveBeenCalledTimes(1);
                            done();
                        });
                });
        });

        it('append: demande la page suivante et concatène', (done) => {
            apollo.query.and.returnValue(page([{ _id: 'A', name: 'R10' }], 3));

            service.loadChildren('C_Composant1', none).subscribe(() => {
                apollo.query.and.returnValue(
                    page([{ _id: 'B', name: 'R20' }], 3),
                );
                service
                    .loadChildren('C_Composant1', none, true)
                    .subscribe((nodes) => {
                        const args = apollo.query.calls.mostRecent()
                            .args[0] as any;
                        expect(args.variables.input.first).toBe(1);
                        expect(
                            nodes
                                .filter((n) => dataOfNode(n).kind === 'composant')
                                .map((n) => n.label),
                        ).toEqual(['R10', 'R20']);
                        done();
                    });
            });
        });

        it('invalidate() force un rechargement', (done) => {
            apollo.query.and.returnValue(page([{ _id: 'A', name: 'R10' }], 1));

            service.loadChildren('C_Composant1', none).subscribe(() => {
                service.invalidate();
                service.loadChildren('C_Composant1', none).subscribe(() => {
                    expect(apollo.query).toHaveBeenCalledTimes(2);
                    done();
                });
            });
        });
    });

    describe('search', () => {
        const results = (rows: unknown[]) =>
            dataOf({
                browseComposants: {
                    composantRecord: rows,
                    totalComposantCount: rows.length,
                },
            });

        it('n interroge pas le serveur en dessous de 2 caractères', (done) => {
            service.search('r', none).subscribe((nodes) => {
                expect(nodes).toEqual([]);
                expect(apollo.query).not.toHaveBeenCalled();
                done();
            });
        });

        it('regroupe par catégorie et déplie les résultats', (done) => {
            apollo.query.and.returnValue(
                dataOf({ composantCategoryTree: CATEGORIES }),
            );
            service.loadCategories().subscribe(() => {
                apollo.query.and.returnValue(
                    results([
                        { _id: 'A', name: 'R10', category_composant_id: 'C_Composant1' },
                    ]),
                );

                service.search('R1', none).subscribe((nodes) => {
                    expect(nodes.length).toBe(1);
                    expect(nodes[0].expanded).toBeTrue();
                    expect(nodes[0].label).toContain('Résistance');
                    expect(nodes[0].children?.[0].label).toBe('R10');
                    done();
                });
            });
        });

        it('verse dans « Sans catégorie » un résultat à catégorie inconnue', (done) => {
            apollo.query.and.returnValue(
                dataOf({ composantCategoryTree: CATEGORIES }),
            );
            service.loadCategories().subscribe(() => {
                apollo.query.and.returnValue(
                    results([
                        // Libellé hérité au lieu de l'_id — ne doit PAS
                        // faire disparaître le résultat de la recherche.
                        { _id: 'A', name: 'R10', category_composant_id: 'resistqmce' },
                        { _id: 'B', name: 'R20', category_composant_id: 'undefined' },
                    ]),
                );

                service.search('R1', none).subscribe((nodes) => {
                    expect(nodes.length).toBe(1);
                    expect(dataOfNode(nodes[0])._id).toBe(UNCATEGORIZED_ID);
                    expect(nodes[0].children?.length).toBe(2);
                    done();
                });
            });
        });

        it('rend un arbre vide quand la recherche échoue', (done) => {
            apollo.query.and.returnValue(throwError(() => new Error('boom')));

            service.search('res', none).subscribe((nodes) => {
                expect(nodes).toEqual([]);
                done();
            });
        });
    });
});
