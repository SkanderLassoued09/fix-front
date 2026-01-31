import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Product } from 'src/app/demo/api/product';
import { CompanyService } from 'src/app/demo/service/company.service';
import { ProductService } from 'src/app/demo/service/product.service';
import { REGION } from '../../client/constant/region-constant';
import { debounceTime, Subject } from 'rxjs';

interface Column {
    field: string;
    header: string;
    searchKey?: string;
}

interface AddCompanyMutationResponse {
    createCompany: {
        _id: string;
    };
}

interface PageEvent {
    first: number;
    rows: number;
    page: number;
    pageCount: number;
}

interface GetAllCompanyQueryResponse {
    findAllCompany: {
        companyRecords: {
            _id: string;
            name: string;
            region: string;
            address: string;
            email: string;
            activitePrincipale: string;
            activiteSecondaire: string;
            raisonSociale: string;
            exoneration: string;
            fax: string;
            webSiteLink: string;
            serviceAchat: {
                name: string;
                email: string;
                phone: string;
            };
            serviceFinancier: {
                name: string;
                email: string;
                phone: string;
            };
            serviceTechnique: {
                name: string;
                email: string;
                phone: string;
            };
        };
        totalCompanyRecord: number;
    };
}

@Component({
    selector: 'app-company-list',
    templateUrl: './company-list.component.html',
    styleUrl: './company-list.component.scss',
})
export class CompanyListComponent {
    // Search state tracking
    private currentSearchField: string = '';
    private currentSearchValue: string = '';
    private searchSubject$ = new Subject<void>();

    region;
    companyForm = new FormGroup({
        companyName: new FormControl('', [Validators.required]),
        address: new FormControl('', [Validators.required]),
        phone: new FormControl(''),
        email: new FormControl(''),
        region: new FormControl('', [Validators.required]),
        fax: new FormControl(''),
        website: new FormControl(''),
        activitePrincipale: new FormControl(''),
        activiteSecondaire: new FormControl(''),
        exoneration: new FormControl(''),
        rne: new FormControl(''),
        mf: new FormControl(''),
        achat: new FormGroup({
            fullName: new FormControl('', [Validators.required]),
            email: new FormControl('', [Validators.required]),
            phone: new FormControl('', [Validators.required]),
        }),
        financier: new FormGroup({
            fullName: new FormControl('', [Validators.required]),
            email: new FormControl('', [Validators.required]),
            phone: new FormControl('', [Validators.required]),
        }),
        technique: new FormGroup({
            fullName: new FormControl(''),
            email: new FormControl(''),
            phone: new FormControl(''),
        }),
    });

    creationCompanyModalCondition: boolean = false;
    products!: Product[];
    loading: boolean = false;

    toHideAchat: boolean;
    toHideFinancier: boolean;
    toHideTechnique: boolean;
    companiesList: any;

    cols: Column[] = [
        { field: 'name', header: 'Nom', searchKey: 'name' },
        { field: 'region', header: 'Région', searchKey: 'region' },
        { field: 'address', header: 'Adresse', searchKey: 'address' },
        { field: 'email', header: 'E-mail', searchKey: 'email' },
        {
            field: 'raisonSociale',
            header: 'Raison sociale',
            searchKey: 'raisonSociale',
        },
        {
            field: 'exoneration',
            header: 'Exoneration',
            searchKey: 'exoneration',
        },
        { field: 'fax', header: 'Fax', searchKey: 'fax' },
    ];

    companySelected: any;
    CompanyModalCondition: boolean = false;
    first: number = 0;
    rows: number = 10;
    totalCompanyRecord: number;
    page: number = 0;
    detailsView: boolean;
    companySelectedView = {
        serviceAchat: { name: '', email: '', phone: '' },
        serviceFinancier: { name: '', email: '', phone: '' },
        serviceTechnique: { name: '', email: '', phone: '' },
    };
    submitted: boolean = false;

    constructor(
        private productService: ProductService,
        private apollo: Apollo,
        private companyService: CompanyService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
    ) {
        this.region = REGION;
    }

    ngOnInit() {
        // Setup search with debounce
        this.searchSubject$.pipe(debounceTime(400)).subscribe(() => {
            this.loadData();
        });

        // Initial load
        this.loadData();
    }

    /**
     * Centralized data loading method
     * Handles both search and regular data fetching with pagination
     */
    loadData() {
        const hasActiveSearch =
            this.currentSearchField &&
            this.currentSearchValue &&
            this.currentSearchValue.trim().length > 0;

        if (hasActiveSearch) {
            // Perform search
            this.apollo
                .query<any>({
                    query: this.companyService.searchCompany(
                        this.currentSearchField,
                        this.currentSearchValue,
                        this.first,
                        this.rows,
                    ),
                    fetchPolicy: 'no-cache',
                })
                .subscribe(({ data, loading }) => {
                    this.loading = loading;
                    if (data && data.searchCompany) {
                        this.companiesList = data.searchCompany.companyRecords;
                        this.totalCompanyRecord =
                            data.searchCompany.totalCompanyRecord;
                    }
                });
        } else {
            // Regular data fetch
            this.companies(this.first, this.rows);
        }
    }

