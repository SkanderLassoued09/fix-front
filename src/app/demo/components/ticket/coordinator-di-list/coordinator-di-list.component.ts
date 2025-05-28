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
import { PageEvent } from '../../profile/profile-list/profile-list.interfaces';
import { NotificationService } from 'src/app/demo/service/notification.service';
import { map } from 'rxjs';

@Component({
    selector: 'app-coordinator-di-list',

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
        { field: 'title', header: 'Title' },
        { field: 'status', header: 'Status' },
        { field: 'client_id', header: 'Client' },
        { field: 'company_id', header: 'Company' },
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
    selectedDiLocation: any;
    selectedTechDiagModel: null;
    isConfirmed: any;
    first: number = 0;
    rows: number = 10;
    modalRetour1Info: boolean = false;
    modalRetour2Info: boolean = false;
    modalRetour3Info: boolean = false;
    page: any;
    basicOptions: {
        plugins: { legend: { labels: { color: string } } };
        scales: {
            y: {
                beginAtZero: boolean;
                ticks: {
                    color: string;
                    stepSize: number; // Ensures the interval is 1
                    callback: (value: number) => string;
                };
                grid: { color: string; drawBorder: boolean };
            };
            x: {
                ticks: { color: string };
                grid: { color: string; drawBorder: boolean };
            };
        };
    };
    statusCount: any;
    basicData: {
        labels: any;
        datasets: {
            label: string;
            data: any;
            backgroundColor: string[];
            borderColor: string[];
            borderWidth: number;
        }[];
    };
    openBtnConfirm: boolean;
    componentInfo: any;
    componentConfirmedFromCoordinator: any;
    magasinsentToCoordinator: boolean;
    gotComposantFromMagasinCondition: boolean;
    ignoreCount: any;
    ticketData: { data: any; pauseLogs: any; logsDi: any };
    retour1InfoFromLogs: any;
    retour2InfoFromLogs: any;
    retour3InfoFromLogs: any;
    ignoreCountForBtns: number = 0;
    ticketDetailsInfo: boolean;
    techInfo: any;

    constructor(
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private messageservice: MessageService,
        private confirmationService: ConfirmationService,
        private notificationService: NotificationService
    ) {
        // this.roles = ROLES;
    }

    ngOnInit() {
        this.getDi(this.first, this.rows);

        this.getAllTech();
        this.getStatusCount();
        this.confirmationBTN = false;
        this.notificationService.notification$.subscribe((message: any) => {
            console.log('🍻[message]:', message);

            // if (message.array_composants.length > 0) {
            //     this.openBtnConfirm = true;
            //     this.componentInfo = message;
            // }
            if (message) {
                console.log('🍚[message]:', message);
                this.getDi(this.first, this.rows);
                this.getStatusCount();
            }
        });
    }
    diagnosticOpen() {}
    showDialog() {
        this.visible = true;
    }

    onPageChange(event: PageEvent) {
        this.first = event.first;
        this.page = event.page;
        this.rows = event.rows;
        this.getDi(this.first, this.rows);
    }
    getDi(first, rows) {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.getAllDiForCoordinator(first, rows),
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                console.log('🌶[data]:', data);

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
    getStatusCount() {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');
        const textColorSecondary = documentStyle.getPropertyValue(
            '--text-color-secondary'
        );
        const surfaceBorder =
            documentStyle.getPropertyValue('--surface-border');
        this.apollo
            .query<any>({
                query: this.ticketSerice.getStatusCount(),
            })
            .subscribe(({ data }) => {
                if (data) {
                    this.statusCount = data.getStatusCount;
                    this.basicData = {
                        labels: this.statusCount.map((el) => el.status),
                        datasets: [
                            {
                                label: 'Di',
                                data: this.statusCount.map((el) => el.count),
                                backgroundColor: [
                                    'rgba(255, 159, 64, 0.2)',
                                    'rgba(75, 192, 192, 0.2)',
                                    'rgba(54, 162, 235, 0.2)',
                                    'rgba(153, 102, 255, 0.2)',
                                ],
                                borderColor: [
                                    'rgb(255, 159, 64)',
                                    'rgb(75, 192, 192)',
                                    'rgb(54, 162, 235)',
                                    'rgb(153, 102, 255)',
                                ],
                                borderWidth: 1,
                            },
                        ],
                    };
                    this.basicOptions = {
                        plugins: {
                            legend: {
                                labels: {
                                    color: textColor,
                                },
                            },
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: textColorSecondary,
                                    stepSize: 1, // Ensures the interval is 1
                                    callback: (value: number) =>
                                        value.toFixed(0), // Show whole numbers only
                                },
                                grid: {
                                    color: surfaceBorder,
                                    drawBorder: false,
                                },
                            },
                            x: {
                                ticks: {
                                    color: textColorSecondary,
                                },
                                grid: {
                                    color: surfaceBorder,
                                    drawBorder: false,
                                },
                            },
                        },
                    };
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
                        data.getDiById.di.gotComposantFromMagasin;
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
        console.log('🍷[di]:', di);
        this.di = { ...di };
        this.gotComposantFromMagasinCondition = di.gotComposantFromMagasin;
        if (di.logs && di.logs.length > 0) {
            const highestIgnoreLog = di.logs.reduce((prev, current) =>
                prev.idIgnore > current.idIgnore ? prev : current
            );
            this.magasinsentToCoordinator =
                highestIgnoreLog.isSentToCoordinator;
            this.componentConfirmedFromCoordinator =
                highestIgnoreLog.handleSendingNotificationBetweenCoordinatorAndMagasin;
            console.log('highestIgnoreLog', highestIgnoreLog);
        } else {
            this.magasinsentToCoordinator = di.isSentToCoordinator;
            this.componentConfirmedFromCoordinator =
                di.handleSendingNotificationBetweenCoordinatorAndMagasin;
        }

        this.openBtnConfirm = di.isSentToCoordinator;
        this.remarque_manager = di.remarque_manager;
        this.remarque_admin_manager = di.remarque_admin_manager;
        this.remarque_admin_tech = di.remarque_admin_tech;
        this.remarque_tech_diagnostic = di.remarque_tech_diagnostic;
        this.remarque_tech_repair = di.remarque_tech_repair;
        this.remarque_magasin = di.remarque_magasin;
        this.remarque_coordinator = di.remarque_coordinator;
        this.remarqueTech = di.remarqueTech;
        this.selectedDi = di._id;
        this.selectedDiLocation = di.location_id;
        this.ignoreCount = di.ignoreCount;
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

    getLogsDi(_id: string) {
        return this.apollo
            .query<any>({ query: this.ticketSerice.getLogsDi(_id) })
            .toPromise()
            .then(({ data }) => data?.getAllLogsByDi || []);
    }

    getLogsData(_id: string) {
        return this.apollo
            .query<any>({ query: this.ticketSerice.getLogsPause(_id) })
            .pipe(map(({ data }) => data?.getStatByIdlogs || []));
    }

    openTicketDetails(data: any) {
        Promise.all([
            this.getLogsDi(data._id),
            this.getLogsData(data._id).toPromise(),
        ])
            .then(([logsDi, pauseLogs]) => {
                this.ticketData = {
                    data: { ...data },
                    pauseLogs: { ...pauseLogs },
                    logsDi: { ...logsDi },
                };
                console.log(data, 'dtatatatata');
                console.log(pauseLogs, 'pauseLogs');
                console.log(logsDi, 'logsDi');

                if (data.ignoreCount >= 1) {
                    this.retour1InfoFromLogs = logsDi[0];
                }
                if (data.ignoreCount >= 2) {
                    this.retour2InfoFromLogs = logsDi[1];
                }
                if (data.ignoreCount >= 3) {
                    this.retour3InfoFromLogs = logsDi[2];
                }

                this.ignoreCountForBtns = data.ignoreCount;
                console.log(data.ignoreCount, 'ignoreCountignoreCount');

                this.ticketDetailsInfo = true; // Open the dialog
                console.log('data inside =>', this.ticketData.data);
                this.techInfo = { ...pauseLogs };
                console.log('data inside =>', this.techInfo);
            })
            .catch((error) => {
                console.error('Error fetching logs:', error);
            });
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

    // createLogDi(selectedDi) {
    //     console.log('create logs fired');
    //     this.apollo
    //         .mutate<any>({
    //             mutation: this.ticketSerice.createLogDi(selectedDi),
    //             useMutationLoading: true,
    //         })
    //         .subscribe(({ data }) => {
    //             if (data) {
    //                 console.log('🥜[data]:', data);
    //             }
    //         });
    // }

    sendDiToDiag(selectedDi, dataId, selectedDiLocation) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.sendingDiForDiagnostic(
                    selectedDi,
                    dataId,
                    selectedDiLocation
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
                            this.getDi(this.first, this.rows);
                            console.log('🥪 emit');
                        });
                    this.diDialog = false;
                    this.selectedTechDiagModel = null;
                    console.log('emitter');

                    this.messageservice.add({
                        severity: 'success',
                        summary: 'Success',
                        detail: `DI Envoyer au technicien`,
                    });
                }
            });
    }
    selectedTechDiag(data) {
        console.log('slected tech for diagnostic');
        this.confirmationService.confirm({
            message: 'Voulez vous confirmer ce Technicien',
            header: 'Confirmation Diagnostique',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.sendDiToDiag(
                    this.selectedDi,
                    data.value._id,
                    this.selectedDiLocation
                );
            },
        });
    }

    selectedTechRep(data) {
        console.log('select tech for rep');
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
                            this.getDi(this.first, this.rows);
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
                            this.getDi(this.first, this.rows);
                            this.diDialog = false;
                        }
                    });
            },
        });
    }

    gotcomposantfromMagasin() {
        this.confirmationService.confirm({
            message: 'Confirmer les composants',
            header: 'Confirmation Magasin',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation:
                            this.ticketSerice.componentConfirmedFromCoordinator(
                                this.di._id
                            ),
                    })
                    .subscribe(({ data }) => {
                        if (data) {
                            console.log('🌯[data]:', data);
                            this.componentConfirmedFromCoordinator =
                                data.componentConfirmedFromCoordinator.handleSendingNotificationBetweenCoordinatorAndMagasin;
                            this.getDi(this.first, this.rows);
                            this.diDialog = false;
                            this.reperationCondition = true;
                        }
                    });
            },
        });
    }

    sendRequestToMagasin() {
        console.log(' this.selectedDi', this.selectedDi);
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.confirmComposant(
                    this.selectedDi,
                    'CONFIRM'
                ),
            })
            .subscribe(({ data }) => {
                if (data) {
                    console.log('🎂[data]:', data);
                    this.isConfirmed =
                        data.confirmationComposant.confirmationComposant;
                    console.log('🍰[this.isConfirmed]:', this.isConfirmed);
                }
            });
    }
}
