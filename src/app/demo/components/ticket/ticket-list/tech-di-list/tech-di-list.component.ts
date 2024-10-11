import { ChangeDetectorRef, Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TicketService } from 'src/app/demo/service/ticket.service';
import {
    ConfigDiagAffectationMutationResult,
    ConfigRepAffectationMutationResult,
    DiListTechQueryResult,
} from './tech-di-list.interface';
import { CreateComposantMutationResult } from './tech-di-list-interface';
import { NotificationService } from 'src/app/demo/service/notification.service';
import { PageEvent } from '../../../profile/profile-list/profile-list.interfaces';

@Component({
    selector: 'app-tech-di-list',
    templateUrl: './tech-di-list.component.html',
    styleUrl: './tech-di-list.component.scss',
})
export class TechDiListComponent {
    selectedComposants: any[] = [];
    diagFormTech = new FormGroup({
        _idDi: new FormControl(),
        diag_time: new FormControl(),
        remarqueTech: new FormControl(''),
        isPdr: new FormControl(false),
        isReparable: new FormControl(false),
        quantity: new FormControl(0),
        composantSelectedDropdown: new FormControl(),
        di_category_id: new FormControl('Categorie DI non affecte'),
    });

    composantTechnicien = new FormGroup({
        _idComposant: new FormControl(),
        name: new FormControl(),
        packageComposant: new FormControl(),
        category_composant_id: new FormControl(),
        link: new FormControl(),
        pdf: new FormControl(),
    });
    rangeDates: Date[] | undefined;
    remarque = new FormGroup({
        remarqueRepair: new FormControl(),
    });
    composantTech = {
        name: '',
        package: '',
        link: '',
        category_composant_id: '',
        pdf: '',
    };

    visible: boolean = false;
    loading: boolean = false;
    roles;
    tstatuses = [{ label: 'Pending3', value: 'Pending3' }];

    ingredient;

    uploadedFiles: any[] = [];
    cols = [
        { field: '_idDi', header: 'ID' },
        { field: 'status', header: 'Status' },
        { field: 'location_id', header: 'Emplacement' },
    ];
    payloadImage: { image: string };
    countries;
    selectedCountry;
    diList: any;
    diListCount: any;
    diDialog: boolean = false;
    di: any;
    techList: any;
    selectedDi: any;
    isRunning: any;
    startTime: number;
    minutes: string;
    seconds: string;
    milliseconds: string;
    lapTime: string;
    laps: any[];
    // diDialogDiag: boolean;
    diDialogDiag: { [key: string]: boolean } = {};
    diDialogRep: boolean;
    composant: any;
    addComposantLoading: boolean;
    composantList: Array<any> = [];
    composantSelected: any;
    composantCombo: Array<{ nameComposant: string; quantity: number }> = [];
    selectedDi_id: any;
    initialOffset: number;
    isFinishedDiag: { [key: string]: boolean } = {};
    isFinishedRep: { [key: string]: boolean } = {};

    milliseconds1: string;
    seconds1: string;
    minutes1: string;
    lapTime1: string;
    isRunning1: boolean;
    startTime1: number;
    laps1: any[];

    formGroupchips: any;
    chipsValues: string[] = [];
    submitted: boolean = false;
    composantDialog: boolean = false;
    creatComposantDialog: any;
    product: {};
    diStatus: any;
    // FOR THE CONDITION OF THE BTN
    diagnostiquefinishedFLAG: boolean = true;
    reperationfinishedFLAG: boolean = true;
    DiByStat: any;
    loadingCreatingComposant: boolean;
    hasPdr: boolean;
    isReperable: boolean;
    remarque_manager: string;
    remarque_admin_manager: string;
    remarque_admin_tech: string;
    remarque_tech_diagnostic: string;
    remarque_magasin: string;
    remarque_coordinator: string;
    remarqueReparation: any;
    statusFinal: any;
    disable: any;
    imageValue: string;
    selectedRow: any;
    newStatRealTime: any;
    techDataInfo: any;

