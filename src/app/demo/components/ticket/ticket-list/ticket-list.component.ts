import { Component, OnInit } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Product } from 'src/app/demo/api/product';
import { ProductService } from 'src/app/demo/service/product.service';
import { ALL_USERS, COLUMNS } from './constant-queries';
import { ROLES } from '../../profile/constant/role-constants';

import { MessageService } from 'primeng/api';
interface Column {
    field: string;
    header: string;
}

interface UploadEvent {
    originalEvent: Event;
    files: File[];
}

@Component({
    selector: 'app-ticket-list',
    standalone: false,

    templateUrl: './ticket-list.component.html',
    styleUrl: './ticket-list.component.scss',
})
export class TicketListComponent implements OnInit {
    visible: boolean = false;
    products!: Product[];
    loading: boolean = false;
    roles;
    cols!: Column[];
    ingredient;
    uploadedFiles: any[] = [];

    constructor(private productService: ProductService) {
        this.roles = ROLES;
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

    showDialog() {
        this.visible = true;
    }

    load() {
        this.loading = true;

        setTimeout(() => {
            this.loading = false;
        }, 2000);
    }

    onUpload(event: UploadEvent) {
        for (let file of event.files) {
            this.uploadedFiles.push(file);
        }
    }
}
