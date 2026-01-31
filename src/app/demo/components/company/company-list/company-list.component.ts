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
    region;
    companyForm = new FormGroup({
        companyName: new FormControl('', [Validators.required]),
        address: new FormControl('', [Validators.required]),
        phone: new FormControl(''),
        email: new FormControl(''),
        region: new FormControl('', [Validators.required]),
        fax: new FormControl(''),
        website: new FormControl(''),
        // raisonSociale: new FormControl('', [Validators.required]),
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

    // cols!: Column[];
    toHideAchat: boolean;
    toHideFinancier: boolean;
    toHideTechnique: boolean;
    companiesList: any;

    cols = [
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
        this.confirmationService.confirm({
            message: 'Voulez vous confirmer les changements',
            header: 'Confirmation creation de sociéte',
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
                                summary: 'Success',
                                detail: 'La société ajouté avec succés',
                            });
                            this.companies(this.first, this.rows);
                            this.creationCompanyModalCondition = false;
                        }
                        if (errors) {
                        }
                    });
            },
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
        console.log('==>', this.companySelected);

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
                            summary: 'Success',
                            detail: 'La sociéte a été modifier avec succés',
                        });
                        this.CompanyModalCondition = false;
                    }
                }
            });
    }

    saveUpdateServiceCompany(rowDataClient) {
        this.companySelected = { ...rowDataClient };
        this.detailsView = false;
        this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Le company a changé avec succés',
        });
    }

    annuler() {
        this.CompanyModalCondition = false;
    }
    annulerService() {
        this.detailsView = false;
    }
    annulerUpdate() {
        this.creationCompanyModalCondition = false;
        this.companyForm.reset();
    }
    deleteSelectedCompany(rowData) {
        this.confirmationService.confirm({
            message: 'Voulez vous supprimer cette société',
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
                        }
                    });

                this.messageService.add({
                    severity: 'danger',
                    summary: 'Supprimer',
                    detail: `La société ${rowData._id} a été supprimé`,
                    life: 3000,
                });
            },
        });
        this.companies(this.first, this.rows);
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
