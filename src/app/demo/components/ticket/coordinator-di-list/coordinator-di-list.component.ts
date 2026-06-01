import { Component, OnDestroy } from '@angular/core';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import { Product } from 'src/app/demo/api/product';
import { TicketService } from 'src/app/demo/service/ticket.service';
import {
    ConfigRepAffectationMutationResponse,
    GetAllTechQueryResponse,
    TechStartDiagnosticMutationResponse,
} from './coordinator-di-list.interfaces';
import { STATUS_DI } from 'src/app/layout/api/status-di';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PageEvent } from '../../profile/profile-list/profile-list.interfaces';
import { NotificationService } from 'src/app/demo/service/notification.service';
import { debounceTime, finalize, Subject, takeUntil } from 'rxjs';
import { TicketRefreshService } from 'src/app/demo/service/ticket-refresh.service';
import {
    formatTableValue,
    isLocationColumn,
    rowHasLoadedComposants,
    trackByColumn,
} from '../table-display.utils';

@Component({
    selector: 'app-coordinator-di-list',
    templateUrl: './coordinator-di-list.component.html',
    styleUrl: './coordinator-di-list.component.scss',
})
export class CoordinatorDiListComponent implements OnDestroy {
    // Search state tracking
    private currentSearchField: string = '';
    private currentSearchValue: string = '';
    private searchSubject$ = new Subject<void>();
    private destroy$ = new Subject<void>();
    private lastSearchKey = '';

    visible: boolean = false;
    products!: Product[];

    //--
    diag_condition: boolean = true; // enable when status = pending1
    admin_condition: boolean = true; //enable when status = pending2
    rep_condition: boolean = true; // enable when status = pending3
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
    isLoading: boolean = true;

