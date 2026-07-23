import { Component, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { TicketService } from 'src/app/demo/service/ticket.service';
import { MutationRunner } from 'src/app/demo/service/mutation-runner.service';
import {
    ComposantByNameQueryResponse,
    GetAllMagasinQueryResponse,
} from './magasin-di-list.interfaces';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PageEvent } from '../../profile/profile-list/profile-list.interfaces';
import { NotificationService } from 'src/app/demo/service/notification.service';
import { environment } from 'src/environments/environment';
import { Subject } from 'rxjs';
import { debounceTime, finalize, takeUntil } from 'rxjs/operators';
import {
    formatTableValue,
    isLocationColumn,
    isEmplacementVide as isEmplacementVideUtil,
    trackByColumn,
} from '../table-display.utils';

@Component({
    selector: 'app-magasin-di-list',
    templateUrl: './magasin-di-list.component.html',
    styleUrl: './magasin-di-list.component.scss',
})
export class MagasinDiListComponent implements OnDestroy {
    // Search state tracking
    private currentSearchField: string = '';
    private currentSearchValue: string = '';
    private searchSubject$ = new Subject<void>();
    private destroy$ = new Subject<void>();
    private lastSearchKey = '';

    baseUrl = environment.apiUrl;

    /** Resolve a stored doc reference into an openable href: Drive uploads store
     *  an absolute webViewLink (opened as-is); legacy values get the API root. */
    docHref(value?: string | null): string {
        if (!value) return '';
        return /^https?:\/\//i.test(value) || value.startsWith('data:')
            ? value
            : this.baseUrl + value;
    }

    statusComposant = [
        { name: 'En stock', value: 'En stock' },
        { name: 'Interne', value: 'Interne' },
        { name: 'Externe', value: 'Externe' },
    ];
    formUpdateComposant: FormGroup;
    magasinDiDialog: boolean = false;
    selectedComposant;
    cols = [
        { field: '_idnum', header: 'ID', searchKey: '_id' },
        { field: 'title', header: 'Title', searchKey: 'title' },
        { field: 'status', header: 'Status', searchKey: 'status' },
    ];

    diList: any;
    diListCount: any;
    formMagasin = new FormGroup({
        composant: new FormControl(),
    });
    isLoading: boolean = true;
    arrayComposant: any;
    selectedItem: any;
    loadedDataComposant: any;
    selectedDi_id: any;
    selectedstatusComposant: string;
    openCreationComposantModal: boolean;
    payloadImage: { image: string };
    first: number = 0;
    rows: number = 10;
    page: any;

    composantMagasin = new FormGroup({
        _id: new FormControl(),
        name: new FormControl(),
        packageComposant: new FormControl(),
        category_composant_id: new FormControl(),
        link: new FormControl(),
        pdf: new FormControl(),
        quantity_stocked: new FormControl(),
        status: new FormControl(),
        prix_vente: new FormControl(),
        coming_date: new FormControl(),
        prix_achat: new FormControl(),
    });
    composantList: any;
    isToUpdate: boolean = false;
    basicOptions: {
        plugins: { legend: { labels: { color: string } } };
        scales: {
            y: {
                beginAtZero: boolean;
                ticks: {
                    color: string;
                    stepSize: number;
                    callback: (value: number) => string;
                };
                grid: { color: string; drawBorder: boolean };
            };
            x: {
                ticks: { color: string };
                grid: { color: string; drawBorder: boolean };
            };
        };
    };
    statusCount: any;
    basicData: {
        labels: any;
        datasets: {
            label: string;
            data: any;
            backgroundColor: string[];
            borderColor: string[];
            borderWidth: number;
        }[];
    };
    nameComposananrSelected: any;
    ignoreCount: any;
    categorieDiListDropDown: any;
    composantCategory: any;
    openCreationCategoryComposantModal: boolean = false;
    addCategoryCompsant = new FormGroup({
        categoryName: new FormControl(null, Validators.required),
    });
    instantSelectedcPDF: string;
    payload: { file: string } = { file: '' };
    pdfAdded: any;
    isPdfPreparing: boolean = false;
    preparingPdfName: string = '';
    validerComposantValidtor: boolean = true;
    validatorFinirListeComposant: boolean = true;
    composantCatgorieList: any;

    // ── Master-detail « Affectation des composants » ──────────────────────
    /** DI `_idnum` shown after the modal title (« — {code DI} »). */
    selectedDiCode: string = '';
    /** The requested line currently loaded in the right-hand detail form. */
    activeLine: any = null;
    /** Freshly chosen PDF (drag & drop zone) for the active component, if any. */
    pdfFile: File | null = null;
    /**
     * TODO(stock-policy): the `Composant` entity has NO per-component reorder
     * threshold (`seuilReappro`) yet — see backend `composant.entity.ts`. Until
     * one exists, `stockHealth`'s low/ok boundary falls back to this constant.
     * Make it configurable / move it server-side when the field is added.
     */
    readonly SEUIL_REAPPRO_DEFAUT = 5;
    /**
     * TODO(stock-policy): out-of-stock validation policy = "back-order" (product
     * decision 2026-06-11). Validation stays allowed even at stock 0. Flip to
     * false to BLOCK validation when `quantity_stocked < qtyDemandee`, or
     * implement line-splitting, when the policy changes.
     */
    readonly allowValidateWhenOutOfStock = true;
    private readonly CATEGORY_PALETTES: Array<'a' | 'b' | 'c'> = ['a', 'b', 'c'];
    colCategoryComposants = [
        { field: 'category_composant', header: 'Category Composant' },
    ];

