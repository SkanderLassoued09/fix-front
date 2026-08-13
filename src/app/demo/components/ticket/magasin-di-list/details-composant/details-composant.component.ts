import {
    Component,
    OnInit,
    OnDestroy,
    Input,
    Output,
    EventEmitter,
    HostBinding,
} from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Apollo } from 'apollo-angular';
import { ProductService } from 'src/app/demo/service/product.service';
import { TicketService } from 'src/app/demo/service/ticket.service';
import { UpdateComposantMutationResponse } from '../magasin-di-list.interfaces';
import { ConfirmationService, MessageService } from 'primeng/api';
import { NotificationService } from 'src/app/demo/service/notification.service';
import { MutationRunner } from 'src/app/demo/service/mutation-runner.service';

// TODO check type of these fields
export interface Composant {
    _id: string;
    name: string;
    category_composant_id: string;
    coming_date: string;
    link: string;
    package: string;
    pdf: string;
    prix_achat: string;
    prix_vente: string;
    quantity_stocked: string;
    status: string;
}
@Component({
    selector: 'app-details-composant',
    templateUrl: './details-composant.component.html',
    styleUrl: './details-composant.component.scss',
})
export class DetailsComposantComponent implements OnInit, OnDestroy {
    private readonly destroy$ = new Subject<void>();
    /** Hosted-in-modal support (magasin « Affectation finale »): `diId` feeds
     *  the DI id in place of the :id route param; `embedded` hides the page
     *  chrome and turns the finish-navigation into a `closed` emit so the host
     *  can close the dialog + refresh its list. */
    @Input() diId?: string;
    @Input() embedded = false;
    @Output() closed = new EventEmitter<void>();
    /** Envoi au coordinateur en cours (désactive le bouton — anti double-submit
     *  côté UI ; `MutationRunner` verrouille aussi côté service via la clé). */
    isSending = false;
    products;
    composants: any[];
    formUpdateComposant: FormGroup;
    selectedDi_id: any;

    composantValues: Composant;
    isActive: boolean;
    private _id: string;
    isSentToCoordinator: string;
    componentInfo: any;
    componentsAreConfirmed: boolean;
    /** Statut RÉEL de la DI — source de vérité du handshake v2 (pilote les
     *  boutons). Legacy `INMAGASIN`/`CONFIRMATION_COMPOSANTS` tolérés. */
    diStatus: string;
    dateArrivage: string;
    ignoreCount: any;

    // ── Redesign « Affectation finale.dc.html » ──────────────────────────
    /** T-code + intitulé de la DI, pour l'étiquette d'en-tête du modal. */
    diCode: string;
    diTitle: string;
    /** Nom du composant sélectionné (la liste sélectionne par `nameComposant`)
     *  — pilote la surbrillance de la ligne active. */
    selectedName: string | null = null;

    /** Classe portée par l'hôte quand le composant est rendu EN MODAL (magasin)
     *  — permet au SCSS de borner la hauteur au lieu de forcer 100vh (page routée). */
    @HostBinding('class.af-embedded') get _embeddedHost(): boolean {
        return this.embedded;
    }

    constructor(
        private ticketSerice: TicketService,
        private productService: ProductService,
        private route: ActivatedRoute,
        private apollo: Apollo,
        private readonly notificationService: NotificationService,
        private readonly messageservice: MessageService,
        private readonly router: Router,
        private confirmationService: ConfirmationService,
        private readonly mutationRunner: MutationRunner,
    ) {
        this._id = this.route.snapshot.paramMap.get('id');

        this.formUpdateComposant = new FormGroup({
            name: new FormControl(),
            package: new FormControl(),
            category_composant_id: new FormControl(),
            prix_achat: new FormControl(),
            prix_vente: new FormControl(),
            coming_date: new FormControl(),
            link: new FormControl(),
            quantity_stocked: new FormControl(),
            pdf: new FormControl(),
            status: new FormControl(),
        });
    }

