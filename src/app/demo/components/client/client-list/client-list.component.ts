import { Component } from '@angular/core';
import { Product } from 'src/app/demo/api/product';
import { ProductService } from 'src/app/demo/service/product.service';
import { REGION } from '../constant/region-constant';
import { FormControl, FormGroup } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { ClientService } from 'src/app/demo/service/client.service';
import { MessageService } from 'primeng/api';
interface Column {
    field: string;
    header: string;
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
    cols!: Column[];
    showDialog() {
        this.visible = true;
    }

    constructor(
        private productService: ProductService,
        private apollo: Apollo,
        private clientService: ClientService,
        private messageService: MessageService
    ) {
        this.region = REGION;
    }

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
}