    constructor(
        private ticketSerice: TicketService,
        private readonly messageservice: MessageService,
        private apollo: Apollo,
        private router: Router,
        private confirmationService: ConfirmationService,
        private notificationService: NotificationService,
        private readonly mutationRunner: MutationRunner,
    ) {
        this.formUpdateComposant = new FormGroup({
            _id: new FormControl(null),
            name: new FormControl(null, Validators.required),
            package: new FormControl(null, Validators.required),
            category_composant_id: new FormControl(null, Validators.required),
            prix_achat: new FormControl(null, Validators.required),
            prix_vente: new FormControl(null, Validators.required),
            coming_date: new FormControl(null, Validators.required),
            // OPTIONNEL : forcer un lien poussait les utilisateurs à coller
            // n'importe quelle URL (ex. celle de la page) pour passer la
            // validation — valeur absurde ensuite persistée en base.
            link: new FormControl(null),
            quantity_stocked: new FormControl(null, Validators.required),
            pdf: new FormControl(null),
            status: new FormControl(null, Validators.required),
        });
    }

    /**
     * Message d'erreur réel d'une réponse GraphQL, pour les toasts.
     * Accepte les deux formes rencontrées ici : le tableau `errors` livré
     * dans `next` (queries — errorPolicy 'all') et l'ApolloError du callback
     * `error` (mutations / erreurs réseau).
     */
    private errorDetail(source: any, fallback: string): string {
        if (Array.isArray(source)) {
            return source[0]?.message || fallback;
        }
        return (
            source?.graphQLErrors?.[0]?.message ||
            source?.networkError?.message ||
            source?.message ||
            fallback
        );
    }

    /** Toast d'erreur unique + déblocage de l'overlay, pour tous les flux. */
    private failWithToast(summary: string, source: any, fallback: string) {
        this.isLoading = false;
        this.messageservice.add({
            severity: 'error',
            summary,
            detail: this.errorDetail(source, fallback),
        });
    }

    /**
     * Les anciennes sauvegardes stockaient le LIBELLÉ de la catégorie dans
     * `category_composant_id` (bug `optionValue` — voir dropdowns Catégorie).
     * Traduit un libellé hérité vers l'_id attendu ; laisse passer les _id
     * valides ; null si la valeur ne correspond à rien (catégorie supprimée)
     * pour forcer un re-choix explicite plutôt qu'une re-sauvegarde polluée.
     */
    private normalizeCategoryId(stored: string | null): string | null {
        if (!stored) return null;
        const options: Array<{ name: string; value: string }> =
            this.composantCategory || [];
        if (!options.length) return stored; // liste pas encore chargée
        if (options.some((o) => o.value === stored)) return stored;
        const byLabel = options.find((o) => o.name === stored);
        return byLabel ? byLabel.value : null;
    }