    uploadedFiles: any[] = [];
    cols = [
        { field: '_idnum', header: 'ID', searchKey: '_idnum' },
        { field: 'title', header: 'Title', searchKey: 'title' },
        { field: 'status', header: 'Status', searchKey: 'status' },
        { field: 'client_id', header: 'Client', searchKey: 'client' },
        { field: 'company_id', header: 'Company', searchKey: 'company' },
        { field: 'createdBy', header: 'Cree par', searchKey: 'createdBy' },
        { field: 'location_id', header: 'Location', searchKey: 'location' },
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
                    stepSize: number;
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
    adminSentAt: any = null;
    magasinConfirmedAt: any = null;
    pricingRequestInFlight = false;
    componentsConfirmInFlight = false;

    /** ─── Coordination-modal: real-data-only state ─────────────────────────
     *  techAvgRepairByTechId is populated by the dashboardTechLeaderboard
     *  query when the modal opens. Keys = Profile._id, value = avg days
     *  spent on FINISHED DIs. Techs with zero finished DIs are absent from
     *  the map → UI hides the "Temps moyen réparation" tile for them.
     *  techSearchTerm filters the tech grid; empty = show all.
     */
    techAvgRepairByTechId: Record<string, number> = {};
    techSearchTerm = '';

    /** Status-code → user-readable French label. Used in the dynamic flow
     *  timeline so every node always shows the REAL underlying DB status,
     *  never a generic "En attente / Terminé" placeholder when the system
     *  knows more. */
    private readonly STATUS_LABEL_FR: Record<string, string> = {
        CREATED: 'Créé',
        PENDING1: 'En attente diagnostic',
        DIAGNOSTIC: 'Diagnostic assigné',
        DIAGNOSTIC_Pause: 'Diagnostic en pause',
        INDIAGNOSTIC: 'En diagnostic',
        MagasinEstimation: 'Estimation magasin',
        INMAGASIN: 'En magasin',
        PENDING2: 'En attente prix',
        PRICING: 'En tarification',
        NEGOTIATION1: 'Négociation 1',
        NEGOTIATION2: 'Négociation 2',
        PENDING3: 'En attente réparation',
        REPARATION: 'Réparation assignée',
        REPARATION_Pause: 'Réparation en pause',
        INREPARATION: 'En réparation',
        FINISHED: 'Terminé',
        ANNULER: 'Annulé',
        RETOUR1: 'Retour 1',
        RETOUR2: 'Retour 2',
        RETOUR3: 'Retour 3',
    };

    /** Canonical status ordering — used to decide if a phase is `done`
     *  (current status comes AFTER the phase's last status) vs `pending`. */
    private readonly ALL_STATUS_ORDER: string[] = [
        'CREATED',
        'PENDING1',
        'DIAGNOSTIC',
        'DIAGNOSTIC_Pause',
        'INDIAGNOSTIC',
        'MagasinEstimation',
        'INMAGASIN',
        'PENDING2',
        'PRICING',
        'NEGOTIATION1',
        'NEGOTIATION2',
        'PENDING3',
        'REPARATION',
        'REPARATION_Pause',
        'INREPARATION',
        'FINISHED',
        'RETOUR1',
        'RETOUR2',
        'RETOUR3',
    ];

    /** Base phases — always rendered. Retour 1/2/3 are appended dynamically
     *  by getFlowPhases() ONLY when the DI is in or past that retour cycle. */
    private readonly BASE_PHASES = [
        {
            key: 'diagnostic' as const,
            label: 'Diagnostic',
            icon: 'pi pi-clipboard',
            statuses: ['PENDING1', 'DIAGNOSTIC', 'DIAGNOSTIC_Pause', 'INDIAGNOSTIC'],
        },
        {
            key: 'magasin' as const,
            label: 'Magasin',
            icon: 'pi pi-box',
            statuses: ['MagasinEstimation', 'INMAGASIN'],
        },
        {
            key: 'admin' as const,
            label: 'Administration',
            icon: 'pi pi-file',
            statuses: ['PENDING2', 'PRICING', 'NEGOTIATION1', 'NEGOTIATION2'],
        },
        {
            key: 'repair' as const,
            label: 'Réparation',
            icon: 'pi pi-wrench',
            statuses: ['PENDING3', 'REPARATION', 'REPARATION_Pause', 'INREPARATION'],
        },
        {
            key: 'closed' as const,
            label: 'Clôture',
            icon: 'pi pi-check-circle',
            statuses: ['FINISHED'],
        },
    ];
    ticketData: { data: any; pauseLogs: any; logsDi: any };
    retour1InfoFromLogs: any;
    retour2InfoFromLogs: any;
    retour3InfoFromLogs: any;
    ignoreCountForBtns: number = 0;
    ticketDetailsInfo: boolean;
    techInfo: any;
    baseUrl: string; // Add this if you're using it in the template

    constructor(
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private messageservice: MessageService,
        private confirmationService: ConfirmationService,
        private notificationService: NotificationService,
        private ticketRefreshService: TicketRefreshService,
    ) {}

    ngOnInit() {
        // Initial load
        this.loadData();
        this.getAllTech();
        this.getStatusCount();
        this.confirmationBTN = false;

        // Setup search with debounce
        this.searchSubject$
            .pipe(debounceTime(400), takeUntil(this.destroy$))
            .subscribe(() => {
                this.loadData();
            });

        this.ticketRefreshService
            .listen('coordinator-list')
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.loadData();
            });

