import { Component } from '@angular/core';
import { Product } from 'src/app/demo/api/product';
import { ProductService } from 'src/app/demo/service/product.service';
import { REGION } from '../constant/region-constant';
import { FormControl, FormGroup } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { ClientService } from 'src/app/demo/service/client.service';
import { ConfirmationService, MessageService } from 'primeng/api';

// add it to seperate file
interface Column {
    field: string;
    header: string;
}

interface AddClientMutationResponse {
    createClient: {
        _id: string;
    };
}

interface PageEvent {
    first: number;
    rows: number;
    page: number;
    pageCount: number;
}
interface GetAllClientQueryResponse {
    findAllClient: {
        clientRecords: {
            _id: string;
            first_name: string;
            last_name: string;
            region: string;
            address: string;
            email: string;
            phone: string;
        }[];
        totalClientRecord: number;
    };
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
        first_name: new FormControl(),
        last_name: new FormControl(),
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
    totalClientRecord: any;

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
        this.clients(this.first, this.rows);
    }

    showDialog() {
        this.visible = true;
    }

    addClient() {
        console.log('🥐this.clientForm.value', this.clientForm.value);
        const { region, ...data } = this.clientForm.value;
        const clientData = { ...data, region: region.name };
        console.log('🥫[clientData]:', clientData);
        this.apollo
            .mutate<AddClientMutationResponse>({
                mutation: this.clientService.addClient(clientData),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                this.loading = loading;
                if (data) {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Success',
                        detail: 'Le client ajouté avec succés',
                    });
                    this.clients(this.first, this.rows);
                    this.visible = false;
                }
                if (errors) {
                    console.log('🍦[errors]:', errors);
                }
            });
    }

    onPageChange(event: PageEvent) {
        this.first = event.first;
        this.rows = event.rows;
        this.clients(this.first, this.rows);
    }

    clients(first, rows) {
        this.apollo
            .watchQuery<GetAllClientQueryResponse>({
                query: this.clientService.getAllClient(this.rows, this.first),
                useInitialLoading: true,
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                this.loading = loading;
                if (data) {
                    console.log('🥑[data]:', data);
                    this.clientsList = data.findAllClient.clientRecords;
                    this.totalClientRecord =
                        data.findAllClient.totalClientRecord;
                }
                console.log('🍼️[errors]:', errors);
            });
    }

    editProduct(rowDataClient) {
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
