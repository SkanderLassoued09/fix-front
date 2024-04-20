import { Component } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { Product } from 'src/app/demo/api/product';
import { TicketService } from 'src/app/demo/service/ticket.service';
import {
    ConfigDiagAffectationMutationResponse,
    ConfigRepAffectationMutationResponse,
    GetAllDiForCoordinatorQueryResponse,
    GetAllTechQueryResponse,
    TechStartDiagnosticMutationResponse,
} from './coordinator-di-list.interfaces';
import { STATUS_DI } from 'src/app/layout/api/status-di';

@Component({
    selector: 'app-coordinator-di-list',
    // standalone: true,
    // imports: [],
    templateUrl: './coordinator-di-list.component.html',
    styleUrl: './coordinator-di-list.component.scss',
})
export class CoordinatorDiListComponent {
    visible: boolean = false;
    products!: Product[];
    //--
    diag_condition: boolean = true; // enable when status = pending1
    admin_condition: boolean = true; //enable when status = pending2
    rep_condition: boolean = true; // enable when status = pending3
    //--
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

    countries;
    selectedCountry;
    diList: any;
    diListCount: any;
    diDialog: boolean = false;
    di: any;
    techList: any;
    selectedDi: any;
    pricingDoalog: boolean = false;

    constructor(private ticketSerice: TicketService, private apollo: Apollo) {
        // this.roles = ROLES;
    }

    ngOnInit() {
        this.getDi();

        this.getAllTech();
    }

    showDialog() {
        this.visible = true;
    }
    getDi() {
        this.apollo
            .watchQuery<GetAllDiForCoordinatorQueryResponse>({
                query: this.ticketSerice.getAllDiForCoordinator(),
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.diList = data.get_coordinatorDI.di;
                    this.diListCount = data.get_coordinatorDI.totalDiCount;
                }
            });
    }

    getAllTech() {
        this.apollo
            .watchQuery<GetAllTechQueryResponse>({
                query: this.ticketSerice.getAllTech(),
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.techList = data.getAllTech;
                }
            });
    }
    load() {
        this.loading = true;

        setTimeout(() => {
            this.loading = false;
        }, 2000);
    }

    openModalConfig(di) {
        this.di = { ...di };
        this.selectedDi = di._id;
        this.diDialog = true;
        // condition to send to diag
        di.status == STATUS_DI.PENDING1
            ? (this.diag_condition = false)
            : (this.diag_condition = true);
        // condition to send to admin
        di.status == STATUS_DI.PENDING2
            ? (this.admin_condition = false)
            : (this.admin_condition = true);
        //condition to send to repair
        di.status == STATUS_DI.PENDING3
            ? (this.rep_condition = false)
            : (this.rep_condition = true);
    }

    // this will show only if status allows
    showDialogForPricing() {
        this.pricingDoalog = true;
    }

    getSeverity(status: string) {
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

    saveProduct() {
        this.diDialog = false;
    }
    hideDialog() {
        this.diDialog = false;
    }

    updateStatusDiag() {
        this.apollo
            .mutate<TechStartDiagnosticMutationResponse>({
                mutation: this.ticketSerice.changeStatusDiToPending1(
                    this.selectedDi
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {});
    }

    changeStatusRepaire(_id) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusRepaire(_id),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                console.log('🌯[data changeStatusRepaire]:', data);
            });
    }

    selectedTechDiag(data) {
        this.apollo
            .mutate<ConfigDiagAffectationMutationResponse>({
                mutation: this.ticketSerice.configDiagAffectation(
                    this.selectedDi,
                    data.value._id
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.updateStatusDiag();
                }
            });
    }
    selectedTechRep(data) {
        this.apollo
            .mutate<ConfigRepAffectationMutationResponse>({
                mutation: this.ticketSerice.configRepAffectation(
                    this.selectedDi,
                    data.value._id
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                console.log('🍵[data]:', data);

                if (data) {
                    this.changeStatusRepaire(this.selectedDi);
                }
            });
    }
}
