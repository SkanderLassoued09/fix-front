import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Product } from 'src/app/demo/api/product';
import { CompanyService } from 'src/app/demo/service/company.service';
import { ProductService } from 'src/app/demo/service/product.service';
import { REGION } from '../../client/constant/region-constant';
interface Column {
    field: string;
    header: string;
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
            Exoneration: string;
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
    region;
    companyForm = new FormGroup({
        companyName: new FormControl('', [Validators.required]),
        address: new FormControl('', [Validators.required]),
        phone: new FormControl(''),
        email: new FormControl(''),
        region: new FormControl('', [Validators.required]),
        fax: new FormControl(''),
        website: new FormControl(''),
        raisonSociale: new FormControl('', [Validators.required]),
        activitePrincipale: new FormControl(''),
        activiteSecondaire: new FormControl(''),
        Exoneration: new FormControl(''),
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

    // cols!: Column[];
    toHideAchat: boolean;
    toHideFinancier: boolean;
    toHideTechnique: boolean;
    companiesList: any;

    cols = [
        { field: 'name', header: 'Nom' },
        { field: 'region', header: 'Région' },
        { field: 'address', header: 'Adresse' },
        { field: 'email', header: 'E-mail' },
        { field: 'activitePrincipale', header: 'Activité principale' },
        { field: 'activiteSecondaire', header: 'Activité secondaire' },
        { field: 'raisonSociale', header: 'Raison sociale' },
        { field: 'Exoneration', header: 'Exoneration' },
        { field: 'fax', header: 'Fax' },
        { field: 'webSiteLink', header: 'Lien du web' },
    ];
    companySelected: any;
    CompanyModalCondition: boolean = false;
    first: number = 0;
    rows: number = 10;
    totalCompanyRecord: number;
    page: number = 0;

    constructor(
        private productService: ProductService,
        private apollo: Apollo,
        private companyService: CompanyService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {
        this.region = REGION;
    }
    ngOnInit() {
        this.companies(this.first, this.rows);
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
        this.apollo
            .mutate<AddCompanyMutationResponse>({
                mutation: this.companyService.addCompany(
                    this.companyForm.value
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, errors, loading }) => {
                this.loading = loading;
                if (data) {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Success',
                        detail: 'La société ajouté avec succés',
                    });
                    this.companies(this.first, this.rows);
                    this.creationCompanyModalCondition = false;
                }
                if (errors) {
                    console.log('🍦[errors]:', errors);
                }
            });
    }

    onPageChange(event: PageEvent) {
        this.first = event.first;
        this.page = event.page;
        this.rows = event.rows;
        this.companies(this.first, this.rows);
    }

    companies(first, rows) {
        this.apollo
            .watchQuery<GetAllCompanyQueryResponse>({
                query: this.companyService.getAllCompany(first, rows),
                useInitialLoading: true,
            })

            .valueChanges.subscribe(({ data, loading, errors }) => {
                console.log('🥠[errors]:', errors);
                console.log('🍈[loading]:', loading);
                console.log('🥃[data]:', data);
                if (data) {
                    this.companiesList = data.findAllCompany.companyRecords;
                    this.totalCompanyRecord =
                        data.findAllCompany.totalCompanyRecord;
                }
            });
    }

    editCompany(rowDataClient) {
        console.log('🍎[rowDataClient]:', rowDataClient);
        this.companySelected = { ...rowDataClient };
        this.CompanyModalCondition = true;
    }

    annuler() {
        this.CompanyModalCondition = false;
    }
    annulerUpdate() {
        this.creationCompanyModalCondition = false;
    }
    deleteSelectedCompany(rowData) {
        this.confirmationService.confirm({
            message: 'Voulez vous supprimer cette société',
            header: 'Confirmation',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                console.log(rowData._id, 'rowdata value ');

                this.apollo
                    .mutate<any>({
                        mutation: this.companyService.removeCompany(
                            rowData._id
                        ),
                    })
                    .subscribe(({ data }) => {
                        console.log('🍠[data]:', data);
                    });
                console.log('done deleted');

                this.messageService.add({
                    severity: 'warn',
                    summary: 'Supprimer',
                    detail: `La société ${rowData._id} a été supprimé`,
                    life: 3000,
                });
            },
        });
        this.companies(this.first, this.rows);
    }
}