    /**
     * Handle column search
     */
    onColumnSearch(field: string, value: string) {
        const v = value?.trim();
        const f = field?.trim();

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

    load() {
        this.loading = true;
        setTimeout(() => {
            this.loading = false;
        }, 2000);
    }

    hideShowFormAchat() {
        this.toHideAchat = !this.toHideAchat;
    }

    hideShowFormFinancier() {
        this.toHideFinancier = !this.toHideFinancier;
    }

    hideShowFormTechnique() {
        this.toHideTechnique = !this.toHideTechnique;
    }

    showDialog() {
        this.creationCompanyModalCondition = true;
    }

    addCompany() {
        this.confirmationService.confirm({
            message: 'Voulez vous confirmer les changements',
            header: 'Confirmation création de société',
            icon: 'pi pi-question-circle',
            accept: () => {
                this.apollo
                    .mutate<AddCompanyMutationResponse>({
                        mutation: this.companyService.addCompany(
                            this.companyForm.value,
                        ),
                        useMutationLoading: true,
                    })
                    .subscribe(({ data, errors, loading }) => {
                        this.loading = loading;
                        if (data) {
                            this.messageService.add({
                                severity: 'success',
                                summary: 'Succès',
                                detail: 'La société ajoutée avec succès',
                            });
                            this.loadData(); // Reload data after adding
                            this.companyForm.reset();
                            this.creationCompanyModalCondition = false;
                        }
                        if (errors) {
                            this.messageService.add({
                                severity: 'error',
                                summary: 'Erreur',
                                detail: "Erreur lors de l'ajout de la société",
                            });
                        }
                    });
            },
        });
    }

    onPageChange(event: PageEvent) {
        this.first = event.first;
        this.page = event.page;
        this.rows = event.rows;
        this.loadData(); // Use loadData instead of companies
    }

    companies(first, rows) {
        this.apollo
            .watchQuery<GetAllCompanyQueryResponse>({
                query: this.companyService.getAllCompany(first, rows),
                useInitialLoading: true,
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                this.loading = loading;
                if (data) {
                    this.companiesList = data.findAllCompany.companyRecords;
                    this.totalCompanyRecord =
                        data.findAllCompany.totalCompanyRecord;
                }
            });
    }

    editCompany(rowDataClient) {
        this.companySelected = { ...rowDataClient };
        this.CompanyModalCondition = true;
    }

    saveUpdateCompany() {
        this.submitted = true;

        if (!this.companySelected.name) {
            return;
        }

        this.apollo
            .mutate<any>({
                mutation: this.companyService.updatecompany(
                    this.companySelected,
                ),
            })
            .subscribe(({ data }) => {
                if (data) {
                    if (this.companySelected._id) {
                        this.companiesList[
                            this.findIndexById(this.companySelected._id)
                        ] = this.companySelected;

                        this.messageService.add({
                            severity: 'success',
                            summary: 'Succès',
                            detail: 'La société a été modifiée avec succès',
                        });
                        this.CompanyModalCondition = false;
                        this.submitted = false;
                        this.loadData(); // Reload data after update
                    }
                }
            });
    }

    saveUpdateServiceCompany(rowDataClient) {
        this.companySelected = { ...rowDataClient };
        this.detailsView = false;
        this.messageService.add({
            severity: 'success',
            summary: 'Succès',
            detail: 'La société a changé avec succès',
        });
        this.loadData(); // Reload data after update
    }

    annuler() {
        this.CompanyModalCondition = false;
        this.submitted = false;
        this.companySelected = null;
    }

    annulerService() {
        this.detailsView = false;
        this.companySelected = null;
    }

    annulerUpdate() {
        this.creationCompanyModalCondition = false;
        this.companyForm.reset();
    }

    deleteSelectedCompany(rowData) {
        this.confirmationService.confirm({
            message: 'Voulez-vous supprimer cette société?',
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.companyService.removeCompany(
                            rowData._id,
                        ),
                    })
                    .subscribe(({ data }) => {
                        if (data) {
                            const index = this.companiesList.findIndex((el) => {
                                return el._id === rowData._id;
                            });
                            this.companiesList.splice(index, 1);

                            this.messageService.add({
                                severity: 'success',
                                summary: 'Supprimé',
                                detail: `La société ${rowData.name} a été supprimée`,
                                life: 3000,
                            });

                            this.loadData(); // Reload data after delete
                        }
                    });
            },
        });
    }

    findIndexById(_id: string): number {
        let index = -1;
        for (let i = 0; i < this.companiesList.length; i++) {
            if (this.companiesList[i]._id === _id) {
                index = i;
                break;
            }
        }

        return index;
    }

    modalServices(data) {
        this.companySelected = {
            _id: data._id,
            name: data.name,
            serviceAchat: data.serviceAchat || {
                name: '',
                email: '',
                phone: '',
            },
            serviceFinancier: data.serviceFinancier || {
                name: '',
                email: '',
                phone: '',
            },
            serviceTechnique: data.serviceTechnique || {
                name: '',
                email: '',
                phone: '',
            },
        };
        this.detailsView = true;
    }
}
