import { Component } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { TicketService } from 'src/app/demo/service/ticket.service';

@Component({
    selector: 'app-magasin-di-list',
    // standalone: true,
    // imports: [],
    templateUrl: './magasin-di-list.component.html',
    styleUrl: './magasin-di-list.component.scss',
})
export class MagasinDiListComponent {
    visible: boolean = false;
    // products!: Product[];

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
        // this.roles = ROLES;
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
                query: this.ticketSerice.getAllMagasin(),
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                console.log('🥕[errors]:', errors);
                console.log('🍸[loading]:', loading);
                console.log('🍼️[data]:', data);
                if (data) {
                    this.diList = data.getDiForMagasin.di;
                    this.diListCount = data.getDiForMagasin.totalDiCount;
                }
            });
    }
    load() {
        this.loading = true;

        setTimeout(() => {
            this.loading = false;
        }, 2000);
    }

    // onUpload(event: UploadEvent) {
    //     for (let file of event.files) {
    //         this.uploadedFiles.push(file);
    //     }
    // }

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