        this.notificationService.sentComponentToCoordinator$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message: any) => {
                console.log(
                    'Composant comes from magasin this message should display in coordinator-di-list',
                    message,
                );
                if (message) {
                    console.log(
                        'in condition composant comes from magasin this message should display in coordinator-di-list',
                        message,
                    );
                    this.messageservice.add({
                        severity: 'info',
                        summary: 'Components Received',
                        detail: `Components for DI #${message.message._id} are ready for your review and confirmation.`,
                        sticky: true,
                    });
                    this.ticketRefreshService.requestRefresh(
                        'coordinator-list',
                        {
                            source: 'component:sent_to_coordinator',
                            message,
                        },
                    );
                }
            });

        // Notification subscription
        this.notificationService.notification$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message: any) => {
                console.log('🍻[message]:', message);
                if (message) {
                    console.log('🍚[message]:', message);
                    this.ticketRefreshService.requestRefresh(
                        'coordinator-list',
                        {
                            source: 'updateTicket',
                            message,
                        },
                    );
                    this.getStatusCount();
                }
            });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Centralized data loading method
     * Handles both search and regular data fetching with pagination
     */
    loadData() {
        this.isLoading = true;

        const hasActiveSearch =
            this.currentSearchField &&
            this.currentSearchValue &&
            this.currentSearchValue.trim().length > 0;

        if (hasActiveSearch) {
            // Perform search
            this.apollo
                .query<any>({
                    query: this.ticketSerice.searchCoordinatorDI(
                        this.currentSearchField,
                        this.currentSearchValue,
                        this.first,
                        this.rows,
                    ),
                    fetchPolicy: 'no-cache',
                })
                .pipe(finalize(() => (this.isLoading = false)))
                .subscribe(({ data }) => {
                    if (data && data.searchCoordinatorDI) {
                        this.diList = data.searchCoordinatorDI.di;
                        this.diListCount =
                            data.searchCoordinatorDI.totalDiCount;
                        this.updateCounters();
                    }
                });
        } else {
            // Regular data fetch
            this.apollo
                .query<any>({
                    query: this.ticketSerice.getAllDiForCoordinator(
                        this.first,
                        this.rows,
                    ),
                    fetchPolicy: 'no-cache',
                })
                .pipe(finalize(() => (this.isLoading = false)))
                .subscribe(({ data }) => {
                    console.log('🌶[*************data]:', data);

                    if (data && data.get_coordinatorDI) {
                        this.diList = data.get_coordinatorDI.di;
                        this.diListCount = data.get_coordinatorDI.totalDiCount;
                        this.updateCounters();
                    }
                });
        }
    }

    getStatusLabel(status: string): string {
        const map = {
            CREATED: 'CREATED',
            PENDING1: 'PENDING1',
            PENDING2: 'PENDING2',
            PENDING3: 'PENDING3',
            DIAGNOSTIC: 'DIAGNOSTIC',
            INDIAGNOSTIC: 'INDIAGNOSTIC',
            INMAGASIN: 'INMAGASIN',
            PRICING: 'PRICING',
            NEGOTIATION1: 'NEGOTIATION1',
            NEGOTIATION2: 'NEGOTIATION2',
            REPARATION: 'REPARATION',
            INREPARATION: 'INREPARATION',
            FINISHED: 'FINISHED',
            ANNULER: 'ANNULER',
            RETOUR1: 'RETOUR1',
            RETOUR2: 'RETOUR2',
            RETOUR3: 'RETOUR3',
        };

        return map[status] || status;
    }

    /**
     * Update counters for mini dashboard
     */
    updateCounters() {
        // Reset counters
        this.counterInMagasin = 0;
        this.counterInDiagnostique = 0;
        this.counterInReperation = 0;
        this.counterPending = 0;
        this.counterRetour = 0;

        // Count status occurrences
        this.diList.forEach((di) => {
            switch (di.status) {
                case 'INMAGASIN':
                case 'MagasinEstimation':
                    this.counterInMagasin++;
                    break;
                case 'DIAGNOSTIC':
                case 'INDIAGNOSTIC':
                case 'DIAGNOSTIC_Pause':
                    this.counterInDiagnostique++;
                    break;
                case 'REPARATION':
                case 'INREPARATION':
                case 'REPARATION_Pause':
                    this.counterInReperation++;
                    break;
                case 'PENDING1':
                case 'PENDING2':
                case 'PENDING3':
                    this.counterPending++;
                    break;
                case 'RETOUR1':
                case 'RETOUR2':
                case 'RETOUR3':
                    this.counterRetour++;
                    break;
                default:
                    break;
            }
        });
    }

    /**
     * Handle column search
     */
    onColumnSearch(field: string, value: string) {
        const v = value?.trim();
        const f = field?.trim();
        const searchKey = `${f || ''}:${v || ''}`;

        if (searchKey === this.lastSearchKey) {
            return;
        }

        this.lastSearchKey = searchKey;

        if (v && v.length > 0 && f && f.length > 0) {
            // Set search state
            this.currentSearchField = f;
            this.currentSearchValue = v;
            this.first = 0; // Reset to first page on new search

            // Trigger search
            this.searchSubject$.next();
        } else {
            // Clear search state
            this.currentSearchField = '';
            this.currentSearchValue = '';

            // Load regular data
            this.loadData();
        }
    }

    formatCell(row: any, field: string): string {
        return formatTableValue(row, field);
    }

    isLocationCell(field: string): boolean {
        return isLocationColumn(field);
    }

    hasLoadedComposants(row: any): boolean {
        return rowHasLoadedComposants(row);
    }

    trackByColumn = trackByColumn;

    /**
     * Handle page change
     */
    onPageChange(event: PageEvent) {
        this.first = event.first;
        this.page = event.page;
        this.rows = event.rows;

        // Load data (will automatically use search if active)
        this.loadData();
    }

    diagnosticOpen() {}

    showDialog() {
        this.visible = true;
    }

    infoRetour1OPEN() {
        this.modalRetour1Info = !this.modalRetour1Info;
    }

    infoRetour2OPEN() {
        this.modalRetour2Info = !this.modalRetour2Info;
    }

    infoRetour3OPEN() {
        this.modalRetour3Info = !this.modalRetour3Info;
    }

    getStatusCount() {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');
        const textColorSecondary = documentStyle.getPropertyValue(
            '--text-color-secondary',
        );
        const surfaceBorder =
            documentStyle.getPropertyValue('--surface-border');
        this.apollo
            .query<any>({
                query: this.ticketSerice.getStatusCount(),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
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
                                    stepSize: 1,
                                    callback: (value: number) =>
                                        value.toFixed(0),
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
                    this.selectedDi,
                ),
            })
            .valueChanges.subscribe(({ data, loading }) => {
                this.isLoading = loading;
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
            .valueChanges.subscribe(({ data, loading }) => {
                this.isLoading = loading;
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
        this.adminSentAt = di.pricingRequestSentAt ?? null;
        this.magasinConfirmedAt = di.componentsConfirmedAt ?? null;
        this.pricingRequestInFlight = false;
        this.componentsConfirmInFlight = false;
        this.gotComposantFromMagasinCondition = di.gotComposantFromMagasin;
        this.techSearchTerm = '';
        this.fetchTechAvgRepair();
        if (di.logs && di.logs.length > 0) {
            const highestIgnoreLog = di.logs.reduce((prev, current) =>
                prev.idIgnore > current.idIgnore ? prev : current,
            );
            this.magasinsentToCoordinator =
                highestIgnoreLog.isSentToCoordinator;
            this.componentConfirmedFromCoordinator =
                highestIgnoreLog.handleSendingNotificationBetweenCoordinatorAndMagasin;
            console.log(
                ' this.componentConfirmedFromCoordinator 0',
                highestIgnoreLog,
            );
        } else {
            this.magasinsentToCoordinator = di.isSentToCoordinator;
            this.componentConfirmedFromCoordinator =
                di.handleSendingNotificationBetweenCoordinatorAndMagasin;
            console.log(
                '🍝 this.componentConfirmedFromCoordinator',
                this.componentConfirmedFromCoordinator,
            );
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

    formatDateTime(value: any): string {
        if (!value) return '—';
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    formatTechName(tech: any): string {
        if (!tech) return 'N/A';
        if (typeof tech === 'string') return tech || 'N/A';
        return [tech.firstName, tech.lastName].filter(Boolean).join(' ') || 'N/A';
    }

    getAssignedDiagnosticTech(): string {
        const selected = this.formatTechName(this.selectedTechDiagModel);
        return selected !== 'N/A'
            ? selected
            : this.formatTableValueFallback(this.di?.techDiag);
    }

    getAssignedRepairTech(): string {
        return this.formatTableValueFallback(this.di?.techRep);
    }

    private formatTableValueFallback(value: any): string {
        const formatted = formatTableValue({ value }, 'value');
        return formatted && formatted !== '—' && formatted !== 'N/A' ? formatted : 'N/A';
    }

    getFlowStepState(step: 'diagnostic' | 'admin' | 'magasin' | 'repair') {
        const status = this.di?.status;
        const afterDiagnostic = [
            STATUS_DI.PENDING2,
            STATUS_DI.PRICING,
            STATUS_DI.NEGOTIATION1,
            STATUS_DI.NEGOTIATION2,
            STATUS_DI.PENDING3,
            STATUS_DI.REPARATION,
            STATUS_DI.INREPARATION,
            STATUS_DI.FINISHED,
            STATUS_DI.RETOUR1,
            STATUS_DI.RETOUR2,
            STATUS_DI.RETOUR3,
        ];
        const afterAdmin = [
            STATUS_DI.PENDING3,
            STATUS_DI.REPARATION,
            STATUS_DI.INREPARATION,
            STATUS_DI.FINISHED,
            STATUS_DI.RETOUR1,
            STATUS_DI.RETOUR2,
            STATUS_DI.RETOUR3,
        ];
        const afterRepair = [STATUS_DI.FINISHED, STATUS_DI.RETOUR1, STATUS_DI.RETOUR2, STATUS_DI.RETOUR3];

        if (step === 'diagnostic') {
            return afterDiagnostic.includes(status) ? 'done' : 'pending';
        }

        if (step === 'admin') {
            return this.adminSentAt || afterAdmin.includes(status)
                ? 'done'
                : 'pending';
        }

        if (step === 'magasin') {
            return this.magasinConfirmedAt ||
                this.componentConfirmedFromCoordinator === 'DEFAULT'
                ? 'done'
                : 'pending';
        }

        return afterRepair.includes(status) ? 'done' : 'pending';
    }

    getFlowStepLabel(step: 'diagnostic' | 'admin' | 'magasin' | 'repair') {
        return this.getFlowStepState(step) === 'done' ? 'Terminé' : 'En attente';
    }

    getFlowStepClass(step: 'diagnostic' | 'admin' | 'magasin' | 'repair') {
        return `sav-flow-step--${this.getFlowStepState(step)}`;
    }

    /**
     * Returns the formatted real DB timestamp for this step, or null if no
     * per-step timestamp exists in the document. The template uses *ngIf
     * to hide the line entirely when null — NO fabricated fallback.
     *
     * Step → DB field mapping:
     *   diagnostic → none stored per-step → always null (hidden)
     *   admin      → di.pricingRequestSentAt
     *   magasin    → di.componentsConfirmedAt
     *   repair     → none stored per-step → always null (hidden)
     *
     * Previously this method fell back to `di.updatedAt` for "done" steps,
     * which was misleading — updatedAt is the last write of ANY field,
     * not the moment the step completed.
     */
    getFlowTimestamp(step: 'diagnostic' | 'admin' | 'magasin' | 'repair'): string | null {
        if (step === 'admin' && this.adminSentAt) {
            return this.formatDateTime(this.adminSentAt);
        }
        if (step === 'magasin' && this.magasinConfirmedAt) {
            return this.formatDateTime(this.magasinConfirmedAt);
        }
        return null;
    }

    getCoordinatorActionMode(): 'diagnostic' | 'repair' | 'none' {
        if (!this.diag_condition) return 'diagnostic';
        if (!this.rep_condition) return 'repair';
        return 'none';
    }

    assignTechnician(tech: any) {
        const mode = this.getCoordinatorActionMode();
        if (mode === 'diagnostic') {
            this.selectedTechDiag({ value: tech });
            return;
        }
        if (mode === 'repair') {
            this.selectedTechRep({ value: tech });
        }
    }

    getAssignButtonLabel(): string {
        const mode = this.getCoordinatorActionMode();
        if (mode === 'diagnostic') return 'Affecter diagnostic';
        if (mode === 'repair') return 'Affecter réparation';
        return 'Affectation indisponible';
    }

    getCurrentAssignmentStageLabel(): string {
        const mode = this.getCoordinatorActionMode();
        if (mode === 'diagnostic') return 'Diagnostic';
        if (mode === 'repair') return 'Réparation';
        return 'Aucune étape ouverte';
    }

    /**
     * Active DI count per technician, derived from the live diList (real DB
     * snapshot). Used for the availability badge and for filtering. Returns
     * 0 if we cannot match the tech (never null/undefined).
     */
    getTechActiveDiCount(tech: any): number {
        const name = this.formatTechName(tech).toLowerCase();
        if (!name || name === 'n/a') return 0;
        const activeStatuses = new Set([
            STATUS_DI.DIAGNOSTIC,
            'DIAGNOSTIC_Pause',
            STATUS_DI.INDIAGNOSTIC,
            STATUS_DI.REPARATION,
            'REPARATION_Pause',
            STATUS_DI.INREPARATION,
            STATUS_DI.PENDING1,
            STATUS_DI.PENDING3,
        ]);

        return (this.diList || []).filter((di) => {
            if (!activeStatuses.has(di?.status)) return false;
            const diagName = this.formatTableValueFallback(di?.techDiag).toLowerCase();
            const repName = this.formatTableValueFallback(di?.techRep).toLowerCase();
            return diagName === name || repName === name;
        }).length;
    }

    /**
     * Availability label derived strictly from real active DI count.
     * "Charge actuelle" fake percent was removed — only the bucket label
     * remains because it's computed from real data.
     */
    getTechLoadLabel(tech: any): string {
        const active = this.getTechActiveDiCount(tech);
        if (active <= 2) return 'Disponible';
        if (active <= 5) return 'Occupé';
        return 'Saturé';
    }

    getTechLoadClass(tech: any): string {
        const active = this.getTechActiveDiCount(tech);
        if (active <= 2) return 'sav-tech-status--available';
        if (active <= 5) return 'sav-tech-status--busy';
        return 'sav-tech-status--full';
    }

    /**
     * Returns the historical avg repair time in days for this tech, or
     * null if no FINISHED DI exists yet. Populated by fetchTechAvgRepair
     * from the existing dashboardTechLeaderboard query (Phase A backend).
     * The UI uses null to HIDE the field entirely.
     */
    getTechAvgRepairDays(tech: any): number | null {
        if (!tech?._id) return null;
        const v = this.techAvgRepairByTechId[tech._id];
        return typeof v === 'number' && v > 0 ? Math.round(v * 10) / 10 : null;
    }

    /**
     * Filtered tech list (search bar). Empty term → show all.
     */
    getFilteredTechList(): any[] {
        const term = (this.techSearchTerm || '').trim().toLowerCase();
        const list = this.techList || [];
        if (!term) return list;
        return list.filter((t) =>
            this.formatTechName(t).toLowerCase().includes(term),
        );
    }

    /**
     * True if `tech` is the already-assigned technician for the current
     * stage (diagnostic or repair). Used for the highlighted-card state.
     */
    isTechAssigned(tech: any): boolean {
        if (!tech) return false;
        const candidate = this.formatTechName(tech).toLowerCase();
        if (!candidate || candidate === 'n/a') return false;
        const mode = this.getCoordinatorActionMode();
        if (mode === 'diagnostic') {
            const sel = this.formatTechName(this.selectedTechDiagModel).toLowerCase();
            const fromDi = this.formatTableValueFallback(this.di?.techDiag).toLowerCase();
            return candidate === sel || candidate === fromDi;
        }
        if (mode === 'repair') {
            const fromDi = this.formatTableValueFallback(this.di?.techRep).toLowerCase();
            return candidate === fromDi;
        }
        return false;
    }

    /**
     * Dynamic phase model — drives the "État actuel du flow" timeline.
     * Always renders the 5 base phases (Diagnostic, Magasin, Administration,
     * Réparation, Clôture). Retour 1/2/3 are appended ONLY when the DI is
     * currently in or past that retour cycle, derived from `di.status` and
     * `di.ignoreCount` (real DB fields — no fabrication).
     */
    getFlowPhases(): Array<{
        key: string;
        label: string;
        number: number;
        icon: string;
        state: 'done' | 'current' | 'pending';
        badgeLabel: string;
        timestamp: string | null;
    }> {
        const status = this.di?.status;
        const ignoreCount = Number(this.di?.ignoreCount ?? 0);
        const retourStatuses = ['RETOUR1', 'RETOUR2', 'RETOUR3'];
        const out: any[] = [];

        // Base phases
        this.BASE_PHASES.forEach((phase, idx) => {
            const state = this.computePhaseState(phase, status);
            out.push({
                key: phase.key,
                label: phase.label,
                number: idx + 1,
                icon: phase.icon,
                state,
                badgeLabel: this.computePhaseBadgeLabel(phase, status, state),
                timestamp: this.computePhaseTimestamp(phase.key, state),
            });
        });

        // Conditional retour phases — only show ones the DI has reached
        const isInRetour = retourStatuses.includes(status);
        const retourReached = Math.min(
            3,
            Math.max(
                ignoreCount,
                isInRetour ? retourStatuses.indexOf(status) + 1 : 0,
            ),
        );
        for (let i = 0; i < retourReached; i++) {
            const retourStatus = retourStatuses[i];
            const isCurrent = status === retourStatus;
            out.push({
                key: `retour${i + 1}`,
                label: `Retour ${i + 1}`,
                number: this.BASE_PHASES.length + i + 1,
                icon: 'pi pi-refresh',
                state: isCurrent ? 'current' : 'done',
                badgeLabel: this.STATUS_LABEL_FR[retourStatus] ?? retourStatus,
                timestamp: null,
            });
        }

        return out;
    }

    private computePhaseState(
        phase: { key: string; statuses: string[] },
        status: string,
    ): 'done' | 'current' | 'pending' {
        if (!status) return 'pending';
        if (phase.statuses.includes(status)) return 'current';
        const lastPhaseStatus = phase.statuses[phase.statuses.length - 1];
        const lastIdx = this.ALL_STATUS_ORDER.indexOf(lastPhaseStatus);
        const currentIdx = this.ALL_STATUS_ORDER.indexOf(status);
        // Closed phase: only 'done' if we're in a retour AFTER finishing
        if (phase.key === 'closed') {
            return currentIdx > lastIdx ? 'done' : 'pending';
        }
        return currentIdx > lastIdx ? 'done' : 'pending';
    }

    private computePhaseBadgeLabel(
        _phase: { statuses: string[] },
        status: string,
        state: 'done' | 'current' | 'pending',
    ): string {
        if (state === 'current') return this.STATUS_LABEL_FR[status] ?? status;
        if (state === 'done') return 'Terminé';
        return 'En attente';
    }

    private computePhaseTimestamp(
        phaseKey: string,
        state: 'done' | 'current' | 'pending',
    ): string | null {
        if (state === 'pending') return null;
        if (phaseKey === 'admin' && this.adminSentAt) {
            return this.formatDateTime(this.adminSentAt);
        }
        if (phaseKey === 'magasin' && this.magasinConfirmedAt) {
            return this.formatDateTime(this.magasinConfirmedAt);
        }
        if (
            phaseKey === 'closed' &&
            state === 'current' &&
            this.di?.statusUpdatedAt
        ) {
            return this.formatDateTime(this.di.statusUpdatedAt);
        }
        // No real per-step DB timestamp → hide
        return null;
    }

    /** Footer card: human-readable current phase label. */
    getCurrentPhaseLabel(): string {
        const current = this.getFlowPhases().find((p) => p.state === 'current');
        return current ? current.label : 'N/A';
    }

    /** Footer card: last DB update — uses statusUpdatedAt (real per-status
     *  timestamp from the Phase 1 backend stagnation hook) with fallback to
     *  updatedAt. Returns 'N/A' if neither field exists. */
    getLastUpdateDisplay(): string {
        const ts = this.di?.statusUpdatedAt ?? this.di?.updatedAt;
        return ts ? this.formatDateTime(ts) : 'N/A';
    }

    /** Footer card: who created the DI (closest field we have in DB — no
     *  `lastModifiedBy` column exists; per safety rule we show N/A when
     *  the data isn't there rather than fabricate). */
    getModifiedByDisplay(): string {
        return this.formatTableValueFallback(this.di?.createdBy);
    }

    /** Tech card avatar — initials in a colored circle (stable per tech id).
     *  We don't have real photo URLs in DB; this is a derived display
     *  element, not a fake DB value. */
    getTechInitials(tech: any): string {
        const first = (tech?.firstName ?? '').trim()[0] ?? '';
        const last = (tech?.lastName ?? '').trim()[0] ?? '';
        const initials = (first + last).toUpperCase();
        if (initials) return initials;
        const name = this.formatTechName(tech);
        return (name[0] ?? '?').toUpperCase();
    }

    getTechAvatarColor(tech: any): string {
        const seed = tech?._id ?? this.formatTechName(tech);
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = (hash << 5) - hash + seed.charCodeAt(i);
        }
        const palette = [
            '#3b82f6',
            '#8b5cf6',
            '#f59e0b',
            '#10b981',
            '#ef4444',
            '#06b6d4',
        ];
        return palette[Math.abs(hash) % palette.length];
    }

    getTechRoleDisplay(tech: any): string {
        return tech?.role && typeof tech.role === 'string' ? tech.role : 'N/A';
    }

    /**
     * Pull avg repair days per tech from the existing leaderboard query.
     * No new backend endpoint — reuses Phase A's dashboardTechLeaderboard.
     * All-time window (no date filter). Failure is silent (degrades to
     * "field hidden" for every tech) — capture happens server-side.
     */
    private fetchTechAvgRepair() {
        this.techAvgRepairByTechId = {};
        this.apollo
            .query<{
                dashboardTechLeaderboard: Array<{
                    techId: string;
                    tatMoyenJours: number;
                    nbDiClotures: number;
                }>;
            }>({
                query: gql`
                    query DashboardTechLeaderboardForModal($limit: Int) {
                        dashboardTechLeaderboard(limit: $limit) {
                            techId
                            tatMoyenJours
                            nbDiClotures
                        }
                    }
                `,
                variables: { limit: 100 },
                fetchPolicy: 'no-cache',
            })
            .subscribe({
                next: ({ data }) => {
                    const rows = data?.dashboardTechLeaderboard ?? [];
                    const map: Record<string, number> = {};
                    for (const r of rows) {
                        // Only keep techs with at least one FINISHED DI — otherwise
                        // `tatMoyenJours` would be 0 and the UI would mislead.
                        if (r?.nbDiClotures > 0 && typeof r.tatMoyenJours === 'number') {
                            map[r.techId] = r.tatMoyenJours;
                        }
                    }
                    this.techAvgRepairByTechId = map;
                },
                error: () => {
                    // Silent — UI will hide the "Temps moyen réparation" tile
                    // for every tech, which is the correct N/A behavior.
                    this.techAvgRepairByTechId = {};
                },
            });
    }

    getModalInfoValue(field: 'id' | 'client' | 'location' | 'status'): string {
        if (field === 'id') return this.di?._idnum || this.di?._id || 'N/A';
        if (field === 'client') {
            const company = this.formatTableValueFallback(this.di?.company_id);
            if (company !== 'N/A') return company;
            return this.formatTableValueFallback(this.di?.client_id);
        }
        if (field === 'location') {
            return (
                this.di?.location_name ||
                this.formatTableValueFallback(this.di?.location_id)
            );
        }
        return this.di?.status || 'N/A';
    }

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
            .toPromise()
            .then(({ data }) => data?.getStatByIdlogs || []);
    }

    openTicketDetails(data: any) {
        Promise.all([this.getLogsDi(data._id), this.getLogsData(data._id)])
            .then(([logsDi, pauseLogs]) => {
                this.ticketData = {
                    data: { ...data },
                    pauseLogs: { ...pauseLogs },
                    logsDi: { ...logsDi },
                };
                console.log(data, 'dtatatatata');
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

                this.ticketDetailsInfo = true;
                this.techInfo = { ...pauseLogs };
                console.log('data inside sknder =>', this.ticketData.data);
                console.log(data, 'all the data needed here');
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
            .subscribe(() => {});
    }

    sendDiToDiag(selectedDi, dataId, selectedDiLocation) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.sendingDiForDiagnostic(
                    selectedDi,
                    dataId,
                    selectedDiLocation,
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;

                if (data) {
                    this.apollo
                        .mutate<TechStartDiagnosticMutationResponse>({
                            mutation:
                                this.ticketSerice.changeStatusDiToDiagnostique(
                                    this.selectedDi,
                                ),
                            useMutationLoading: true,
                        })
                        .subscribe(({ loading }) => {
                            this.isLoading = loading;

                            this.loadData();
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
                    this.selectedDiLocation,
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
                            data.value._id,
                        ),
                        useMutationLoading: true,
                    })
                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;

                        if (data) {
                            this.changeStatusRepaire(this.selectedDi);
                            this.loadData();
                            this.diDialog = false;
                        }
                    });
            },
        });
    }

    changestatusToPricing(_data) {
        this.confirmationService.confirm({
            message: "Envoyer aux admins pour l'affectation de prix",
            header: "Confirmation d'envoie",
            icon: 'pi pi-question-circle',
            accept: () => {
                if (this.adminSentAt || this.pricingRequestInFlight) {
                    return;
                }
                this.pricingRequestInFlight = true;
                this.apollo
                    .mutate<any>({
                        mutation: this.ticketSerice.sendDiToAdminsForPricing(
                            this.di._id,
                        ),
                    })
                    .pipe(finalize(() => (this.pricingRequestInFlight = false)))
                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;

                        if (data?.sendDiToAdminsForPricing) {
                            const updated = data.sendDiToAdminsForPricing;
                            this.adminSentAt = updated.pricingRequestSentAt;
                            this.di = { ...this.di, ...updated };
                            this.loadData();
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
                if (this.magasinConfirmedAt || this.componentsConfirmInFlight) {
                    return;
                }
                this.componentsConfirmInFlight = true;
                this.apollo
                    .mutate<any>({
                        mutation:
                            this.ticketSerice.confirmDiComponents(
                                this.di._id,
                            ),
                    })
                    .pipe(
                        finalize(() => (this.componentsConfirmInFlight = false)),
                    )
                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;

                        if (data?.confirmDiComponents) {
                            console.log('🌯[data]:', data);
                            const updated = data.confirmDiComponents;
                            this.componentConfirmedFromCoordinator =
                                updated.handleSendingNotificationBetweenCoordinatorAndMagasin;
                            this.magasinConfirmedAt =
                                updated.componentsConfirmedAt;
                            this.di = { ...this.di, ...updated };
                            this.loadData();
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
                    'CONFIRM',
                ),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;

                if (data) {
                    console.log('🎂[data]:', data);
                    this.isConfirmed =
                        data.confirmationComposant.confirmationComposant;
                    console.log('🍰[this.isConfirmed]:', this.isConfirmed);
                }
            });
    }
}
