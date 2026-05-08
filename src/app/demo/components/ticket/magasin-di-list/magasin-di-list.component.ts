import { Component, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { TicketService } from 'src/app/demo/service/ticket.service';
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
    rowHasLoadedComposants,
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
    ) {
        this.formUpdateComposant = new FormGroup({
            _id: new FormControl(null),
            name: new FormControl(null, Validators.required),
            package: new FormControl(null, Validators.required),
            category_composant_id: new FormControl(null, Validators.required),
            prix_achat: new FormControl(null, Validators.required),
            prix_vente: new FormControl(null, Validators.required),
            coming_date: new FormControl(null, Validators.required),
            link: new FormControl(null, Validators.required),
            quantity_stocked: new FormControl(null, Validators.required),
            pdf: new FormControl(null),
            status: new FormControl(null, Validators.required),
        });
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
                .subscribe(({ data }) => {
                    if (data && data.searchDiForMagasin) {
                        this.diList = data.searchDiForMagasin.di;
                        this.diListCount = data.searchDiForMagasin.totalDiCount;
                    }
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
                .subscribe(({ data }) => {
                    if (data) {
                        this.diList = data.getDiForMagasin.di;
                        this.diListCount = data.getDiForMagasin.totalDiCount;
                    }
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

    hasLoadedComposants(row: any): boolean {
        return rowHasLoadedComposants(row);
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
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
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

    showDialogCategoryComposant() {
        this.openCreationCategoryComposantModal = true;
        this.apollo
            .query<any>({
                query: this.ticketSerice.findAllComposant_Category(),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                console.log(data, 'data all category');
                this.composantCatgorieList = data.findAllComposant_Category;
                console.log(
                    this.composantCatgorieList,
                    'composantCatgorieList',
                );
            });
    }

    deletComposant() {
        console.log('delete not working', this.loadedDataComposant._id);

        this.confirmationService.confirm({
            message: 'Voulez-vous Supprimer ce composant ?',
            header: 'Confirmation Suppression',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.removeComposant(
                            this.loadedDataComposant._id,
                        ),
                    })
                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;
                        console.log('🥨[data]:', data);
                        if (data) {
                            this.apollo
                                .query<any>({
                                    query: this.ticketSerice.getAllComposant(),
                                })
                                .subscribe(({ data }) => {
                                    this.composantCatgorieList =
                                        data.findAllComposant_Category;
                                    this.composantList = data.findAllComposant;
                                });
                        }
                    });
            },
        });
    }

    deleteCategorycomposant(rowData) {
        console.log(rowData._id, 'rowdata here');

        this.confirmationService.confirm({
            message: 'Voulez-vous Supprimer cette categorie ?',
            header: 'Confirmation Suppression',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.removeComposant_Category(
                            rowData._id,
                        ),
                    })
                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;
                        if (data) {
                            this.apollo
                                .query<any>({
                                    query: this.ticketSerice.findAllComposant_Category(),
                                })
                                .subscribe(({ data }) => {
                                    this.composantCatgorieList =
                                        data.findAllComposant_Category;
                                });
                        }
                    });
            },
        });
    }

    addNewCategoryComposant() {
        this.confirmationService.confirm({
            message: 'Voulez-vous créer cette categorie ?',
            header: 'Confirmation Creation',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.addNewCategoryComposant(
                            this.addCategoryCompsant.value.categoryName,
                        ),
                    })
                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;
                        if (data) {
                            this.addCategoryCompsant.reset();
                            this.apollo
                                .query<any>({
                                    query: this.ticketSerice.findAllComposant_Category(),
                                })
                                .subscribe(({ data, loading }) => {
                                    this.isLoading = loading;
                                    this.composantCatgorieList =
                                        data.findAllComposant_Category;
                                });
                        }
                    });
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
                .subscribe(({ data, loading }) => {
                    this.loadedDataComposant = data.findOneComposant;
                    this.isLoading = loading;
                    console.log(
                        '🍷[ this.loadedDataComposant]:',
                        this.loadedDataComposant,
                    );

                    if (data) {
                        this.composantMagasin.patchValue({
                            _id: this.loadedDataComposant._id,
                            name: this.loadedDataComposant.name,
                            packageComposant: this.loadedDataComposant.package,
                            category_composant_id:
                                this.loadedDataComposant.category_composant_id,
                            prix_achat: this.loadedDataComposant.prix_achat,
                            prix_vente: this.loadedDataComposant.prix_vente,
                            coming_date: new Date(
                                this.loadedDataComposant.coming_date,
                            ),
                            link: this.loadedDataComposant.link,
                            quantity_stocked:
                                this.loadedDataComposant.quantity_stocked,
                            pdf: this.loadedDataComposant.pdf,
                            status: this.loadedDataComposant.status_composant,
                        });
                    }
                });
        }

        if (!selectedItem.value) {
            this.composantMagasin.reset();
        }
    }

    openDialogMagasin(item) {
        this.findAllComposant_Category();

        this.selectedDi_id = item._id;
        this.ignoreCount = item.ignoreCount;

        if (item && item.ignoreCount && item.ignoreCount > 0) {
            this.apollo
                .query<any>({
                    query: this.ticketSerice.getLogsDiById(
                        item.ignoreCount,
                        item._id,
                    ),
                })
                .subscribe(({ data, loading }) => {
                    this.isLoading = loading;
                    const logsDi = data?.getLigsById;

                    if (logsDi?.array_composants) {
                        console.log('inside logs array composant');
                        console.log('logsDi', logsDi.array_composants);
                        this.arrayComposant = logsDi.array_composants
                            .filter((el: any) => el.isUpdated === false)
                            .map((el: any) => {
                                console.log('el', el);
                                return {
                                    infoComposant:
                                        el.nameComposant + ': ' + el.quantity,
                                    nameComposant: el.nameComposant,
                                    quantity: el.quantity,
                                };
                            });
                    }
                });
        } else {
            console.log('inside DI array composant');
            this.arrayComposant = item.array_composants
                .filter((el) => el.isUpdated === false)
                .map((el) => {
                    return {
                        infoComposant: el.nameComposant + ': ' + el.quantity,
                        nameComposant: el.nameComposant,
                        quantity: el.quantity,
                    };
                });
        }
        console.log(this.arrayComposant?.length, 'ARR COMPOSANTS');
        this.arrayComposant?.length == 0
            ? (this.validatorFinirListeComposant = false)
            : (this.validatorFinirListeComposant = true);
        this.magasinDiDialog = true;
        console.log('this.arrayComposant in', this.arrayComposant.length);
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
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.composantList = data.findAllComposant;
                }
            });
    }

    findAllComposant_Category() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.findAllComposant_Category(),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.composantCategory = data.findAllComposant_Category.map(
                        (el) => {
                            return {
                                name: el.category_composant,
                                value: el.category_composant,
                            };
                        },
                    );
                }
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
                .subscribe(({ data, loading }) => {
                    this.isLoading = loading;

                    this.loadedDataComposant = data.findOneComposant;
                    console.log(
                        '🍪[this.loadedDataComposant]:',
                        this.loadedDataComposant,
                    );

                    if (data) {
                        console.log(
                            'this.loadedDataComposant.pdf',
                            this.loadedDataComposant.pdf,
                        );
                        this.formUpdateComposant.patchValue({
                            _id: this.loadedDataComposant._id,
                            name: this.loadedDataComposant.name,
                            package: this.loadedDataComposant.package,
                            category_composant_id:
                                this.loadedDataComposant.category_composant_id,
                            prix_achat: this.loadedDataComposant.prix_achat,
                            prix_vente: this.loadedDataComposant.prix_vente,
                            coming_date: new Date(
                                this.loadedDataComposant.coming_date,
                            ),
                            link: this.loadedDataComposant.link,
                            quantity_stocked:
                                this.loadedDataComposant.quantity_stocked,
                            pdf: this.loadedDataComposant.pdf,
                            status:
                                this.selectedstatusComposant ||
                                this.loadedDataComposant.status_composant,
                        });
                    }
                });
        } else {
            this.formUpdateComposant.reset();
        }
    }

    changeStatusDiToPending2(_id: string) {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.changeStatusDiToPending2(_id),
            })
            .valueChanges.subscribe(({ loading }) => {
                this.isLoading = loading;
            });
    }

    updateComposantIncreation() {
        console.log('updateComposantIncreation');
        this.confirmationService.confirm({
            message: 'Voulez-vous confirmer les changements ?',
            header: 'Confirmation Diagnostique',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.updateComposant({
                            ...this.composantMagasin.value,
                            pdf: this.payload.file,
                        }),
                        useMutationLoading: true,
                    })
                    .subscribe(
                        ({ data, loading }) => {
                            this.isLoading = loading;
                            if (data) {
                            }
                        },
                        (error) => {
                            console.error('Error updating composant: ', error);
                        },
                    );
            },
        });
    }

    setComposantAsUpdate() {
        this.confirmationService.confirm({
            message:
                'Attention : Une fois validé, vous ne pourrez plus modifier ce composant !',
            header: 'Validation composant',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                console.log('inside function valider');
                console.log(
                    ' this.nameComposananrSelected',
                    this.nameComposananrSelected,
                );
                console.log(' this.selectedDi_id', this.selectedDi_id);
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.setComposantAsUpdated(
                            this.selectedDi_id,
                            this.nameComposananrSelected,
                        ),
                    })
                    .subscribe(({ data }) => {
                        if (data) {
                            const index = this.arrayComposant.findIndex(
                                (composant) =>
                                    composant.nameComposant ===
                                    this.nameComposananrSelected,
                            );

                            if (index !== -1) {
                                this.arrayComposant.splice(index, 1);
                            }

                            this.nameComposananrSelected = null;
                            this.selectedItem = null;
                            console.log(
                                'this.arrayComposant',
                                this.arrayComposant.length,
                            );
                            this.arrayComposant.length == 0
                                ? (this.validatorFinirListeComposant = false)
                                : (this.validatorFinirListeComposant = true);
                        }
                    });
            },
        });
    }

    updateComposant() {
        console.log('🥔updateComposant 2');

        this.confirmationService.confirm({
            message: 'Voulez-vous confirmer les changements ?',
            header: 'Confirmation Diagnostique',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                Object.keys(this.formUpdateComposant.controls).forEach(
                    (key) => {
                        this.formUpdateComposant.get(key)?.markAsDirty();
                    },
                );

                const updatedComposantData = {
                    ...this.formUpdateComposant.value,
                    pdf: this.payload.file,
                };

                console.log('🍡[updatedComposantData]:', updatedComposantData);
                this.apollo
                    .mutate<any>({
                        mutation:
                            this.ticketSerice.updateComposant(
                                updatedComposantData,
                            ),
                        useMutationLoading: true,
                    })
                    .subscribe(
                        ({ data, loading }) => {
                            this.isLoading = loading;
                            if (data) {
                                this.pdfAdded = data.addComposantInfo.pdf;
                                console.log(
                                    '🍝[ this.pdfAdded]:',
                                    this.pdfAdded,
                                );
                            }
                        },
                        (error) => {
                            console.error('Error updating composant: ', error);
                        },
                    );
                this.validerComposantValidtor = false;
            },
        });

        this.loadData();
    }

    finishMagasinEstimation() {
        this.confirmationService.confirm({
            message: 'Voulez-vous confirmer les changements',
            header: 'Confirmation Magasin Estimation',
            icon: 'pi pi-question-circle',
            accept: () => {
                this.changeStatusDiToPending2(this.selectedDi_id);
                this.loadData();
                this.magasinDiDialog = false;
                this.formUpdateComposant.reset();
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

            accept: () => {
                if (!this.isToUpdate) {
                    const composantDataForm = this.composantMagasin.value;

                    const composantDataTosend = {
                        ...composantDataForm,
                        pdf: this.payload?.file || null,
                    };
                    console.log('composantDataTosend', composantDataTosend);
                    this.apollo
                        .mutate<any>({
                            mutation:
                                this.ticketSerice.addComposantMagasin(
                                    composantDataTosend,
                                ),
                        })
                        .subscribe(({ data, loading }) => {
                            this.isLoading = loading;
                            if (data) {
                                console.log('data inside function', data);
                                this.messageservice.add({
                                    severity: 'success',
                                    summary: 'Success',
                                    detail: 'Le composant a été créer',
                                });
                                this.getAllComposant();
                                this.composantMagasin.reset();
                            }
                        });
                }

                if (this.isToUpdate) {
                    const formattedComposantInfo = {
                        name: this.composantMagasin.value.name,
                        package: this.composantMagasin.value.packageComposant,
                        category_composant_id:
                            this.composantMagasin.value.category_composant_id,
                        prix_achat: this.composantMagasin.value.prix_achat,
                        prix_vente: this.composantMagasin.value.prix_vente,
                        coming_date: new Date(
                            this.composantMagasin.value.coming_date,
                        ).toISOString(),
                        link: this.composantMagasin.value.link,
                        quantity_stocked:
                            this.composantMagasin.value.quantity_stocked,
                        pdf: this.payload?.file || null,
                        status_composant: this.composantMagasin.value.status,
                    };

                    console.log(
                        'formattedComposantInfo update',
                        formattedComposantInfo,
                    );

                    this.apollo
                        .mutate<any>({
                            mutation: this.ticketSerice.updateComposant(
                                formattedComposantInfo,
                            ),
                            useMutationLoading: true,
                        })
                        .subscribe(({ data, loading }) => {
                            this.isLoading = loading;
                            if (data) {
                                this.composantMagasin.reset();
                            }
                        });
                }

                this.openCreationComposantModal = false;
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
