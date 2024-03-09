import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Product } from 'src/app/demo/api/product';
import { ProductService } from 'src/app/demo/service/product.service';
import { ALL_USERS, COLUMNS } from './constant-queries';
import { ROLES } from '../../profile/constant/role-constants';

import { MessageService } from 'primeng/api';
import { TicketService } from 'src/app/demo/service/ticket.service';
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
    tstatuses = [{ label: 'Pending3', value: 'Pending3' }];

    ingredient;
    uploadedFiles: any[] = [];
    cols = [
        { field: '_id', header: 'ID' },
        { field: 'title', header: 'Title' },
        // { field: 'description', header: 'Description' },
        // { field: 'can_be_repaired', header: 'Reparable' },
        // { field: 'bon_de_commande', header: 'BC' },
        // { field: 'bon_de_livraison', header: 'BL' },
        // { field: 'contain_pdr', header: 'PDR' },
        { field: 'status', header: 'Statut' },
        { field: 'client_id', header: 'Client' },
        // { field: 'remarque_id', header: 'R.manager' },
        { field: 'created_by_id', header: 'Cree par' },
        { field: 'location_id', header: 'Location' },
        // { field: 'di_category_id', header: 'Categorie' },
    ];

    diList: any;
    diListCount: any;

    constructor(private ticketSerice: TicketService, private apollo: Apollo) {
        this.roles = ROLES;
    }

    ngOnInit() {
        this.getDi();
    }

    showDialog() {
        this.visible = true;
    }
    getDi() {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.getAllDi(),
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                console.log('🥕[errors]:', errors);
                console.log('🍸[loading]:', loading);
                console.log('🍼️[data]:', data);
                if (data) {
                    this.diList = data.getAllDi.di;
                    this.diListCount = data.getAllDi.totalDiCount;
                }
            });
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

    getSeverity(status: string) {
        // console.log('🦀[status]:', status);
        switch (status) {
            case 'PENDING3':
                return 'success';
            case 'LOWSTOCK':
                return 'warning';
            case 'OUTOFSTOCK':
                return 'danger';
            default:
                return 'warn';
        }
    }
}
