import { Component } from '@angular/core';
import { Product } from 'src/app/demo/api/product';
import { ProductService } from 'src/app/demo/service/product.service';
import { REGION } from '../constant/region-constant';
import { FormControl, FormGroup } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { ClientService } from 'src/app/demo/service/client.service';
import { ConfirmationService, MessageService } from 'primeng/api';
interface Column {
    field: string;
    header: string;
}

interface PageEvent {
    first: number;
    rows: number;
    page: number;
    pageCount: number;
}

@Component({
    selector: 'app-client-list',
    // standalone: true,
    // imports: [],
    templateUrl: './client-list.component.html',
    styleUrl: './client-list.component.scss',
})
export class ClientListComponent {
    clientForm = new FormGroup({
        firstName: new FormControl(),
        lastName: new FormControl(),
        region: new FormControl(),
        address: new FormControl(),
        email: new FormControl(),
        phone: new FormControl(),
    });
    visible: boolean = false;
    products!: Product[];
    loading: boolean = false;
    region;
    // cols!: Column[];
    clientsList: any;
    cols = [
        { field: '_id', header: 'ID' },
        { field: 'first_name', header: 'Prénom' },
        { field: 'last_name', header: 'Nom' },
        { field: 'email', header: 'E-mail' },
        { field: 'region', header: 'Région' },
        { field: 'phone', header: 'Téléphone' },
        { field: 'address', header: 'Adresse' },
    ];
    first: number = 0;

    rows: number = 10;

    product: any;
    productDialog: boolean = false;
    submitted: boolean;
    selectedProducts: null;

    constructor(
        private productService: ProductService,
        private apollo: Apollo,
        private clientService: ClientService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {
        this.region = REGION;
    }

    ngOnInit() {
        this.clients();
    }

    showDialog() {
        this.visible = true;
    }

    addClient() {
        this.apollo
            .mutate<any>({
                mutation: this.clientService.addClient(this.clientForm.value),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                this.loading = loading;
                if (data) {
                    console.log('🍒[data]:', data);
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Success',
                        detail: 'Le client ajouté avec succés',
                    });
                }
                if (errors) {
                    console.log('🍦[errors]:', errors);
                }
            });
    }

    onPageChange(event: PageEvent) {
        console.log('🥝[event]:', event);
        this.first = event.first;
        this.rows = event.rows;
    }

    clients() {
        this.apollo
            .watchQuery<any>({
                query: this.clientService.getAllClient(),
                useInitialLoading: true,
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                this.loading = loading;
                if (data) {
                    this.clientsList = data.findAllClient;
                }
                console.log('🍼️[errors]:', errors);
                console.log('🍷[loading]:', loading);
                console.log('🍡[data]:', data);
            });
    }

    editProduct(rowDataClient) {
        console.log('🍎[rowDataClient]:', rowDataClient);
        this.product = { ...rowDataClient };
        this.productDialog = true;
    }
    deleteSelectedProducts() {
        this.confirmationService.confirm({
            message: 'Are you sure you want to delete the selected products?',
            header: 'Confirm',
            icon: 'pi pi-exclamation-triangle',
            // accept: () => {
            //     this.products = this.products.filter(
            //         (val) => !this.selectedProducts?.includes(val)
            //     );
            //     this.selectedProducts = null;
            //     this.messageService.add({
            //         severity: 'success',
            //         summary: 'Successful',
            //         detail: 'Products Deleted',
            //         life: 3000,
            //     });
            // },
        });
    }
}
