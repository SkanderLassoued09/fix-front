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
import { ConfirmationService, MessageService } from 'primeng/api';
import { ImageModule } from 'primeng/image';
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
    rangeDates: Date[] | undefined;

    selectedTech: any; // Variable to store the selected tech data

    //--
    //Btn for confirmation
    confirmationBTN = false;
    loading: boolean = false;
    roles;
    tstatuses = [{ label: 'Pending3', value: 'Pending3' }];
    // Used for the mini Dashboard
    counterInMagasin = 0;
    counterInDiagnostique = 0;
    counterInReperation = 0;
    counterPending = 0;
    counterRetour = 0;

    uploadedFiles: any[] = [];
    cols = [
        { field: '_id', header: 'ID' },
        { field: 'title', header: 'Title' },

        { field: 'status', header: 'Status' },
        { field: 'client_id', header: 'Client' },

        { field: 'createdBy', header: 'Cree par' },
        { field: 'location_id', header: 'Location' },
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
    reperationCondition: boolean;
    remarque_manager: string;
    remarque_admin_manager: string;
    remarque_admin_tech: string;
    remarque_tech_diagnostic: string;
    remarque_tech_repair: string;
    remarque_magasin: string;
    remarque_coordinator: string;
    remarqueTech: string;
    constructor(
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private messageservice: MessageService,
        private confirmationService: ConfirmationService
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
                    // counter for Mini Dashboard
                    this.diList.filter((di) => {
                        switch (di.status) {
                            case 'INMAGASIN':
                            case 'MagasinEstimation':
                                this.counterInMagasin =
                                    this.counterInMagasin + 1;
                                break;
                            case 'DIAGNOSTIC':
                            case 'INDIAGNOSTIC':
                            case 'DIAGNOSTIC_Pause':
                                this.counterInDiagnostique =
                                    this.counterInDiagnostique + 1;
                                break;
                            case 'REPARATION':
                            case 'INREPARATION':
                            case 'REPARATION_Pause':
                                this.counterInReperation =
                                    this.counterInReperation + 1;
                                break;
                            case 'PENDING1':
                            case 'PENDING2':
                            case 'PENDING3':
                                this.counterPending = this.counterPending + 1;
                                break;
                            case 'RETOUR1':
                            case 'RETOUR2':
                            case 'RETOUR3':
                                this.counterRetour = this.counterRetour + 1;
                                break;
                            default:
                                break;
                        }
                    });
                }
            });
    }
    getReperationCoordinatorCondition() {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.getReperationCoordinatorCondition(
                    this.selectedDi
                ),
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.reperationCondition =
                        data.getDiById.gotComposantFromMagasin;
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
    //!Adding rq
    openModalConfig(di) {
        this.di = { ...di };
        this.remarque_manager = di.remarque_manager;
        this.remarque_admin_manager = di.remarque_admin_manager;
        this.remarque_admin_tech = di.remarque_admin_tech;
        this.remarque_tech_diagnostic = di.remarque_tech_diagnostic;
        this.remarque_tech_repair = di.remarque_tech_repair;
        this.remarque_magasin = di.remarque_magasin;
        this.remarque_coordinator = di.remarque_coordinator;
        this.remarqueTech = di.remarqueTech;
        this.selectedDi = di._id;
        this.diDialog = true;
        this.getReperationCoordinatorCondition();

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
            .subscribe(({ data, loading }) => {});
    }
    //!HERE
    selectedTechDiag(data) {
        this.confirmationService.confirm({
            message: 'Voulez vous confirmer ce Technicien',
            header: 'Confirmation Diagnostique',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.sendingDiForDiagnostic(
                            this.selectedDi,
                            data.value._id
                        ),
                        useMutationLoading: true,
                    })
                    .subscribe(({ data, loading, errors }) => {
                        if (data) {
                            this.apollo
                                .mutate<TechStartDiagnosticMutationResponse>({
                                    mutation:
                                        this.ticketSerice.changeStatusDiToDiagnostique(
                                            this.selectedDi
                                        ),
                                    useMutationLoading: true,
                                })
                                .subscribe(({ data, loading }) => {
                                    this.getDi();
                                });
                            this.diDialog = false;
                            this.messageservice.add({
                                severity: 'success',
                                summary: 'Success',
                                detail: `DI Envoyer au technicien`,
                            });
                        }
                    });
            },
        });
    }

    selectedTechRep(data) {
        this.confirmationService.confirm({
            message: 'Voulez vous confirmer le Technicien',
            header: 'Confirmation Réperation',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
                    .mutate<ConfigRepAffectationMutationResponse>({
                        mutation: this.ticketSerice.configRepAffectation(
                            this.selectedDi,
                            data.value._id
                        ),
                        useMutationLoading: true,
                    })
                    .subscribe(({ data, loading, errors }) => {
                        if (data) {
                            this.changeStatusRepaire(this.selectedDi);
                            this.getDi();
                            this.diDialog = false;
                        }
                    });
            },
        });
    }

    changestatusToPricing(data) {
        this.confirmationService.confirm({
            message: "Envoyer aux admins pour l'affectation de prix",
            header: "Confirmation d'envoie",
            icon: 'pi pi-question-circle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.changeStatusPricing(
                            this.di._id
                        ),
                    })
                    .subscribe(({ data }) => {
                        if (data) {
                            this.getDi();
                            this.diDialog = false;
                        }
                    });
            },
        });
    }

    gotcomposantfromMagasin() {
        this.confirmationService.confirm({
            message: 'Voulez vous confirmer les changements',
            header: 'Confirmation Magasin',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.confirmerRecoitComposant(
                            this.di._id
                        ),
                    })
                    .subscribe(({ data }) => {
                        if (data) {
                            this.getDi();
                            this.diDialog = false;
                            this.reperationCondition = true;
                        }
                    });
            },
        });
    }
}
