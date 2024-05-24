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
import { MessageService } from 'primeng/api';

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

    selectedTech: any; // Variable to store the selected tech data

    //--
    //Btn for confirmation
    confirmationBTN = false;
    loading: boolean = false;
    roles;
    tstatuses = [{ label: 'Pending3', value: 'Pending3' }];

    uploadedFiles: any[] = [];
    cols = [
        { field: '_id', header: 'ID' },
        { field: 'title', header: 'Title' },
        // { field: 'description', header: 'Description' },
        // { field: 'can_be_repaired', header: 'Reparable' },
        // { field: 'bon_de_commande', header: 'BC' },
        // { field: 'bon_de_livraison', header: 'BL' },
        // { field: 'contain_pdr', header: 'PDR' },
        { field: 'status', header: 'Status' },
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

    constructor(
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private messageservice: MessageService
    ) {
        // this.roles = ROLES;
    }

    ngOnInit() {
        this.getDi();
        this.getAllTech();
        this.confirmationBTN = false;
    }
    diagnosticOpen() {}
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
            case 'CREATED':
                return 'success';
            case 'PENDING1':
            case 'PENDING2':
            case 'PENDING3':
                return 'help';
            case 'DIAGNOSTIC':
            case 'INDIAGNOSTIC':
                return 'info';
            case 'INMAGASIN':
            case 'MagasinEstimation':
                return 'warning';
            case 'PRICING':
                return 'warning';
            case 'NEGOTIATION1':
            case 'NEGOTIATION2':
                return 'warning';
            case 'REPARATION':
            case 'INREPARATION':
                return 'info';
            case 'FINISHED':
                return 'success';
            case 'ANNULER':
                return 'contrast';
            case 'RETOUR1':
            case 'RETOUR2':
            case 'RETOUR3':
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

    //TODO The di is send to the tech but the status doesn't change & Fire the mutation when the confime Btn is pressed
    async selectedTechDiag(data) {
        console.log('🥟[selected]:', data);
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.sendingDiForDiagnostic(
                    this.selectedDi,
                    data.value._id
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                console.log('🍻[data]:', data);
                if (data) {
                    console.log(data, 'data for notification to work ');
                    {
                        this.apollo
                            .mutate<TechStartDiagnosticMutationResponse>({
                                mutation:
                                    this.ticketSerice.changeStatusDiToDiagnostique(
                                        this.selectedDi
                                    ),
                                useMutationLoading: true,
                            })
                            .subscribe(({ data, loading }) => {
                                console.log(
                                    "data coming from mutation that don't work",
                                    data
                                );
                            });
                    }
                    this.diDialog = false;
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
    changestatusToPricing(data) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusPricing(this.di._id),
            })
            .subscribe(({ data }) => {
                console.log('🍑[pricing change]:', data);
            });
    }
}
