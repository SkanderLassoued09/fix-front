import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { MessageService } from 'primeng/api';
import { Product } from 'src/app/demo/api/product';
import { CompanyService } from 'src/app/demo/service/company.service';
import { ProductService } from 'src/app/demo/service/product.service';
interface Column {
    field: string;
    header: string;
}
@Component({
    selector: 'app-company-list',
    templateUrl: './company-list.component.html',
    styleUrl: './company-list.component.scss',
})
export class CompanyListComponent {
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
    visible: boolean = false;
    products!: Product[];
    loading: boolean = false;

    cols!: Column[];
    toHideAchat: boolean;
    toHideFinancier: boolean;
    toHideTechnique: boolean;
    showDialog() {
        this.visible = true;
    }

    constructor(
        private productService: ProductService,
        private apollo: Apollo,
        private companyService: CompanyService,
        private messageService: MessageService
    ) {}

    ngOnInit() {
        this.productService.getProducts().then((data) => {
            this.products = data;
        });

        this.cols = [
            { field: 'code', header: 'Code' },
            { field: 'name', header: 'Name' },
            { field: 'category', header: 'Category' },
            { field: 'quantity', header: 'Quantity' },
        ];
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

    addCompany() {
        console.log('🌶', this.companyForm.value);
        this.apollo
            .mutate<any>({
                mutation: this.companyService.addCompany(
                    this.companyForm.value
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, errors, loading }) => {
                this.loading = loading;
                if (data) {
                    console.log('🍒[data]:', data);
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Success',
                        detail: 'La société ajouté avec succés',
                    });
                }
                if (errors) {
                    console.log('🍦[errors]:', errors);
                }
            });
    }
}