    ngOnInit(): void {
        // Modal mode: the DI id arrives via @Input, not the :id route param.
        if (this.diId) {
            this._id = this.diId;
        }
        this.getDiByID(this._id);
        this.productService
            .getProductsSmall()
            .then((cars) => (this.products = cars));
        this.notificationService.notification$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message: any) => {
                console.log('🍻[message]:', message);
                if (message) {
                    this.getDiByID(this._id);
                }
                if (
                    message &&
                    message.array_composants &&
                    message.array_composants.length > 0
                ) {
                    this.componentsAreConfirmed = true;
                }
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    getCompsantInfo(selectedComposant: string) {
        // get the value of current form and affect it to value displayed
        this.apollo
            .query<any>({
                query: this.ticketSerice.composantByName(selectedComposant),
            })
            .subscribe({
                // errorPolicy 'all' (queries) : une erreur GraphQL arrive ici
                // avec `data: null` — garde obligatoire (même TypeError que
                // magasin-di-list ligne 1126 sinon).
                next: ({ data, errors }) => {
                    const composant = data?.findOneComposant;
                    if (!composant) {
                        this.messageservice.add({
                            severity: 'warn',
                            summary: 'Composant introuvable',
                            detail:
                                errors?.[0]?.message ||
                                `Le composant « ${selectedComposant} » n'existe pas dans le catalogue.`,
                        });
                        return;
                    }
                    this.composantValues = composant;
                    this.formUpdateComposant.patchValue({
                        name: composant.name,
                        package: composant.package,
                        category_composant_id: composant.category_composant_id,
                        prix_achat: composant.prix_achat,
                        prix_vente: composant.prix_vente,
                        coming_date: new Date(composant.coming_date),
                        link: composant.link,
                        quantity_stocked: composant.quantity_stocked,
                        pdf: composant.pdf,
                        // Nom réel du champ dans le schéma : `status_composant`
                        // (`status` n'existait pas → statut jamais pré-rempli).
                        status: composant.status_composant,
                    });
                    // Le chargement ne doit pas compter comme une modification :
                    // remet le formulaire à pristine pour piloter la barre de save.
                    this.formUpdateComposant.markAsPristine();
                },
                error: (error) => {
                    this.messageservice.add({
                        severity: 'error',
                        summary: 'Erreur de chargement',
                        detail:
                            error?.message ||
                            'Impossible de charger le composant.',
                    });
                },
            });
    }
    select(data) {
        this.selectedName = data?.nameComposant ?? null;
        this.getCompsantInfo(data.nameComposant);
    }

    getDiByID(_id: string) {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getDiById(_id),
            })
            .subscribe(({ data }) => {
                // Garde null : `data` est null quand la query échoue
                // (errorPolicy 'all') — l'accès direct crashait.
                if (!data?.getDiById?.di) return;
                this.diStatus = data.getDiById.di.status;
                this.ignoreCount = data.getDiById.di.ignoreCount;
                // Étiquette d'en-tête (T-code · intitulé) de la maquette.
                this.diCode = data.getDiById.di._idnum;
                this.diTitle = data.getDiById.di.title;

                if (data) {
                    if (data.getDiById.logsDi) {
                        const filtredLogsDi = data.getDiById.logsDi.find(
                            (el) => el.idIgnore === this.ignoreCount
                        );
                        if (filtredLogsDi) {
                            this.isSentToCoordinator =
                                filtredLogsDi.handleSendingNotificationBetweenCoordinatorAndMagasin;
                            this.componentsAreConfirmed =
                                filtredLogsDi.isConfirmedComponentFromCoordinator;
                            this.composants = filtredLogsDi.array_composants;
                        }
                    } else {
                        console.log('🍕[data]:', data);
                        this.isSentToCoordinator =
                            data.getDiById.di.handleSendingNotificationBetweenCoordinatorAndMagasin;
                        this.componentsAreConfirmed =
                            data.getDiById.di.isConfirmedComponentFromCoordinator;
                        this.composants = data.getDiById.di.array_composants;
                    }
                }
            });
    }

    sentComponentToCoordinatorToConfirm() {
        const id = this._id;
        this.confirmationService.confirm({
            message:
                'Envoyer les composants au coordinateur pour confirmation ?',
            header: 'Envoyer au coordinateur',
            icon: 'pi pi-send',
            accept: async () => {
                try {
                    // Via MutationRunner : anti double-submit (clé), gestion
                    // succès/erreur, loading. `errorToast: null` → on affiche
                    // NOUS-MÊME le message serveur réel dans le catch.
                    await this.mutationRunner.run({
                        key: `sendToCoordinator:${id}`,
                        mutation:
                            this.ticketSerice.sentComponentToCoordinatorToConfirm(
                                id,
                            ),
                        successToast: {
                            summary: 'Envoyé au coordinateur',
                            detail: 'Les composants ont été transmis pour confirmation.',
                        },
                        errorToast: null,
                        onLoading: (v) => (this.isSending = v),
                    });
                    // SUCCÈS uniquement → fermer le modal ; l'hôte rafraîchit la
                    // liste (statut → « En attente confirmation Coordination »).
                    if (this.embedded) {
                        this.closed.emit();
                    } else {
                        this.router.navigate([
                            '/tickets/ticket/magasin-di-list',
                        ]);
                    }
                } catch (err: any) {
                    // Double-clic verrouillé par la clé → ignore silencieusement.
                    if (err?.message === 'mutation-in-flight') return;
                    // ÉCHEC → toast avec le message serveur réel ; le modal RESTE
                    // ouvert (pas de fermeture aveugle).
                    this.messageservice.add({
                        severity: 'error',
                        summary: 'Erreur',
                        detail:
                            err?.message ||
                            "Échec de l'envoi au coordinateur. Réessayez.",
                    });
                }
            },
        });
    }

    changeStatusDiToPending2(_id: string) {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.changeStatusDiToPending2(_id),
            })
            .valueChanges.subscribe(() => {});
    }
    updateComposant() {
        this.apollo
            .mutate<UpdateComposantMutationResponse>({
                mutation: this.ticketSerice.updateComposant(
                    this.formUpdateComposant.value
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data }) => {
                if (data) {
                     this.messageservice.add({
                                    severity: 'info',
                                    summary: 'Enregistrer',
                                    detail: 'Les changements on été enregistrer',
                                });
                    console.log('🥐[data]:', data);
                    // Update composantValues with the latest form values
                    Object.assign(
                        this.composantValues,
                        this.formUpdateComposant.value
                    );
                    console.log(
                        '🥒[   this.composantValues]:',
                        this.composantValues
                    );
                    // this.changeStatusDiToPending2(this.selectedDi_id);
                    this.isActive = false;
                    // Repasse le formulaire à pristine → barre de save au repos
                    // (la mise à jour des composants reste facultative).
                    this.formUpdateComposant.markAsPristine();
                }
            });
    }

    changeStatusPending3() {
        this.confirmationService.confirm({
            message: 'Voulez-vous confirmer les changements',
            header: 'Confirmation Liste des composants',
            icon: 'pi pi-question-circle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.changeStatusPending3(
                            this._id
                        ),
                    })
                    .subscribe(({ data }) => {
                        if (data) {
                            // Embedded in the magasin modal → close it (host
                            // refreshes the list). Routed page → navigate back.
                            if (this.embedded) {
                                this.closed.emit();
                            } else {
                                this.router.navigate([
                                    '/tickets/ticket/magasin-di-list',
                                ]);
                            }
                        }
                    });
            },
        });
    }

    /** Ferme le modal (X d'en-tête, mode embarqué). L'hôte fait
     *  `detailsComposantModal = false; loadData()`. */
    closeModal(): void {
        this.closed.emit();
    }

    // ── Dérivés d'affichage (« Affectation finale ») ──────────────────────
    /** Nombre de composants de la liste. */
    get totalCount(): number {
        return this.composants?.length || 0;
    }
    /** Le formulaire porte des modifications non enregistrées (save FACULTATIF). */
    get formDirty(): boolean {
        return this.formUpdateComposant.dirty;
    }

    /** Marge = (vente − achat) / vente, en %. Négatif = vente sous le coût. */
    get selMarge(): { label: string; good: boolean } {
        const achat =
            Number(this.formUpdateComposant.get('prix_achat')?.value) || 0;
        const vente =
            Number(this.formUpdateComposant.get('prix_vente')?.value) || 0;
        const marge = vente > 0 ? Math.round(((vente - achat) / vente) * 100) : 0;
        return { label: (marge >= 0 ? '+' : '') + marge + ' %', good: marge >= 0 };
    }

    /** État de stock : Rupture (≤0) / Faible (≤5) / En stock. */
    stockInfo(qty: any): { label: string; cls: 'danger' | 'warn' | 'ok' } {
        const q = Number(qty) || 0;
        if (q <= 0) return { label: 'Rupture', cls: 'danger' };
        if (q <= 5) return { label: 'Faible', cls: 'warn' };
        return { label: 'En stock', cls: 'ok' };
    }
    get selStockInfo(): { label: string; cls: 'danger' | 'warn' | 'ok' } {
        return this.stockInfo(
            this.formUpdateComposant.get('quantity_stocked')?.value,
        );
    }

    // ── Handshake v2 : boutons pilotés par le STATUT (source de vérité) ──
    // Legacy INMAGASIN/CONFIRMATION_COMPOSANTS tolérés (DI pré-migration). Le
    // flag `componentsAreConfirmed` sert de FILET pour les DI en RETOUR
    // (ignoreCount > 0) : le back y avance les flags du logsDi et NON `di.status`
    // (cohabitation), donc le statut ne passe jamais à MAGASIN_FINALISATION —
    // sans ce filet, « Terminer » n'apparaîtrait jamais sur une DI renvoyée.
    /** Étape 1 — magasin prépare la liste → bouton « Envoyer au coordinateur ».
     *  Masqué dès que la coordination a confirmé (évite les deux boutons à la
     *  fois sur une DI en retour dont le statut reste en préparation). */
    get isPreparation(): boolean {
        const prep =
            this.diStatus === 'CONFIRMATION' || this.diStatus === 'PROCESSING';
        return prep && !this.componentsAreConfirmed;
    }
    /** Étape 2 — envoyé, en attente de la confirmation de la coordination. */
    get isAwaitingCoordination(): boolean {
        if (this.componentsAreConfirmed) return false;
        return (
            this.diStatus === 'ATTENTE_CONFIRMATION_COORDINATION' ||
            this.diStatus === 'CONFIRMATION_COMPOSANTS'
        );
    }
    /** Étape 3 — coordination a confirmé → retour magasin. C'est ICI que
     *  « Terminer les composants » redevient cliquable. Statut MAGASIN_FINALISATION
     *  (flux normal) OU flag `componentsAreConfirmed` (filet DI en retour). */
    get isFinalisation(): boolean {
        return (
            this.diStatus === 'MAGASIN_FINALISATION' ||
            this.componentsAreConfirmed === true
        );
    }

    /** Ligne de statut du footer — dérivée du STATUT réel de la DI. */
    get batchStatus(): { text: string; tone: 'ok' | 'info' | 'idle'; char: string } {
        if (this.isFinalisation)
            return {
                text: 'Composants confirmés — vous pouvez terminer la liste.',
                tone: 'ok',
                char: '✓',
            };
        if (this.isAwaitingCoordination)
            return {
                text: 'Envoyé — en attente de la confirmation de la coordination.',
                tone: 'info',
                char: '!',
            };
        return {
            text: 'Préparez la liste, puis envoyez-la au coordinateur.',
            tone: 'idle',
            char: 'i',
        };
    }

    // map over the array of composant existed in tickets data
    // get composant data by id to update them
    //*******THESE APIs ARE ALREADY IMPLMENNTED IN TICKET COMPONENT YOU JUES NEED TO CHANGE THE PLACE */
    // when btn EDIT click show inputs with value
    // when click save or cancel hide input if save get these data from the form
}
