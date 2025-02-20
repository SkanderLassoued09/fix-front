import { ChangeDetectorRef, Component, DoCheck, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TicketService } from 'src/app/demo/service/ticket.service';
import {
    ConfigDiagAffectationMutationResult,
    ConfigRepAffectationMutationResult,
} from './tech-di-list.interface';
import { CreateComposantMutationResult } from './tech-di-list-interface';
import { NotificationService } from 'src/app/demo/service/notification.service';
import { PageEvent } from '../../../profile/profile-list/profile-list.interfaces';
import { finalize } from 'rxjs';
import * as moment from 'moment';
import { environment } from 'src/environments/environment';

@Component({
    selector: 'app-tech-di-list',
    templateUrl: './tech-di-list.component.html',
    styleUrl: './tech-di-list.component.scss',
})
export class TechDiListComponent implements OnInit {
    baseUrl = environment.apiUrl;
    selectedComposants: any[] = [];
    diagFormTech = new FormGroup({
        _idDi: new FormControl(),
        diag_time: new FormControl(),
        remarqueTech: new FormControl(''),
        isPdr: new FormControl(true),
        isReparable: new FormControl(true),
        isErrorFromFixtronix: new FormControl(false),
        quantity: new FormControl(0),
        composantSelectedDropdown: new FormControl(),
        di_category_id: new FormControl(),
        composantSelected: new FormControl(),
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
        { field: 'location_id', header: 'Emplacement' },
        { field: 'status', header: 'Status' },
    ];
    payloadImage: { image: string };
    countries;
    selectedCountry;
    diList: any;
    diListCount: any;
    diDialog: boolean = false;
    di: any;
    techList: any[] = [];
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
    composantSelected: any = null;
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
    finished_miniDashboard: number = 0;
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
    selectedRep: any;
    statId: any;
    idTech: string;
    diStatRepInfo: any;
    ignoreCount: number = 0;
    remarque_tech_repair: string;
    di_category_id: string;
    allComposantLogsAndOriginal: any[];
    historyOfDi: any;
    isLoading: boolean;
    error: string;
    disabledDiagnostiqueValue: boolean;
    disabledDiagnostiqueRetourValue: boolean;
    updatedValuecomposantCombo: { nameComposant: string; quantity: number }[];
    techRetourSendFinished: boolean = true;

    diData: any[];
    isToggleEnabled: any;
    composantCategory: any;
    // backupComposantList: any[] = [];
    constructor(
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
        private notificationService: NotificationService,

        private cdr: ChangeDetectorRef
    ) {
        this.idTech = localStorage.getItem('_id');
    }

    ngOnInit() {
        this.composantSelected = null;

        this.getComposant();
        this.checkValueChanges();
        this.checkValueChangesReperable();
        this.getDataForTech();
        this.barChart();

        this.notificationService.notification$.subscribe((message: any) => {
            if (message) {
                setTimeout(() => {
                    this.getAllTechDi(this.first, this.rows);
                }, 1000);
            }
        });
        this.getAllTechDi(this.first, this.rows);
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
        const imagePayload = this.payloadImage?.image
            ? this.payloadImage.image
            : null;

        this.apollo
            .mutate<CreateComposantMutationResult>({
                mutation: this.ticketSerice.createComposantByTech(
                    name,
                    packageComposant,
                    category_composant_id,
                    link,
                    imagePayload
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

    getImage(_id: string) {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getImageforDI(_id),
            })
            .subscribe(({ data }) => {
                if (data) {
                    this.imageValue = data.getDiById.di.image;
                }
            });
    }

    // Helper method to reset the modal form before loading new data
    resetModalForm() {
        this.diagFormTech.reset(); // Reset the form to clear any previous data
        this.di = null; // Reset the selected DI
    }

    resetModalFormRep() {
        this.remarque.reset(); // Reset the form to clear any previous data
        this.di = null; // Reset the selected DI
    }

    getCurrentPauseLog(pauseLogs) {
        const findNull = pauseLogs.find((log) => log.pauseEnd === null); // Find log where pauseEnd is null (indicating the pause is still active)

        return findNull;
    }

    // TODO
    /**
     *
     * if ignore count exist loaad data from logs table
     */
    async diagModal(di) {
        this.composantSelected = null;
        try {
            // Handle pause status if needed
            if (di.status === 'DIAGNOSTIC_Pause') {
                const getLog = this.getCurrentPauseLog(di.pauseLogs);
                if (getLog) {
                    await this.updatePauseLog(di._id, getLog._id);
                }
            }

            // Create a promise array to hold all our async operations
            const promises = [];

            // Add the first Apollo query to promises
            const retourDataPromise = this.apollo
                .query<any>({
                    query: this.ticketSerice.getDataOriginalAndRetour(di._idDi),
                })
                .toPromise();
            promises.push(retourDataPromise);

            // Add allCategoryDi to promises if it returns a promise
            promises.push(this.allCategoryDi());

            // Add the main diagnostic data query
            const diagnosticDataPromise = this.apollo
                .query<any>({
                    query: this.ticketSerice.getDiById(di._idDi),
                })
                .toPromise();
            promises.push(diagnosticDataPromise);

            // Add other async operations
            promises.push(this.changeStatus(di._idDi));
            promises.push(this.getTimeSpent(di._id));
            promises.push(this.getImage(di._idDi));
            promises.push(this.getAllRemarque(di._idDi));

            // Wait for all promises to resolve
            const [retourData, categoryData, diagnosticData, ...otherResults] =
                await Promise.all(promises);

            console.log('🌰[diagnosticData]:', diagnosticData);
            // Process retour data

            if (retourData?.data?.getRetourDataStats?.length > 0) {
                this.historyOfDi = retourData.data.getRetourDataStats;
            } else {
                this.error = 'No data found';
            }

            // Process diagnostic data
            if (diagnosticData?.data) {
                const detailsDi = diagnosticData.data.getDiById.di;

                const detailsLogs = diagnosticData.data.getDiById.logsDi;

                // Process the data based on whether detailsLogs exists
                if (detailsLogs) {
                    this.processDiagnosticWithLogs(di, detailsDi, detailsLogs);
                    this.diData = detailsLogs;
                } else {
                    this.processDiagnosticWithoutLogs(di, detailsDi);
                    this.diData = detailsDi;
                }

                // Set remaining properties
                this.di = { ...di };

                this.selectedDi = di._id;
                this.imageValue = detailsDi.image;
                this.selectedDi_id = di._idDi;
                this.diStatus = di.status;
                this.ignoreCount = di.ignoreCount;

                // Open the modal after all data is processed
                this.diDialogDiag[di._id] = true;
                // call the disable function
                this.updateDisableValues();
            }
        } catch (error) {
            console.error('Error in diagModal:', error);
            this.error = 'Failed to load data';
        } finally {
            this.isLoading = false;
        }
    }
    // Function to find the entry with the highest idIgnore
    getHighestIdIgnore(logs: any[]): any {
        return logs.reduce(
            (max, log) => (log.idIgnore > max.idIgnore ? log : max),
            logs[0]
        );
    }

    // Helper methods to process diagnostic data
    private processDiagnosticWithLogs(di, detailsDi, detailsLogs) {
        const dataLogs = this.getHighestIdIgnore(detailsLogs);
        console.log('🍞[dataLogs]:', dataLogs);
        // Patch form with logs data
        this.diagFormTech.patchValue({
            _idDi: di._id,
            diag_time: di.diag_time || dataLogs.diag_time || '',
            remarqueTech:
                di.remarqueTech || dataLogs.remarque_tech_diagnostic || '',
            isPdr: di.isPdr || dataLogs.contain_pdr || true,
            di_category_id:
                di.di_category_id || dataLogs.di_category_id || true,
            isReparable: di.isReparable || dataLogs.can_be_repaired || true,
            quantity: di.quantity || 0,
            composantSelectedDropdown:
                di.composantSelectedDropdown ?? dataLogs.array_composants,
        });

        // Process array_composants
        // ! todo skander
        // dataLogs.array_composants = [];

        // const arrayComposantLogs = dataLogs.flatMap((el) => {
        //     return el.array_composants.map((composant) => ({
        //         ...composant,
        //         ignoreCount: el._id,
        //     }));
        // });

        this.composantCombo = dataLogs.array_composants;

        this.allComposantLogsAndOriginal = [...dataLogs.array_composants];
    }

    private processDiagnosticWithoutLogs(di, detailsDi) {
        // Patch form without logs data
        this.diagFormTech.patchValue({
            _idDi: di._id,
            diag_time: di.diag_time || detailsDi.diag_time || '',
            remarqueTech:
                di.remarqueTech || detailsDi.remarque_tech_diagnostic || '',
            isPdr: di.isPdr || detailsDi.contain_pdr || true,
            isReparable: di.isReparable || detailsDi.can_be_repaired || true,
            di_category_id: di.di_category_id || detailsDi.di_category_id || '',
            quantity: di.quantity || 0,
            composantSelectedDropdown:
                di.composantSelectedDropdown ?? detailsDi.array_composants,
        });

        // Process array_composants
        this.composantCombo = detailsDi.array_composants.map((composant) => ({
            ...composant,
            ignoreCount: 0,
        }));
    }

    getDataOriginalAndRetour(_id: string) {
        return this.apollo
            .query<any>({
                query: this.ticketSerice.getDataOriginalAndRetour(_id),
            })
            .subscribe(({ data }) => {
                if (data) {
                    this.historyOfDi = data?.getRetourDataStats;

                    this.cdr.detectChanges();
                }
            });
    }

    repModal(di) {
        if (di.status === 'REPARATION_Pause') {
            const getLog = this.getCurrentPauseLog(di.pauseLogs);

            if (getLog) {
                this.updatePauseLog(di._id, getLog._id);
            }
        }
        this.getDataStatsByIdDi(di._idDi);
        this.selectedRep = di._idDi;
        this.statId = di._id;
        // -----------
        this.apollo
            .query<any>({
                query: this.ticketSerice.getDiById(di._idDi),
            })
            .subscribe(({ data }) => {
                if (data) {
                    const detailsDi = data.getDiById.di;

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

        this.apollo
            .query<any>({
                query: this.ticketSerice.getDiById(di._idDi),
            })
            .subscribe(({ data }) => {
                if (data) {
                    let arrayComposantLogs;

                    const detailsDi = data.getDiById.di;
                    const detailsLogs = data.getDiById.logsDi;

                    if (detailsLogs) {
                        // Create the array of composant logs and set ignoreCount
                        arrayComposantLogs = detailsLogs.flatMap((el) => {
                            return el.array_composants.map((composant) => ({
                                ...composant,
                                ignoreCount: el._id, // Assign ignoreCount from the logs
                            }));
                        });

                        this.composantCombo = [];

                        this.allComposantLogsAndOriginal = [
                            ...detailsDi.array_composants,
                            ...arrayComposantLogs,
                        ];
                    }

                    if (detailsDi) {
                        // Set ignoreCount to 0 for all items in detailsDi.array_composants
                        detailsDi.array_composants =
                            detailsDi.array_composants.map((composant) => ({
                                ...composant,
                                ignoreCount: 0,
                            }));
                        // Combine the original components with the logged components
                        // this.composantCombo = detailsDi.array_composants;
                    }

                    // Patch the form with the new data
                    this.diagFormTech.patchValue({
                        _idDi: di._id,
                        diag_time: di.diag_time || detailsDi.diag_time || '',
                        remarqueTech: 'hello',
                        isPdr: di.isPdr || detailsDi.contain_pdr || true,
                        isReparable:
                            di.isReparable || detailsDi.can_be_repaired || true,
                        quantity: di.quantity || 0,
                        composantSelectedDropdown:
                            di.composantSelectedDropdown ??
                            detailsDi.array_composants,
                    });
                }

                // Open the modal after data is fetched
                this.diDialogDiag[di._id] = true;
            });

        // -----------
        this.apollo
            .query<any>({
                query: this.ticketSerice.getDataOriginalAndRetour(di._idDi),
            })
            .pipe(finalize(() => (this.isLoading = false)))
            .subscribe({
                next: ({ data }) => {
                    if (data?.getRetourDataStats?.length > 0) {
                        this.historyOfDi = data.getRetourDataStats;
                    } else {
                        this.error = 'No data found';
                    }
                },
                error: (err) => {
                    console.error('Error fetching data:', err);
                    this.error = 'Failed to load data';
                },
            });
        this.di = { ...di };
        this.ignoreCount = di.ignoreCount;
        this.resetModalForm();
        this.selectedDi = di._id;
        this.diDialogRep = true;
        this.getTimeSpentRep(di._id);
        this.getImage(di._idDi);
        this.changeStatusInReparation(di._idDi);
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

    getDataStatsByIdDi(_idDi: string) {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getStatAndDiInfo(_idDi),
            })
            .subscribe(({ data }) => {
                if (data) {
                    this.diStatRepInfo = data;
                }
            });
    }

    addPauseLogs(_id: string, type: string) {
        const logsPause = {
            _id,
            pauseType: type,
            pauseStart: moment().format('YYYY/MM/DD:HH:mm:ss'),
        };
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.addLogPause(logsPause),
            })
            .subscribe(({ data }) => {
                if (data) {
                }
            });
    }

    updatePauseLog(_idStat: string, _idDoc: string) {
        const update = {
            _idStat,
            _idDoc,
            pauseEnd: moment().format('YYYY/MM/DD:HH:mm:ss'),
        };
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.updateLogPause(update),
            })
            .subscribe(({ data }) => {
                if (data) {
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
                    this.remarque_tech_repair =
                        data.getAllRemarque.remarque_tech_repair;
                    this.remarque_magasin =
                        data.getAllRemarque.remarque_magasin;
                    this.remarque_coordinator =
                        data.getAllRemarque.remarque_coordinator;
                    this.di_category_id = data.getAllRemarque.di_category_id;
                }
            });
    }

    show() {}

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
            .subscribe(({ data, loading }) => {
                if (data) {
                }
            });
    }

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
        this.findAllComposant_Category();
    }

    findAllComposant_Category() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.findAllComposant_Category(),
            })
            .subscribe(({ data }) => {
                if (data) {
                    this.composantCategory = data.findAllComposant_Category.map(
                        (el) => {
                            return {
                                name: el._id,
                                value: el.category_composant,
                            };
                        }
                    );
                }
            });
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
        this.lap();

        const formValues = {
            _idDi: this.selectedDi_id,
            pdr: this.diagFormTech.get('isPdr')?.value ?? false,
            reparable: this.diagFormTech.get('isReparable')?.value ?? false,
            isErrorFromFixtronix:
                this.diagFormTech.get('isErrorFromFixtronix')?.value ?? false,
            remarqueTech: this.diagFormTech.get('remarqueTech')?.value ?? '',
            di_category_id:
                this.diagFormTech.get('di_category_id')?.value ?? '',
            composant: this.composantCombo ?? [],
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

        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.saveTimeDiag(
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

        this.addPauseLogs(this.selectedDi, 'diag');

        this.getAllTechDi(this.first, this.rows);
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
                    this.finished_miniDashboard = 0;
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
                            case 'FINISHED':
                                this.finished_miniDashboard += item.count;
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

    updateDisableValues() {
        //! Getting values for conditions

        const isReperable = this.diagFormTech.get('isReparable')?.value ?? true;
        let isPdr = this.diagFormTech.get('isPdr')?.value ?? true;

        isReperable == false ? (isPdr = false) : (isPdr = isPdr);

        const isErrorFromFixtronixTech =
            this.diagFormTech.get('isErrorFromFixtronix')?.value ?? true;
        const isArrComposantEmpty =
            this.composantCombo.length === 0 ? true : false;

        //! diagnostique finish condition
        this.disabledDiagnostiqueValue =
            isReperable && isPdr && isArrComposantEmpty;
        //! diagnostique retour condition
        // didn't put ignoreCount > 0  bcs button are only shown with that condition
        //send finish directly condition
        this.techRetourSendFinished = !(
            isPdr === false && isErrorFromFixtronixTech === true || isReperable === false
        );
        //send diag retou condition
        this.disabledDiagnostiqueRetourValue =
            this.disabledDiagnostiqueValue || !this.techRetourSendFinished;

        this.cdr.detectChanges(); // Ensure change detection
    }
    comboComposantandQuantity() {
        const selectedName = this.composantSelected.value.name;
        let composantSelected = {
            nameComposant: selectedName,
            quantity: this.diagFormTech.value.quantity,
        };
        this.composantCombo.push(composantSelected);
        this.composantList = this.composantList.filter(
            (composant) => composant.name !== selectedName
        );

        this.composantSelected = null;
        this.updateDisableValues();
    }

    changeStatusToFinish(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusToFinished(_id),
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

    retourEnvoyerVersFinir() {
        this.confirmationService.confirm({
            message: 'Voulez vous confirmer les changements',
            header: 'Confirmation Fin DI',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                const dataDiag = {
                    _idDi: this.selectedDi_id,
                    pdr: this.diagFormTech.value.isPdr,
                    reparable: this.diagFormTech.value.isReparable,
                    remarqueTech: this.diagFormTech.value.remarqueTech,
                    isErrorFromFixtronix:
                        this.diagFormTech.value.isErrorFromFixtronix ?? false,
                    di_category_id: this.diagFormTech.value.di_category_id,
                    composant: this.composantCombo,
                };

                this.lap();

                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.finishLogsDi(dataDiag),
                        useMutationLoading: true,
                    })
                    .subscribe(({ data, loading }) => {
                        if (data) {
                            this.disable = data.tech_startDiagnostic;
                            this.cdr.detectChanges();
                            this.changeStatusToFinish(dataDiag._idDi);
                        }
                    });

                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.saveTimeDiag(
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
                setTimeout(() => {
                    this.getAllTechDi(this.first, this.rows);
                }, 1000);

                this.startStopwatch();

                this.diDialogDiag[this.selectedDi] = false; // Open modal for this row by ID
            },
        });
    }

    saveLogsDi() {
        this.confirmationService.confirm({
            message: 'Voulez vous confirmer les changements',
            header: 'Confirmation Diagnostique',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                const dataDiag = {
                    _idDi: this.selectedDi_id,
                    pdr: this.diagFormTech.value.isPdr,
                    reparable: this.diagFormTech.value.isReparable,
                    remarqueTech: this.diagFormTech.value.remarqueTech,
                    isErrorFromFixtronix:
                        this.diagFormTech.value.isErrorFromFixtronix ?? false,
                    di_category_id: this.diagFormTech.value.di_category_id,
                    composant: this.composantCombo,
                };

                this.lap();

                if (dataDiag.pdr) {
                    this.apollo
                        .mutate<any>({
                            mutation: this.ticketSerice.finishLogsDi(dataDiag),
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
                            mutation: this.ticketSerice.finishLogsDi(dataDiag),
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

                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.saveTimeDiag(
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
                setTimeout(() => {
                    this.getAllTechDi(this.first, this.rows);
                }, 1000);

                this.startStopwatch();
                this.getComposant();
                this.diDialogDiag[this.selectedDi] = false; // Open modal for this row by ID
            },
        });
    }

    changeStatusPending3() {
        this.confirmationService.confirm({
            message: 'Voulez vous Envoyer directement aux coordinator ?',
            header: 'Confirmation Diagnostique sans composants',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.changeFinishStatus(
                            this.selectedDi_id
                        ),
                    })
                    .subscribe(({ data }) => {});
                this.diDialogDiag[this.selectedDi] = false;
            },
        });
    }
    //!Tech finishing Diagnostique here
    techFinishDiag() {
        this.confirmationService.confirm({
            message: 'Voulez vous confirmer les changements',
            header: 'Confirmation Diagnostique',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                const dataDiag = {
                    _idDi: this.selectedDi_id,
                    pdr: this.diagFormTech.value.isPdr,
                    reparable: this.diagFormTech.value.isReparable,
                    remarqueTech: this.diagFormTech.value.remarqueTech,
                    di_category_id: this.diagFormTech.value.di_category_id,
                    isErrorFromFixtronix:
                        this.diagFormTech.value.isErrorFromFixtronix ?? false,
                    composant: this.composantCombo,
                };

                this.lap();

                if (dataDiag.pdr && dataDiag.reparable) {
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

                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.saveTimeDiag(
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
                setTimeout(() => {
                    this.getAllTechDi(this.first, this.rows);
                }, 1000);

                this.startStopwatch();
                this.getComposant();
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

    getReamrque() {
        this.remarqueReparationnn = this.remarque.value.remarqueRepair;
    }
    // i stoped here i need to get back when he stops and continue counting when tech click finish froze the butons
    lapTimeForPauseAndGetBack1(isFinishRep: boolean) {
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
                        this.statId,
                        this.lapTime1
                    ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading, errors }) => {
                if (data) {
                    this.setDiInReparationPause(this.selectedRep);
                    this.diDialogRep = false;
                }
            });

        if (!isFinishRep) {
            this.addPauseLogs(this.statId, 'rep');
        }
        this.getAllTechDi(this.first, this.rows);

        this.startStopwatch1();
    }

    setDiInReparationPause(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.diReperationInPAUSE(_id),
            })
            .subscribe(({ data }) => {
                if (data) {
                }
            });
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

                this.lapTimeForPauseAndGetBack1(true);
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
                setTimeout(() => {
                    this.getAllTechDi(this.first, this.rows);
                }, 1000);
                this.startStopwatch1();
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

            reader.onerror = () => {
                console.error('Error reading file:', reader.error);
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

    /**
     * composant table
     */

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
        this.updateDisableValues();
    }
}