    //! MINI Dashboard variables here
    // Diag variables
    diagEnPause_miniDashboard: number = 0;
    diagNotOpened_miniDashboard: number = 0;
    // Rep variables
    repEnPause_miniDashboard: number = 0;
    repNotOpened_miniDashboard: number = 0;
    // Retour variables
    retour1_miniDashboard: number = 0;
    retour2_miniDashboard: number = 0;
    retour3_miniDashboard: number = 0;
    //Admnistration
    admnistration_miniDashboard: number = 0;
    detailsDi: any;
    categorieDiListDropDown: any;
    remarqueReparationnn: any;
    //to delet just exemple
    dataBarChart: any;
    options: any;
    dataBarChartIsReady: boolean = false;
    optionsPieChart: {
        plugins: { legend: { labels: { color: string } } };
        scales: { r: { grid: { color: string } } };
    };
    dataPieChart: {
        datasets: {
            data: number[];
            backgroundColor: string[];
            label: string;
        }[];
        labels: string[];
    };

    first: number = 0;
    rows: number = 10;
    page: any;
    techListCount: any;
    constructor(
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
        private notificationService: NotificationService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit() {
        this.getAllTechDi(this.first, this.rows);
        this.getComposant();
        this.checkValueChanges();
        this.checkValueChangesReperable();
        this.getDataForTech();
        this.barChart();

        this.notificationService.notification$.subscribe((message: any) => {
            if (message) {
                console.log('🥒[message]:', message);
                this.techList.push(message);
            }
        });
    }

    barChart() {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');
        const textColorSecondary = documentStyle.getPropertyValue(
            '--text-color-secondary'
        );
        const surfaceBorder =
            documentStyle.getPropertyValue('--surface-border');

        this.options = {
            maintainAspectRatio: false,
            aspectRatio: 0.8,
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                },
                legend: {
                    labels: {
                        color: textColor,
                    },
                },
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        color: textColorSecondary,
                    },
                    grid: {
                        color: surfaceBorder,
                        drawBorder: false,
                    },
                },
                y: {
                    stacked: true,
                    ticks: {
                        color: textColorSecondary,
                    },
                    grid: {
                        color: surfaceBorder,
                        drawBorder: false,
                    },
                },
            },
            skipNull: true,
        };
        this.dataBarChart = {
            // Use input data if provided
            labels: ['Diagnostic', 'Reperation', 'Retour', 'Admnistration'],
            //data for MiniDash
            /**
 
    
    
    
    
    // Retour variables
    retour1_miniDashboard
    retour2_miniDashboard
    retour3_miniDashboard
    //Admnistration
    admnistration_miniDashboard
             */

            datasets: [
                {
                    type: 'bar',
                    label: 'Diagnostic-Pause',
                    backgroundColor:
                        documentStyle.getPropertyValue('--blue-500'),
                    data: [this.diagEnPause_miniDashboard],
                },

                {
                    type: 'bar',
                    label: 'Diagnostic-nonOuvert',
                    backgroundColor:
                        documentStyle.getPropertyValue('--blue-200'),
                    data: [this.diagNotOpened_miniDashboard],
                },
                {
                    type: 'bar',
                    label: 'Reperation-Pause',
                    backgroundColor:
                        documentStyle.getPropertyValue('--green-500'),
                    data: [null, this.repEnPause_miniDashboard],
                },
                {
                    type: 'bar',
                    label: 'Reperation-NonOuvert',
                    backgroundColor:
                        documentStyle.getPropertyValue('--green-200'),
                    data: [, this.repNotOpened_miniDashboard],
                },
            ],
        };

        //PIE CHART
        this.dataPieChart = {
            datasets: [
                {
                    data: [
                        this.diagEnPause_miniDashboard,
                        this.diagNotOpened_miniDashboard,
                        this.repEnPause_miniDashboard,
                        this.repNotOpened_miniDashboard,
                        this.retour1_miniDashboard +
                            this.retour2_miniDashboard +
                            this.retour3_miniDashboard,
                        this.admnistration_miniDashboard,
                    ],
                    backgroundColor: [
                        documentStyle.getPropertyValue('--blue-500'),
                        documentStyle.getPropertyValue('--blue-100'),
                        documentStyle.getPropertyValue('--green-500'),
                        documentStyle.getPropertyValue('--green-100'),
                        documentStyle.getPropertyValue('--red-500'),
                        documentStyle.getPropertyValue('--yellow-500'),
                    ],
                    label: 'Di Tech',
                },
            ],
            labels: [
                'Diagnostic Pause',
                'Diagnostic non ouvert',
                'Reperation Pause',
                'Reperation non ouvert',
                'Retour',
                'Admnistration',
            ],
        };

        this.optionsPieChart = {
            plugins: {
                legend: {
                    labels: {
                        color: textColor,
                    },
                },
            },
            scales: {
                r: {
                    grid: {
                        color: surfaceBorder,
                    },
                },
            },
        };
    }

    closeComposantModal() {
        this.creatComposantDialog = false;
    }
    saveNewComposant() {
        //NEW FILE HERE "pdf"
        const { name, packageComposant, category_composant_id, link, pdf } =
            this.composantTechnicien.value;

        this.apollo
            .mutate<CreateComposantMutationResult>({
                mutation: this.ticketSerice.createComposantByTech(
                    name,
                    packageComposant,
                    category_composant_id,
                    link,
                    this.payloadImage.image
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                this.loadingCreatingComposant = loading;

                if (data) {
                    this.getComposant();
                    this.composantTechnicien.reset();
                    this.creatComposantDialog = false;
                }
            });
    }
    selctedDropDownComposantTech() {}
    //! end here

    showDialog() {
        this.visible = true;
    }
    //Todo when you query the data add the status of the DI so we can use it for the Btn's condition
    onPageChange(event: PageEvent) {
        this.first = event.first;
        this.page = event.page;
        this.rows = event.rows;
        this.getAllTechDi(this.first, this.rows);
    }
    getAllTechDi(first, rows) {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.diListTech(first, rows),
                useInitialLoading: true,
            })
            .valueChanges.subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.techList = data.getDiForTech.stat;
                    console.log('🥧[ this.techList]:', this.techList);
                    this.techListCount = data.getDiForTech.totalTechDataCount;
                }
            });
    }
    handleNotification(message: any) {
        // Assuming message contains the item to be added to techList
        if (message && message.event === 'sendDitoDiagnostique') {
            this.techList.push(message); // Add the received message to the tech list
        }
    }
    load() {
        this.loading = true;
        setTimeout(() => {
            this.loading = false;
        }, 2000);
    }

    getImage() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getImageforDI(this.selectedDi_id),
            })
            .subscribe(({ data }) => {
                if (data) {
                    this.imageValue = data.getDiById.image;
                }
            });
    }

    // getDiById(_id: string): Promise<any> {
    //     return new Promise((resolve, reject) => {
    //         this.apollo
    //             .query<any>({ query: this.ticketSerice.getDiById(_id) })
    //             .subscribe(
    //                 ({ data }) => {
    //
    //                     if (data) {
    //                         resolve(data.getDiById);
    //                     } else {
    //                         reject('No data found');
    //                     }
    //                 },
    //                 (error) => {
    //                     reject(error);
    //                 }
    //             );
    //     });
    // }

    // Helper method to reset the modal form before loading new data
    resetModalForm() {
        this.diagFormTech.reset(); // Reset the form to clear any previous data
        this.di = null; // Reset the selected DI
    }

    resetModalFormRep() {
        this.remarque.reset(); // Reset the form to clear any previous data
        this.di = null; // Reset the selected DI
    }

    async diagModal(di) {
        this.allCategoryDi();
        // Reset form and modal data
        this.resetModalForm();

        // Fetch the details from the backend
        this.apollo
            .query<any>({
                query: this.ticketSerice.getDiById(di._idDi),
            })
            .subscribe(({ data }) => {
                if (data) {
                    const detailsDi = data.getDiById;

                    // Patch the form with the new data
                    this.diagFormTech.patchValue({
                        _idDi: di._id,
                        diag_time: di.diag_time || detailsDi.diag_time || '',
                        remarqueTech:
                            di.remarqueTech ||
                            detailsDi.remarque_tech_diagnostic ||
                            '',
                        isPdr: di.isPdr || detailsDi.contain_pdr || false,
                        isReparable:
                            di.isReparable ||
                            detailsDi.can_be_repaired ||
                            false,
                        quantity: di.quantity || 0,
                        composantSelectedDropdown:
                            di.composantSelectedDropdown || null,
                    });
                }

                // Open the modal after data is fetched
                this.diDialogDiag[di._id] = true;
            });

        // Set selected DI and status
        this.di = { ...di };
        this.selectedDi = di._id;
        this.selectedDi_id = di._idDi;
        this.diStatus = di.status;

        // Perform other tasks
        this.changeStatus(di._idDi);
        this.getTimeSpent(di._id);
        this.getImage();
        this.getAllRemarque(di._idDi);
    }

    repModal(di) {
        // -----------
        this.apollo
            .query<any>({
                query: this.ticketSerice.getDiById(di._idDi),
            })
            .subscribe(({ data }) => {
                if (data) {
                    const detailsDi = data.getDiById;

                    // Patch the form with the new data
                    this.remarque.patchValue({
                        remarqueRepair:
                            di.remarque_tech_repair ||
                            detailsDi.remarque_tech_repair ||
                            '',
                    });
                }
            });
        // -----------
        this.di = { ...di };
        this.resetModalForm();
        this.selectedDi = di._id;
        this.diDialogRep = true;
        this.getTimeSpentRep(di._id);
        this.changeStatusInReparation(di._id);
        this.getAllRemarque(di._idDi);
        this.apollo
            .query<any>({
                query: this.ticketSerice.getStatbyID(this.selectedDi),
            })
            .subscribe(({ data }) => {
                if (data) {
                    this.DiByStat = data.getStatbyID._idDi;
                }
            });
    }

    getAllRemarque(_id) {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getAllRemarque(_id),
            })
            .subscribe(({ data }) => {
                if (data) {
                    this.remarque_manager =
                        data.getAllRemarque.remarque_manager;
                    this.remarque_admin_manager =
                        data.getAllRemarque.remarque_admin_manager;
                    this.remarque_admin_tech =
                        data.getAllRemarque.remarque_admin_tech;
                    this.remarque_tech_diagnostic =
                        data.getAllRemarque.remarque_tech_diagnostic;
                    this.remarque_magasin =
                        data.getAllRemarque.remarque_magasin;
                    this.remarque_coordinator =
                        data.getAllRemarque.remarque_coordinator;
                }
            });
    }

    hideDialogDiag() {
        this.diDialogDiag[this.selectedDi] = false; // Open modal for this row by ID        this.diStatus = di.status;
    }
    hideDialogRep() {
        this.diDialogRep = false;
    }

    btnConditionReperation() {
        if (
            this.diStatus === 'REPARATION' ||
            this.diStatus === 'INREPARATION'
        ) {
            this.reperationfinishedFLAG = false;
        }
    }

    selectedTechDiag(data) {
        this.apollo
            .mutate<ConfigDiagAffectationMutationResult>({
                mutation: this.ticketSerice.configDiagAffectation(
                    this.selectedDi,
                    data.value._id
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {});
    }
    selectedTechRep(data) {
        this.apollo
            .mutate<ConfigRepAffectationMutationResult>({
                mutation: this.ticketSerice.configRepAffectation(
                    this.selectedDi,
                    data.value._id
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {});
    }

    changeStatus(_id) {
        this.apollo
            .mutate<Boolean>({
                mutation: this.ticketSerice.changeStatusDiToInDiagnostique(_id),
            })
            .subscribe(({ data, loading }) => {});
    }

    changeStatusInReparation(_id) {
        this.apollo
            .mutate<Boolean>({
                mutation: this.ticketSerice.changeStatusInRepair(_id),
            })
            .subscribe(({ data, loading }) => {});
    }

    // handling stopwatch
    /**
     * --------------------------
     */

    startStopwatch() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.startTime = Date.now() - this.initialOffset;
            this.updateTimer();
        } else {
            this.isRunning = false;
        }
    }
    startStopwatch1() {
        if (!this.isRunning1) {
            this.isRunning1 = true;
            this.startTime1 = Date.now() - this.initialOffset;
            this.updateTimer1();
        } else {
            this.isRunning1 = false;
        }
    }

    updateTimer() {
        if (this.isRunning) {
            const elapsedTime = Date.now() - this.startTime;
            this.minutes = this.padZero(
                Math.floor(elapsedTime / (1000 * 60 * 60))
            );
            this.seconds = this.padZero(
                Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60))
            );
            this.milliseconds = this.padZero(
                Math.floor((elapsedTime % (1000 * 60)) / 1000)
            );

            requestAnimationFrame(() => this.updateTimer());
        }
    }
    updateTimer1() {
        if (this.isRunning1) {
            const elapsedTime = Date.now() - this.startTime1;
            this.minutes1 = this.padZero(
                Math.floor(elapsedTime / (1000 * 60 * 60))
            );
            this.seconds1 = this.padZero(
                Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60))
            );
            this.milliseconds1 = this.padZero(
                Math.floor((elapsedTime % (1000 * 60)) / 1000)
            );

            requestAnimationFrame(() => this.updateTimer1());
        }
    }

    lap() {
        if (this.isRunning) {
            this.lapTime = ` ${this.minutes}:${this.seconds}:${this.milliseconds}`;
        }
    }

    lap1() {
        if (this.isRunning1) {
            this.lapTime1 = ` ${this.minutes1}:${this.seconds1}:${this.milliseconds1}`;
        }
    }

    reset() {
        this.minutes = '00';
        this.seconds = '00';
        this.milliseconds = '00';
        this.isRunning = false;
        this.startTime = 0;
        this.initialOffset = 0;
        this.startTime1 = 0;
        this.laps = [];
    }
    reset1() {
        this.minutes1 = '00';
        this.seconds1 = '00';
        this.milliseconds1 = '00';
        this.isRunning1 = false;
        this.startTime1 = 0;
        this.startTime1 = 0;
        this.laps1 = [];
    }

    padZero(value: number): string {
        return value.toString().padStart(2, '0');
    }

    setInitialTime(timeString: string) {
        const [minutes, seconds, milliseconds] = timeString
            .split(':')
            .map(Number);
        this.initialOffset =
            minutes * 60 * 60 * 1000 +
            seconds * 60 * 1000 +
            milliseconds * 1000;
        this.minutes = this.padZero(minutes);
        this.seconds = this.padZero(seconds);
        this.milliseconds = this.padZero(milliseconds);
    }
    setInitialTime1(timeString: string) {
        const [minutes, seconds, milliseconds] = timeString
            .split(':')
            .map(Number);
        this.initialOffset =
            minutes * 60 * 60 * 1000 +
            seconds * 60 * 1000 +
            milliseconds * 1000;
        this.minutes1 = this.padZero(minutes);
        this.seconds1 = this.padZero(seconds);
        this.milliseconds1 = this.padZero(milliseconds);
    }
    // ------------
    getComposant() {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.getAllComposant(),
            })
            .valueChanges.subscribe(({ data }) => {
                if (data) {
                    this.composantList = data.findAllComposant;
                }
            });
    }
    //!!!!!!!!! open modal for composant creation
    openNew() {
        this.creatComposantDialog = true;
    }
    deleteSelectedProducts(): void {
        this.confirmationService.confirm({
            message: 'Voulez vous supprimer ce composant de la liste',
            header: 'Confirm',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.composantCombo = this.composantCombo.filter(
                    (val) => !this.selectedComposants.includes(val)
                );

                this.selectedComposants = [];
                this.messageService.add({
                    severity: 'success',
                    summary: 'Successful',
                    detail: 'Products Deleted',
                    life: 1000,
                });
            },
        });
    }

    onRowClick(composant: any): void {
        // Additional logic for the clicked row can be added here
        const index = this.composantCombo.findIndex((el) => {
            el.nameComposant === composant.nameComposant;
        });
        this.composantCombo.splice(index, 1);
    }

    createComposant() {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.createComposant(this.composant),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                this.addComposantLoading = loading;
                if (data) {
                    let com = {
                        _id: data.createComposant._id,
                        name: data.createComposant.name,
                    };
                    this.composantList.push(com);
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Success',
                        detail: `Le composant ${data.createComposant.name} ajouté avec succes`,
                    });
                }
            });
    }

    /**
     * This function will get the lap time and save it in stats entity
     * will get the lap as pause time save it only he can back to this ticket again and make the counter start again on the last time saved and continue incrementing
     *!When user click on finish diag and status changed the button would be frozen!
     */

    lapTimeForPauseAndGetBack() {
        // Gather the form values
        const formValues = {
            _idDi: this.selectedDi_id,
            pdr: this.diagFormTech.get('isPdr')?.value,
            reparable: this.diagFormTech.get('isReparable')?.value,
            remarqueTech: this.diagFormTech.get('remarqueTech')?.value,
            composant: this.composantCombo,
        };

        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.finish(formValues),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                if (data) {
                }
            });
        // for diag
        this.lap();
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.lapTimeForPauseAndGetBack(
                    this.selectedDi,
                    this.lapTime
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.diDialogDiag[this.selectedDi] = false;
                }
            });

        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.diDiagnostiqueInPAUSE(
                    this.selectedDi_id
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                if (data) {
                    // if data exist affect it to html
                }
            });

        this.startStopwatch();
    }

    getDataForTech() {
        this.apollo
            .watchQuery<any>({
                // Pass data got from inputs date
                query: this.ticketSerice.getDataForTech(),
            })
            .valueChanges.subscribe(({ data, loading }) => {
                if (data) {
                    this.dataBarChartIsReady = true;
                    this.techDataInfo = data.getDiStatusCounts;

                    // Initialize the dashboard variables
                    this.diagEnPause_miniDashboard = 0;
                    this.diagNotOpened_miniDashboard = 0;
                    this.repNotOpened_miniDashboard = 0;
                    this.repEnPause_miniDashboard = 0;
                    this.retour1_miniDashboard = 0;
                    this.retour2_miniDashboard = 0;
                    this.retour3_miniDashboard = 0;
                    this.admnistration_miniDashboard = 0;

                    this.techDataInfo.forEach((item) => {
                        switch (item.status) {
                            case 'DIAGNOSTIC_Pause':
                                this.diagEnPause_miniDashboard += item.count;
                                break;
                            case 'DIAGNOSTIC':
                                this.diagNotOpened_miniDashboard += item.count;
                                break;
                            case 'REPARATION':
                                this.repNotOpened_miniDashboard += item.count;
                                break;
                            case 'REPARATION_Pause':
                                this.repEnPause_miniDashboard += item.count;
                                break;
                            case 'RETOUR1':
                                this.retour1_miniDashboard += item.count;
                                break;
                            case 'RETOUR2':
                                this.retour2_miniDashboard += item.count;
                                break;
                            case 'RETOUR3':
                                this.retour3_miniDashboard += item.count;
                                break;
                            default:
                                this.admnistration_miniDashboard += item.count;
                                break;
                        }
                    });

                    // Call the barChart function after processing the data
                    this.barChart();
                }
            });
    }
    selectedDropDown(selectedItem) {
        this.composantSelected = selectedItem;
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
    comboComposantandQuantity() {
        let composantSelected = {
            nameComposant: this.composantSelected.value.name,
            quantity: this.diagFormTech.value.quantity,
        };

        this.composantCombo.push(composantSelected);
    }

    changeStatusMagasinEstimation(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusMagasinEstimation(_id),
            })
            .subscribe(({ data, loading }) => {
                if (data && !loading) {
                    if (!this.isFinishedDiag) {
                        this.isFinishedDiag = {};
                    }

                    this.isFinishedDiag[_id] = true;
                }
            });
    }
    //!Tech finishing Diagnostique here
    techFinishDiag() {
        this.confirmationService.confirm({
            message: 'Voulez vous confirmer les changements',
            header: 'Confirmation Diagnostique',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                // this.lapTimeForPauseAndGetBack();

                const dataDiag = {
                    _idDi: this.selectedDi_id,
                    pdr: this.diagFormTech.value.isPdr,
                    reparable: this.diagFormTech.value.isReparable,
                    remarqueTech: this.diagFormTech.value.remarqueTech,
                    composant: this.composantCombo,
                };

                if (dataDiag.pdr) {
                    this.apollo
                        .mutate<any>({
                            mutation: this.ticketSerice.finish(dataDiag),
                            useMutationLoading: true,
                        })
                        .subscribe(({ data, loading }) => {
                            if (data) {
                                this.disable = data.tech_startDiagnostic;
                                this.cdr.detectChanges();
                                this.changeStatusMagasinEstimation(
                                    dataDiag._idDi
                                );
                            }
                        });
                } else {
                    this.apollo
                        .mutate<any>({
                            mutation: this.ticketSerice.finish(dataDiag),
                            useMutationLoading: true,
                        })
                        .subscribe(({ data, loading }) => {
                            if (data) {
                                this.disable = data.tech_startDiagnostic;
                                this.cdr.detectChanges();

                                this.changeStatusToPending2(dataDiag._idDi);
                            }
                        });
                }
                this.getAllTechDi(this.first, this.rows);
                this.diDialogDiag[this.selectedDi] = false; // Open modal for this row by ID
            },
        });
    }

    changeStatusToPending2(_id) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusDiToPending2(_id),
            })
            .subscribe(({ data }) => {});
    }
    confirmComposant() {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.responseConfirmerRecoitComposant(
                    this.selectedDi
                ),
            })
            .subscribe(({ data }) => {});
    }
    // this function to get the time spênt oif this ticket will be called in opening modal function
    getTimeSpent(_idStat: string) {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.getLastPauseTime(_idStat),
            })
            .valueChanges.subscribe(({ data }) => {
                if (
                    data &&
                    data.getLastPauseTime.diag_time &&
                    this.isValidTimeFormat(data.getLastPauseTime.diag_time)
                ) {
                    this.setInitialTime(data.getLastPauseTime.diag_time);
                    this.startStopwatch();
                } else {
                    this.setInitialTime('00:00:00');
                    this.startStopwatch();
                }
            });
    }
    //! WORKING HERE
    getTimeSpentRep(_idStat: string) {
        this.apollo

            .query<any>({
                query: this.ticketSerice.getLastPauseTime(_idStat),
            })
            .subscribe(({ data }) => {
                if (
                    data &&
                    data.getLastPauseTime.rep_time &&
                    this.isValidTimeFormat(data.getLastPauseTime.rep_time)
                ) {
                    this.setInitialTime1(data.getLastPauseTime.rep_time);
                    this.startStopwatch1();
                } else {
                    this.setInitialTime('00:00:00');
                    this.startStopwatch1();
                }
            });
    }

    isValidTimeFormat(timeString: string): boolean {
        if (!timeString) {
            return false;
        }
        const trimmedTimeString = timeString.trim();
        const regex = /^\d{2}:\d{2}:\d{2}$/;
        const is = regex.test(trimmedTimeString);

        return is;
    }
    techFinishDiag1() {
        const dataDiag = {
            _idDi: this.selectedDi_id,
            pdr: this.diagFormTech.value.isPdr,
            reparable: this.diagFormTech.value.isReparable,
            remarqueTech: this.diagFormTech.value.remarqueTech,
            composant: this.composantCombo,
        };
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.finish(dataDiag),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                if (data) {
                    this.changeStatusMagasinEstimation(dataDiag._idDi);
                }
                this.getAllTechDi(this.first, this.rows);
            });
    }

    getReamrque() {
        console.log('🍾Hello');
        this.remarqueReparationnn = this.remarque.value.remarqueRepair;
    }
    // i stoped here i need to get back when he stops and continue counting when tech click finish froze the butons
    lapTimeForPauseAndGetBack1() {
        console.log('🍫', this.remarque.value.remarqueRepair);
        // for rep
        this.lap1();
        this.resetModalFormRep();

        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.finishReparation(
                    this.DiByStat,
                    this.remarqueReparationnn
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                if (data && !loading && this.DiByStat) {
                }
            });
        this.apollo
            .mutate<any>({
                mutation:
                    this.ticketSerice.lapTimeForPauseAndGetBackForReaparation(
                        this.selectedDi,
                        this.lapTime1
                    ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.diDialogRep = false;
                }
            });

        this.startStopwatch1();
    }

    checkValueChanges() {
        this.diagFormTech.get('isPdr')?.valueChanges.subscribe((value) => {
            this.hasPdr = value;
            // Additional logic based on value changes
        });
    }
    checkValueChangesReperable() {
        this.diagFormTech
            .get('isReparable')
            ?.valueChanges.subscribe((value) => {
                this.isReperable = value;
                // Additional logic based on value changes
            });
    }

    changeStatusToFinished(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeFinishStatus(_id),
            })
            .subscribe(({ data }) => {
                if (data) {
                    this.isFinishedRep[this.DiByStat] = true;
                }
            });
    }
    finishReparation() {
        this.confirmationService.confirm({
            message: 'Voulez vous confirmer les changements',
            header: 'Confirmation Reperation',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                if (!this.isFinishedRep) {
                    this.isFinishedRep = {};
                }

                this.lapTimeForPauseAndGetBack1();
                this.lap1();

                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.finishReparation(
                            this.DiByStat,
                            this.remarqueReparationnn
                        ),
                        useMutationLoading: true,
                    })
                    .subscribe(({ data, loading }) => {
                        if (data && !loading && this.DiByStat) {
                            this.changeStatusToFinished(this.DiByStat);
                        }
                    });

                this.getAllTechDi(this.first, this.rows);
            },
            reject: () => {},
        });
    }

    onUpload(event: any) {
        for (let file of event.files) {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result as string;
                this.uploadFile(base64);
            };
        }
        this.messageService.add({
            severity: 'info',
            summary: 'Fichier enregistré',
            detail: 'Fichier a été ajouter avec succès',
        });
    }

    uploadFile(base64: string) {
        const payload = {
            image: base64,
            // add other necessary data here
        };

        this.payloadImage = payload;
    }

    allCategoryDi() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getAllDiCategory(),
            })
            .subscribe(({ data }) => {
                if (data) {
                    this.categorieDiListDropDown = data.findAllDiCategory.map(
                        (Category_DI) => ({
                            category: `${Category_DI.category}`,
                            value: Category_DI._id, // ID as value
                        })
                    );
                }
            });
    }
}