    ngOnInit() {
        console.log('init magasin di list');
        // Initial load
        this.loadData();
        this.getAllComposant();
        this.getStatusCount();

        // Setup search with debounce
        this.searchSubject$
            .pipe(debounceTime(400), takeUntil(this.destroy$))
            .subscribe(() => {
                this.loadData();
            });

        this.notificationService.blAdded$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message: any) => {
                console.log('from app component BBBLLLLL', message);

                this.messageservice.add({
                    severity: 'success',
                    summary: `New BL - ${message.message.di._idnum}`,
                    detail: `${message.message.di.title}`,
                    sticky: true,
                });
                setTimeout(() => {
                    this.loadData();
                }, 1000);
            });

        this.notificationService.componentConfirmedByCoordinator$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message: any) => {
                console.log('Should display in magasin di list', message);

                this.messageservice.add({
                    severity: 'success',
                    summary: 'Components Confirmed',
                    detail: `All components for DI #${message.message._id} have been successfully confirmed by the coordinator.`,
                    sticky: true,
                });

                setTimeout(() => {
                    this.loadData();
                }, 1000);
            });

        this.notificationService.notification$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message: any) => {
                if (message) {
                    this.loadData();
                    this.getStatusCount();
                }
            });

        this.formUpdateComposant.statusChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe((susb) => {
                console.log('🎂susb', susb);
                console.log(this.formUpdateComposant, 'form composants');
            });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Centralized data loading method
     * Handles both search and regular data fetching with pagination
     */
    loadData() {
        this.isLoading = true;

        const hasActiveSearch =
            this.currentSearchField &&
            this.currentSearchValue &&
            this.currentSearchValue.trim().length > 0;

        if (hasActiveSearch) {
            // Perform search
            this.apollo
                .query<any>({
                    query: this.ticketSerice.getAllMagasinSearch(
                        this.first,
                        this.rows,
                        this.currentSearchField,
                        this.currentSearchValue,
                    ),
                    fetchPolicy: 'no-cache',
                })
                .pipe(finalize(() => (this.isLoading = false)))
                .subscribe({
                    next: ({ data }) => {
                        if (data && data.searchDiForMagasin) {
                            this.diList = data.searchDiForMagasin.di;
                            this.diListCount =
                                data.searchDiForMagasin.totalDiCount;
                        }
                    },
                    error: (error) => {
                        this.failWithToast(
                            'Erreur de recherche',
                            error,
                            'La recherche a échoué. Réessayez.',
                        );
                    },
                });
        } else {
            // Regular data fetch
            this.apollo
                .query<GetAllMagasinQueryResponse>({
                    query: this.ticketSerice.getAllMagasin(
                        this.first,
                        this.rows,
                    ),
                    fetchPolicy: 'no-cache',
                })
                .pipe(finalize(() => (this.isLoading = false)))
                .subscribe({
                    next: ({ data }) => {
                        if (data?.getDiForMagasin) {
                            this.diList = data.getDiForMagasin.di;
                            this.diListCount =
                                data.getDiForMagasin.totalDiCount;
                        }
                    },
                    error: (error) => {
                        this.failWithToast(
                            'Erreur de chargement',
                            error,
                            'Impossible de charger la liste des DI.',
                        );
                    },
                });
        }
    }

    /**
     * Handle column search
     */
    onColumnSearch(field: string, value: string) {
        const v = value?.trim();
        const f = field?.trim();
        const searchKey = `${f || ''}:${v || ''}`;

        if (searchKey === this.lastSearchKey) {
            return;
        }

        this.lastSearchKey = searchKey;

        if (v && v.length > 0 && f && f.length > 0) {
            // Set search state
            this.currentSearchField = f;
            this.currentSearchValue = v;
            this.first = 0; // Reset to first page on new search

            // Trigger search
            this.searchSubject$.next();
        } else {
            // Clear search state
            this.currentSearchField = '';
            this.currentSearchValue = '';

            // Load regular data
            this.loadData();
        }
    }

    formatCell(row: any, field: string): string {
        return formatTableValue(row, field);
    }

    isLocationCell(field: string): boolean {
        return isLocationColumn(field);
    }

    /** Point LOCATION : emplacement vide → vert, renseigné → rouge. */
    isEmplacementVide(row: any, field: string): boolean {
        return isEmplacementVideUtil(row, field);
    }

    trackByColumn = trackByColumn;

    onComposantFilter(event: any) {
        const searchValue = event.filter?.trim();

        if (searchValue && searchValue.length >= 2) {
            // Implement composant search if needed
        }
    }

    allCategoryDi() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getAllDiCategory(),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.categorieDiListDropDown = data.findAllDiCategory.map(
                        (categoryDi) => ({
                            name: `${categoryDi.category}`,
                            value: categoryDi._id,
                        }),
                    );
                }
            });
    }

    getStatusCount() {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');
        const textColorSecondary = documentStyle.getPropertyValue(
            '--text-color-secondary',
        );
        const surfaceBorder =
            documentStyle.getPropertyValue('--surface-border');
        this.apollo
            .query<any>({
                query: this.ticketSerice.getStatusCount(),
            })
            .subscribe(({ data, loading, errors }) => {
                this.isLoading = loading;
                if (errors?.length) {
                    console.error('getStatusCount errors:', errors);
                    return;
                }
                if (data?.getStatusCount) {
                    this.statusCount = data.getStatusCount;
                    this.basicData = {
                        labels: this.statusCount.map((el) => el.status),
                        datasets: [
                            {
                                label: 'Di',
                                data: this.statusCount.map((el) => el.count),
                                backgroundColor: [
                                    'rgba(255, 159, 64, 0.2)',
                                    'rgba(75, 192, 192, 0.2)',
                                    'rgba(54, 162, 235, 0.2)',
                                    'rgba(153, 102, 255, 0.2)',
                                ],
                                borderColor: [
                                    'rgb(255, 159, 64)',
                                    'rgb(75, 192, 192)',
                                    'rgb(54, 162, 235)',
                                    'rgb(153, 102, 255)',
                                ],
                                borderWidth: 1,
                            },
                        ],
                    };
                    this.basicOptions = {
                        plugins: {
                            legend: {
                                labels: {
                                    color: textColor,
                                },
                            },
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: textColorSecondary,
                                    stepSize: 1,
                                    callback: (value: number) =>
                                        value.toFixed(0),
                                },
                                grid: {
                                    color: surfaceBorder,
                                    drawBorder: false,
                                },
                            },
                            x: {
                                ticks: {
                                    color: textColorSecondary,
                                },
                                grid: {
                                    color: surfaceBorder,
                                    drawBorder: false,
                                },
                            },
                        },
                    };
                }
            });
        // NB : erreurs réseau non toastées ici (le graphe est décoratif) ;
        // le spinner est déjà relâché par les autres flux de la page.
    }

    annulerMagasinEstimation() {
        this.magasinDiDialog = false;
        this.openCreationComposantModal = false;
        this.formMagasin.reset();
        this.composantMagasin.reset();
    }

    showDialogcomposantCreation() {
        this.openCreationComposantModal = true;
        this.findAllComposant_Category();
    }

    getSeverity(status: string) {
        switch (status) {
            case 'CREATED':
                return 'success';
            case 'PENDING1':
            case 'PENDING2':
            case 'PENDING3':
                return 'help';
            case 'DIAGNOSTIC':
            case 'INDIAGNOSTIC':
                return 'info';
            case 'INMAGASIN':
            case 'MagasinEstimation':
                return 'warning';
            case 'PRICING':
                return 'warning';
            case 'NEGOTIATION1':
            case 'NEGOTIATION2':
                return 'warning';
            case 'REPARATION':
            case 'INREPARATION':
                return 'info';
            case 'FINISHED':
                return 'success';
            case 'ANNULER':
                return 'contrast';
            case 'RETOUR1':
            case 'RETOUR2':
            case 'RETOUR3':
                return 'danger';
            default:
                return 'warn';
        }
    }

    /**
     * Recharge les catégories partout où elles sont affichées : la table du
     * dialog de gestion (`composantCatgorieList`) ET les options des dropdowns
     * (`composantCategory`, via `findAllComposant_Category`). Avant, une
     * catégorie créée n'apparaissait pas dans les dropdowns tant que le modal
     * n'était pas rouvert.
     */
    private refreshCategoryLists() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.findAllComposant_Category(),
            })
            .subscribe({
                next: ({ data, loading }) => {
                    this.isLoading = loading;
                    const categories = data?.findAllComposant_Category;
                    if (!categories) return;
                    // Table du dialog de gestion (lignes brutes).
                    this.composantCatgorieList = categories;
                    // Options des dropdowns : value = _id, name = libellé
                    // (même contrat que `findAllComposant_Category()`).
                    this.composantCategory = categories.map((el) => ({
                        name: el.category_composant,
                        value: el._id,
                    }));
                },
                error: (error) => {
                    this.failWithToast(
                        'Erreur de chargement',
                        error,
                        'Impossible de recharger les catégories.',
                    );
                },
            });
    }

    showDialogCategoryComposant() {
        this.openCreationCategoryComposantModal = true;
        this.refreshCategoryLists();
    }

    deletComposant() {
        if (!this.loadedDataComposant?._id) {
            this.messageservice.add({
                severity: 'warn',
                summary: 'Aucun composant',
                detail: 'Sélectionnez d’abord un composant à supprimer.',
            });
            return;
        }

        this.confirmationService.confirm({
            message: 'Voulez-vous Supprimer ce composant ?',
            header: 'Confirmation Suppression',
            icon: 'pi pi-exclamation-triangle',
            accept: async () => {
                try {
                    await this.mutationRunner.run({
                        key: `removeComposant:${this.loadedDataComposant._id}`,
                        mutation: this.ticketSerice.removeComposant(
                            this.loadedDataComposant._id,
                        ),
                        successToast: {
                            summary: 'Composant supprimé',
                            detail: this.loadedDataComposant.name || '',
                        },
                        errorToast: {
                            summary: 'Erreur',
                            detail: 'Suppression impossible. Réessayez.',
                        },
                        onLoading: (v) => (this.isLoading = v),
                    });
                    // L'ancien code relançait getAllComposant mais lisait
                    // `data.findAllComposant_Category` (inexistant sur cette
                    // query) — refresh explicite des deux listes à la place.
                    this.getAllComposant();
                    this.refreshCategoryLists();
                } catch {
                    /* toast déjà affiché par le runner */
                }
            },
        });
    }

    deleteCategorycomposant(rowData) {
        this.confirmationService.confirm({
            message: 'Voulez-vous Supprimer cette categorie ?',
            header: 'Confirmation Suppression',
            icon: 'pi pi-exclamation-triangle',
            accept: async () => {
                try {
                    await this.mutationRunner.run({
                        key: `removeComposantCategory:${rowData._id}`,
                        mutation: this.ticketSerice.removeComposant_Category(
                            rowData._id,
                        ),
                        successToast: {
                            summary: 'Catégorie supprimée',
                            detail: rowData.category_composant || '',
                        },
                        errorToast: {
                            summary: 'Erreur',
                            detail: 'Suppression impossible. Réessayez.',
                        },
                        onLoading: (v) => (this.isLoading = v),
                    });
                    this.refreshCategoryLists();
                } catch {
                    /* toast déjà affiché par le runner */
                }
            },
        });
    }

    addNewCategoryComposant() {
        const categoryName = this.addCategoryCompsant.value.categoryName;
        if (!categoryName?.trim()) {
            this.addCategoryCompsant.markAllAsTouched();
            return;
        }
        this.confirmationService.confirm({
            message: 'Voulez-vous créer cette categorie ?',
            header: 'Confirmation Creation',
            icon: 'pi pi-exclamation-triangle',
            accept: async () => {
                try {
                    await this.mutationRunner.run({
                        key: 'addComposantCategory',
                        mutation:
                            this.ticketSerice.addNewCategoryComposant(
                                categoryName,
                            ),
                        successToast: {
                            summary: 'Catégorie créée',
                            detail: categoryName,
                        },
                        errorToast: {
                            summary: 'Erreur',
                            detail: 'Création impossible. Réessayez.',
                        },
                        onLoading: (v) => (this.isLoading = v),
                    });
                    this.addCategoryCompsant.reset();
                    this.refreshCategoryLists();
                } catch {
                    /* toast déjà affiché par le runner */
                }
            },
        });
    }

    onPdfSelect(event: any, type: string) {
        if (type !== 'cPDF') {
            return;
        }

        this.isPdfPreparing = true;
        this.preparingPdfName = event?.files?.[0]?.name || 'PDF';
    }

    onPdfUploadError(type: string) {
        if (type !== 'cPDF') {
            return;
        }

        this.isPdfPreparing = false;
        this.preparingPdfName = '';
        this.messageservice.add({
            severity: 'error',
            summary: 'PDF non chargé',
            detail: 'Le fichier PDF n’a pas pu être préparé.',
        });
    }

    onUpload(event: any, type: string) {
        console.log('fired pdf composant');
        for (let file of event.files) {
            const isAffectationPdf = type === 'cPDF';
            if (isAffectationPdf) {
                this.isPdfPreparing = true;
                this.preparingPdfName = file?.name || 'PDF';
            }

            let previewReady = false;
            let payloadReady = false;
            const finishPreparing = () => {
                if (!isAffectationPdf || !previewReady || !payloadReady) {
                    return;
                }

                this.isPdfPreparing = false;
                this.preparingPdfName = '';
            };

            const reader = new FileReader();
            reader.readAsArrayBuffer(file);
            const readerForBase64 = new FileReader();
            readerForBase64.readAsDataURL(file);

            reader.onload = () => {
                const arrayBuffer = reader.result as ArrayBuffer;

                const blob = new Blob([arrayBuffer], {
                    type: 'application/pdf',
                });
                const blobUrl = URL.createObjectURL(blob);

                if (type === 'cPDF') {
                    this.instantSelectedcPDF = blobUrl;
                    console.log(
                        '🥕[this.instantSelectedcPDF]:',
                        this.instantSelectedcPDF,
                    );
                }
                if (type === 'addComposant') {
                    this.instantSelectedcPDF = blobUrl;
                    console.log('🍈[blobUrl]:', blobUrl);
                    console.log(
                        '🥕[this.instantSelectedcPDF]:',
                        this.instantSelectedcPDF,
                    );
                }

                this.messageservice.add({
                    severity: 'info',
                    summary: 'Fichier enregistré',
                    detail: 'Fichier a été ajouté avec succès',
                });
                previewReady = true;
                finishPreparing();
            };

            readerForBase64.onload = () => {
                const base64 = readerForBase64.result as string;
                this.uploadFile(base64, type);
                payloadReady = true;
                finishPreparing();
            };

            reader.onerror = (error) => {
                console.error('PDF preview conversion error:', error);
                this.onPdfUploadError(type);
            };

            readerForBase64.onerror = (error) => {
                console.error('Base64 conversion error:', error);
                this.onPdfUploadError(type);
            };
        }
    }

    selectedDropDownComposant(selectedItem) {
        this.isToUpdate = true;
        this.selectedItem = selectedItem;

        if (selectedItem.value) {
            this.apollo
                .query<ComposantByNameQueryResponse>({
                    query: this.ticketSerice.composantByName(
                        selectedItem.value,
                    ),
                })
                .subscribe({
                    // errorPolicy 'all' : erreurs GraphQL livrées dans `next`
                    // avec `data: null` — garde obligatoire.
                    next: ({ data, errors, loading }) => {
                        this.isLoading = loading;
                        const composant = data?.findOneComposant;
                        if (!composant) {
                            this.loadedDataComposant = null;
                            this.composantMagasin.reset();
                            this.messageservice.add({
                                severity: 'warn',
                                summary: 'Composant introuvable',
                                detail: this.errorDetail(
                                    errors,
                                    `Le composant « ${selectedItem.value} » n'existe pas dans le catalogue de cette base.`,
                                ),
                            });
                            return;
                        }
                        this.loadedDataComposant = composant;
                        this.composantMagasin.patchValue({
                            _id: composant._id,
                            name: composant.name,
                            packageComposant: composant.package,
                            category_composant_id: this.normalizeCategoryId(
                                composant.category_composant_id,
                            ),
                            prix_achat: composant.prix_achat,
                            prix_vente: composant.prix_vente,
                            coming_date: new Date(composant.coming_date),
                            link: composant.link,
                            quantity_stocked: composant.quantity_stocked,
                            pdf: composant.pdf,
                            status: composant.status_composant,
                        });
                    },
                    error: (error) => {
                        this.failWithToast(
                            'Erreur de chargement',
                            error,
                            'Impossible de charger le composant. Réessayez.',
                        );
                    },
                });
        }

        if (!selectedItem.value) {
            this.composantMagasin.reset();
        }
    }

    openDialogMagasin(item) {
        this.findAllComposant_Category();

        this.selectedDi_id = item._id;
        this.selectedDiCode = item._idnum || '';
        this.ignoreCount = item.ignoreCount;
        // Reset the master-detail state for a clean open.
        this.activeLine = null;
        this.selectedItem = null;
        this.nameComposananrSelected = null;
        this.pdfFile = null;
        this.payload = { file: '' };
        this.formUpdateComposant.reset();

        // Map a raw DI/logs component line into a card view-model. Unlike the
        // legacy dropdown (which dropped already-validated lines via
        // `isUpdated === false`), the master-detail KEEPS them so they render
        // greyed with a « ✓ Validé » pill and feed the progress count.
        const mapLine = (el: any) => ({
            infoComposant: el.nameComposant + ': ' + el.quantity,
            nameComposant: el.nameComposant,
            quantity: el.quantity,
            validated: el.isUpdated === true,
        });

        if (item && item.ignoreCount && item.ignoreCount > 0) {
            this.apollo
                .query<any>({
                    query: this.ticketSerice.getLogsDiById(
                        item.ignoreCount,
                        item._id,
                    ),
                })
                .subscribe({
                    next: ({ data, loading }) => {
                        this.isLoading = loading;
                        const logsDi = data?.getLigsById;
                        this.arrayComposant = (
                            logsDi?.array_composants || []
                        ).map(mapLine);
                        this.afterLinesLoaded();
                    },
                    error: (error) => {
                        this.arrayComposant = [];
                        this.failWithToast(
                            'Erreur de chargement',
                            error,
                            'Impossible de charger les composants demandés.',
                        );
                    },
                });
        } else {
            this.arrayComposant = (item.array_composants || []).map(mapLine);
            this.afterLinesLoaded();
        }
        this.magasinDiDialog = true;
    }

    /** After the requested lines arrive: gate « Terminer » and auto-open the
     *  first pending component in the detail pane. */
    private afterLinesLoaded(): void {
        this.validatorFinirListeComposant = !this.allValidated;
        this.advanceToNextUnvalidated();
    }

    // ── Master-detail helpers ─────────────────────────────────────────────

    get totalLines(): number {
        return (this.arrayComposant || []).length;
    }
    get validatedLines(): number {
        return (this.arrayComposant || []).filter((l: any) => l.validated)
            .length;
    }
    /** True when every requested line is validated (vacuously true if none). */
    get allValidated(): boolean {
        return this.validatedLines === this.totalLines;
    }
    get progressPct(): number {
        return this.totalLines
            ? Math.round((this.validatedLines / this.totalLines) * 100)
            : 0;
    }

    /** Demanded quantity for a requested line. */
    qtyOf(line: any): number {
        return Number(line?.quantity ?? 0) || 0;
    }

    /**
     * Current stock for a line. The ACTIVE line reflects live edits in the
     * detail form (so the badge/banner recompute as the user types); the others
     * use the catalog snapshot from `getAllComposant()`.
     */
    stockOf(line: any): number {
        if (!line) return 0;
        if (this.activeLine && line === this.activeLine) {
            const v = this.formUpdateComposant.get('quantity_stocked')?.value;
            if (v !== null && v !== undefined && v !== '') {
                return Number(v) || 0;
            }
        }
        const cat = (this.composantList || []).find(
            (c: any) => c.name === line.nameComposant,
        );
        return Number(cat?.quantity_stocked ?? 0) || 0;
    }

    /** ok / low / out — low/ok boundary uses SEUIL_REAPPRO_DEFAUT (see TODO). */
    stockHealthOf(line: any): 'ok' | 'low' | 'out' {
        const s = this.stockOf(line);
        if (s <= 0) return 'out';
        if (s < this.SEUIL_REAPPRO_DEFAUT) return 'low';
        return 'ok';
    }
    stockBadgeLabel(line: any): string {
        const s = this.stockOf(line);
        switch (this.stockHealthOf(line)) {
            case 'out':
                return 'Rupture · ' + s;
            case 'low':
                return 'Stock faible · ' + s;
            default:
                return 'En stock · ' + s;
        }
    }

    /** disponible / partiel / indisponible — stock vs demanded quantity. */
    availabilityOf(line: any): 'disponible' | 'partiel' | 'indisponible' {
        const s = this.stockOf(line);
        const q = this.qtyOf(line);
        if (s <= 0) return 'indisponible';
        if (s < q) return 'partiel';
        return 'disponible';
    }

    /** Two-letter initials for a component avatar. */
    initialsOf(name: string): string {
        if (!name) return '?';
        const parts = String(name)
            .trim()
            .split(/[\s\-_./]+/)
            .filter(Boolean);
        const a = parts[0]?.[0] ?? '';
        const b = parts[1]?.[0] ?? parts[0]?.[1] ?? '';
        return (a + b).toUpperCase() || '?';
    }

    /**
     * Stable A/B/C avatar palette. The DI/logs lines and the catalog list don't
     * carry `category_composant_id`, so we bucket deterministically by name —
     * same component always gets the same colour.
     */
    paletteOf(line: any): 'a' | 'b' | 'c' {
        const name = String(line?.nameComposant ?? '');
        let h = 0;
        for (let i = 0; i < name.length; i++) {
            h = (h * 31 + name.charCodeAt(i)) >>> 0;
        }
        return this.CATEGORY_PALETTES[h % 3];
    }

    /** Load a requested line into the detail form (greyed/validated cards are
     *  non-cliquable). Reuses the existing fetch+patch in `selectedDropDown`. */
    selectLine(line: any): void {
        if (!line || line.validated) return;
        this.activeLine = line;
        // Switching components drops any pending (unsaved) PDF + staged base64.
        this.pdfFile = null;
        this.payload = { file: '' };
        this.selectedDropDown({ value: line.nameComposant });
    }

    /**
     * A PDF was chosen in the dropzone: stage it for the active component.
     * Reuses the EXISTING upload pipeline (`onUpload` → base64 → `payload.file`)
     * so the save mutation keeps sending the PDF exactly as before, and mirrors
     * the file name onto the `pdf` form control.
     */
    onPdfFileSelected(file: File): void {
        this.pdfFile = file;
        this.onUpload({ files: [file] }, 'cPDF');
        this.formUpdateComposant.patchValue({ pdf: file.name });
        this.formUpdateComposant.get('pdf')?.markAsDirty();
    }

    /** The dropzone was cleared: drop the staged PDF + control value. */
    onPdfFileRemoved(): void {
        this.pdfFile = null;
        this.payload = { file: '' };
        this.instantSelectedcPDF = '';
        this.pdfAdded = null;
        this.formUpdateComposant.patchValue({ pdf: null });
        this.formUpdateComposant.get('pdf')?.markAsDirty();
    }

    /** Select the first still-pending line, or clear the detail when done. */
    private advanceToNextUnvalidated(): void {
        const next = (this.arrayComposant || []).find(
            (l: any) => !l.validated,
        );
        if (next) {
            this.selectLine(next);
        } else {
            this.activeLine = null;
        }
    }

    /** True when the active line can be validated (form complete; back-order
     *  allowed per policy — see `allowValidateWhenOutOfStock`). */
    get canValidateActive(): boolean {
        if (!this.activeLine || this.activeLine.validated) return false;
        if (this.formUpdateComposant.invalid) return false;
        if (
            !this.allowValidateWhenOutOfStock &&
            this.availabilityOf(this.activeLine) !== 'disponible'
        ) {
            return false;
        }
        return true;
    }

    /**
     * « Valider ce composant » — persists the edited fields then marks the DI
     * line done, both via the EXISTING save logic (`updateComposant` /
     * `setComposantAsUpdated`). On success the card greys out and the next
     * pending component opens.
     */
    validateCurrentComponent(): void {
        const line = this.activeLine;
        if (!line || line.validated) return;
        if (this.formUpdateComposant.invalid) {
            this.formUpdateComposant.markAllAsTouched();
            this.messageservice.add({
                severity: 'warn',
                summary: 'Champs requis',
                detail: 'Complétez les champs obligatoires avant de valider.',
            });
            return;
        }

        this.confirmationService.confirm({
            message:
                'Une fois validé, ce composant sera figé et retiré de la liste en attente.',
            header: 'Valider le composant',
            icon: 'pi pi-check-circle',
            accept: async () => {
                const updatedComposantData = {
                    ...this.formUpdateComposant.value,
                    pdf: this.payload.file
                        ? this.payload.file
                        : this.formUpdateComposant.value.pdf,
                };
                try {
                    // Central pattern: anti double-submit + SERIALIZED cascade
                    // (save the edited fields, THEN mark the line done — the
                    // handshake only fires after the save persists) + a single
                    // error toast + loading reset on every path.
                    await this.mutationRunner.runChain({
                        key: `validateComposant:${this.selectedDi_id}:${line.nameComposant}`,
                        steps: [
                            {
                                mutation: this.ticketSerice.updateComposant(
                                    updatedComposantData,
                                ),
                            },
                            {
                                mutation:
                                    this.ticketSerice.setComposantAsUpdated(
                                        this.selectedDi_id,
                                        line.nameComposant,
                                    ),
                            },
                        ],
                        successToast: {
                            summary: 'Composant validé',
                            detail: line.nameComposant,
                        },
                        errorToast: {
                            summary: 'Erreur',
                            detail: 'Validation impossible. Réessayez.',
                        },
                        onLoading: (v) => (this.isLoading = v),
                    });
                    // Post-success only — never runs if a step failed.
                    line.validated = true;
                    this.validatorFinirListeComposant = !this.allValidated;
                    this.getAllComposant();
                    this.advanceToNextUnvalidated();
                } catch {
                    /* toast already shown by the runner; line NOT validated */
                }
            },
        });
    }

    MagasinEstimation_Condition() {}
    Magasin_Condition() {}

    takeMetoDetailsComponent(dataRowselected) {
        const _id = dataRowselected._id;
        this.router.navigate(['tickets/ticket/details', _id]);
    }

    getAllComposant() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getAllComposant(),
            })
            .subscribe({
                next: ({ data, loading }) => {
                    this.isLoading = loading;
                    if (data?.findAllComposant) {
                        this.composantList = data.findAllComposant;
                    }
                },
                error: (error) => {
                    this.failWithToast(
                        'Erreur de chargement',
                        error,
                        'Impossible de charger le catalogue des composants.',
                    );
                },
            });
    }

    findAllComposant_Category() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.findAllComposant_Category(),
            })
            .subscribe({
                next: ({ data, loading }) => {
                    this.isLoading = loading;
                    if (data?.findAllComposant_Category) {
                        // `value` = _id (ce que le back référence dans
                        // `category_composant_id`), `name` = libellé affiché.
                        // Envoyer le libellé (ancien mapping) polluait la base.
                        this.composantCategory =
                            data.findAllComposant_Category.map((el) => ({
                                name: el.category_composant,
                                value: el._id,
                            }));
                    }
                },
                error: (error) => {
                    this.failWithToast(
                        'Erreur de chargement',
                        error,
                        'Impossible de charger les catégories de composants.',
                    );
                },
            });
    }

    /**
     * Handle page change
     */
    onPageChange(event: PageEvent) {
        this.first = event.first;
        this.page = event.page;
        this.rows = event.rows;

        // Load data (will automatically use search if active)
        this.loadData();
    }

    getSelectedStatus(statusComposant: any) {
        this.selectedstatusComposant = statusComposant.value;
    }

    getLogsDiById(_id: number) {}

    selectedDropDown(selectedItem) {
        this.validerComposantValidtor = true;
        this.nameComposananrSelected = selectedItem.value;
        console.log(
            'this.nameComposananrSelected',
            this.nameComposananrSelected,
        );
        if (selectedItem.value) {
            this.selectedItem = selectedItem;
            this.apollo
                .query<ComposantByNameQueryResponse>({
                    query: this.ticketSerice.composantByName(
                        selectedItem.value,
                    ),
                })
                .subscribe({
                    // errorPolicy 'all' (queries) : les erreurs GraphQL
                    // arrivent ICI avec `data: null`, pas dans `error` —
                    // d'où l'ancien TypeError sur `data.findOneComposant`.
                    next: ({ data, errors, loading }) => {
                        this.isLoading = loading;
                        const composant = data?.findOneComposant;
                        if (!composant) {
                            this.loadedDataComposant = null;
                            this.formUpdateComposant.reset();
                            // Garder le nom visible pour situer la ligne DI.
                            this.formUpdateComposant.patchValue({
                                name: selectedItem.value,
                            });
                            this.messageservice.add({
                                severity: 'warn',
                                summary: 'Composant introuvable',
                                detail:
                                    this.errorDetail(
                                        errors,
                                        `Le composant « ${selectedItem.value} » n'existe pas dans le catalogue de cette base.`,
                                    ) +
                                    ' Créez-le d’abord via « Créer un composant ».',
                            });
                            return;
                        }
                        this.loadedDataComposant = composant;
                        this.formUpdateComposant.patchValue({
                            _id: composant._id,
                            name: composant.name,
                            package: composant.package,
                            category_composant_id: this.normalizeCategoryId(
                                composant.category_composant_id,
                            ),
                            prix_achat: composant.prix_achat,
                            prix_vente: composant.prix_vente,
                            coming_date: new Date(composant.coming_date),
                            link: composant.link,
                            quantity_stocked: composant.quantity_stocked,
                            pdf: composant.pdf,
                            status:
                                this.selectedstatusComposant ||
                                composant.status_composant,
                        });
                    },
                    error: (error) => {
                        this.failWithToast(
                            'Erreur de chargement',
                            error,
                            'Impossible de charger le composant. Réessayez.',
                        );
                    },
                });
        } else {
            this.formUpdateComposant.reset();
        }
    }

    /**
     * Transition INMAGASIN/MagasinEstimation → PENDING2. C'est une MUTATION :
     * l'ancien code la faisait passer par `watchQuery` (errorPolicy 'ignore')
     * → tout échec était invisible. Résout à la fin pour que l'appelant
     * n'enchaîne (fermeture modal, refresh) qu'après confirmation serveur.
     */
    changeStatusDiToPending2(_id: string): Promise<any> {
        return this.mutationRunner.run({
            key: `changeStatusDiToPending2:${_id}`,
            mutation: this.ticketSerice.changeStatusDiToPending2(_id),
            errorToast: {
                summary: 'Erreur',
                detail: 'Le changement de statut a échoué. Réessayez.',
            },
            onLoading: (v) => (this.isLoading = v),
        });
    }

    // `updateComposantIncreation()` et `setComposantAsUpdate()` (morts, non
    // référencés par le template, erreurs GraphQL avalées) ont été supprimés —
    // les flux vivants sont `updateComposant()` et `validateCurrentComponent()`.

    /**
     * « Enregistrer » — persist the edited fields of the CURRENT component
     * WITHOUT validating/greying it (that's « Valider ce composant », a
     * separate handler: `validateCurrentComponent`). The spinner must always
     * stop and exactly one toast must show.
     */
    updateComposant() {
        if (this.formUpdateComposant.invalid) {
            this.formUpdateComposant.markAllAsTouched();
            this.messageservice.add({
                severity: 'warn',
                summary: 'Champs requis',
                detail: 'Complétez les champs obligatoires avant d’enregistrer.',
            });
            return;
        }

        this.confirmationService.confirm({
            message: 'Voulez-vous confirmer les changements ?',
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                // Keep a staged PDF if one was just selected; otherwise keep the
                // already-saved file name from the form.
                const updatedComposantData = {
                    ...this.formUpdateComposant.value,
                    pdf: this.payload?.file
                        ? this.payload.file
                        : this.formUpdateComposant.value.pdf,
                };

                this.isLoading = true;
                this.apollo
                    .mutate<any>({
                        mutation:
                            this.ticketSerice.updateComposant(
                                updatedComposantData,
                            ),
                        useMutationLoading: true,
                    })
                    .subscribe({
                        next: ({ data, loading }) => {
                            // `useMutationLoading` emits a partial loading frame
                            // first — ignore it so we don't act on no data.
                            if (loading) return;
                            // ALWAYS release the block-UI overlay.
                            this.isLoading = false;
                            if (!data?.addComposantInfo) return;

                            this.pdfAdded = data.addComposantInfo.pdf;
                            this.messageservice.add({
                                severity: 'success',
                                summary: 'Enregistré',
                                detail: 'Composant mis à jour.',
                            });

                            // Proof of persistence + keep the form in sync (incl.
                            // a renamed component): reload the saved row by its
                            // current name. Does NOT validate/grey the line.
                            const savedName =
                                data.addComposantInfo.name ??
                                this.activeLine?.nameComposant;
                            if (this.activeLine) {
                                this.activeLine.nameComposant = savedName;
                            }
                            if (savedName) {
                                this.selectedDropDown({ value: savedName });
                            }
                            this.getAllComposant();
                            // Refresh the DI list so a later re-open reads the
                            // up-to-date requested lines (a rename is cascaded
                            // onto `array_composants[].nameComposant` server-side;
                            // without this the in-memory row stays stale).
                            this.loadData();
                        },
                        error: (error) => {
                            // Never freeze the UI: drop the overlay + one toast
                            // carrying the REAL server message (e.g.
                            // « Composant 'X' introuvable. »).
                            console.error('Error updating composant: ', error);
                            this.failWithToast(
                                'Erreur',
                                error,
                                'Sauvegarde impossible. Réessayez.',
                            );
                        },
                    });
            },
        });
    }

    finishMagasinEstimation() {
        this.confirmationService.confirm({
            message: 'Voulez-vous confirmer les changements',
            header: 'Confirmation Magasin Estimation',
            icon: 'pi pi-question-circle',
            accept: async () => {
                try {
                    // Attendre la confirmation serveur AVANT de fermer le
                    // modal / recharger (l'ancien code enchaînait aveuglément,
                    // même si la transition échouait).
                    await this.changeStatusDiToPending2(this.selectedDi_id);
                    this.magasinDiDialog = false;
                    this.formUpdateComposant.reset();
                    this.loadData();
                } catch {
                    /* toast déjà affiché ; le modal reste ouvert */
                }
            },
        });
    }

    uploadFile(base64: string, type: string) {
        if (type === 'cPDF') {
            const payload = {
                file: base64,
            };

            this.payload = payload;
            console.log('🍓[payload]:', this.payload);
        }
        if (type === 'addComposant') {
            const payload = {
                file: base64,
            };

            this.payload = payload;
            console.log('🍓[payload]:', this.payload);
        }
    }

    onClear() {
        this.isToUpdate = false;
    }

    clearDropDown() {
        this.isToUpdate = false;
    }

    addComposant() {
        this.confirmationService.confirm({
            message: 'Voulez-vous Ajouter ce composant ?',
            header: 'Confirmation Ajout',

            accept: async () => {
                // Création d'un NOUVEAU composant du catalogue.
                if (!this.isToUpdate) {
                    const composantDataTosend = {
                        ...this.composantMagasin.value,
                        pdf: this.payload?.file || null,
                    };
                    try {
                        // L'ancien subscribe n'avait AUCUN callback d'erreur :
                        // un échec (doublon de nom, catégorie manquante…)
                        // laissait le modal ouvert sans aucun retour.
                        await this.mutationRunner.run({
                            key: 'addComposantMagasin',
                            mutation:
                                this.ticketSerice.addComposantMagasin(
                                    composantDataTosend,
                                ),
                            successToast: {
                                summary: 'Composant créé',
                                detail: composantDataTosend.name || '',
                            },
                            errorToast: {
                                summary: 'Erreur',
                                detail: 'Création impossible. Réessayez.',
                            },
                            onLoading: (v) => (this.isLoading = v),
                        });
                        this.getAllComposant();
                        this.composantMagasin.reset();
                        this.openCreationComposantModal = false;
                    } catch {
                        /* toast déjà affiché ; le modal reste ouvert */
                    }
                    return;
                }

                // Mise à jour d'un composant EXISTANT (sélectionné en haut).
                const formattedComposantInfo = {
                    _id: this.composantMagasin.value._id,
                    name: this.composantMagasin.value.name,
                    package: this.composantMagasin.value.packageComposant,
                    category_composant_id:
                        this.composantMagasin.value.category_composant_id,
                    prix_achat: this.composantMagasin.value.prix_achat,
                    prix_vente: this.composantMagasin.value.prix_vente,
                    coming_date: this.composantMagasin.value.coming_date,
                    link: this.composantMagasin.value.link,
                    quantity_stocked:
                        this.composantMagasin.value.quantity_stocked,
                    pdf: this.payload?.file || null,
                    status_composant: this.composantMagasin.value.status,
                };
                try {
                    await this.mutationRunner.run({
                        key: `updateComposantFromCreation:${
                            formattedComposantInfo._id ||
                            formattedComposantInfo.name
                        }`,
                        mutation: this.ticketSerice.updateComposant(
                            formattedComposantInfo,
                        ),
                        successToast: {
                            summary: 'Composant mis à jour',
                            detail: formattedComposantInfo.name || '',
                        },
                        errorToast: {
                            summary: 'Erreur',
                            detail: 'Mise à jour impossible. Réessayez.',
                        },
                        onLoading: (v) => (this.isLoading = v),
                    });
                    this.getAllComposant();
                    this.composantMagasin.reset();
                    this.openCreationComposantModal = false;
                } catch {
                    /* toast déjà affiché ; le modal reste ouvert */
                }
            },
        });
    }

    directToComposantManagement() {
        this.router.navigate(['tickets/ticket/composant-management']);
    }
    getStatusLabel(status: string): string {
        const map = {
            CREATED: 'CREATED',
            PENDING1: 'PENDING1',
            PENDING2: 'PENDING2',
            PENDING3: 'PENDING3',
            DIAGNOSTIC: 'DIAGNOSTIC',
            INDIAGNOSTIC: 'INDIAGNOSTIC',
            INMAGASIN: 'INMAGASIN',
            PRICING: 'PRICING',
            NEGOTIATION1: 'NEGOTIATION1',
            NEGOTIATION2: 'NEGOTIATION2',
            REPARATION: 'REPARATION',
            INREPARATION: 'INREPARATION',
            FINISHED: 'FINISHED',
            ANNULER: 'ANNULER',
            RETOUR1: 'RETOUR1',
            RETOUR2: 'RETOUR2',
            RETOUR3: 'RETOUR3',
        };

        return map[status] || status;
    }
}
