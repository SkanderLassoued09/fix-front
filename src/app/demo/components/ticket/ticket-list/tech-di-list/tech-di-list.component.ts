import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
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
import { debounceTime, finalize, Subject, takeUntil } from 'rxjs';
import * as moment from 'moment';
import { environment } from 'src/environments/environment';
import { TicketRefreshService } from 'src/app/demo/service/ticket-refresh.service';
import { ProfileService } from 'src/app/demo/service/profile.service';
import {
    formatTableValue,
    isLocationColumn,
    rowHasLoadedComposants,
    trackByColumn,
} from '../../table-display.utils';

type TechDialogMode = 'diagnostic' | 'repair';

interface PersistedTechDialogState {
    mode: TechDialogMode;
    diId: string;
    statId: string;
    /**
     * Wall-clock at which this state was last persisted. Kept for
     * diagnostics; the timer no longer uses it as a cross-session
     * elapsed-time anchor — see initialElapsedMs.
     */
    startedAt: number;
    savedAt: number;
    /**
     * Frozen accumulated active-work duration (ms) at the moment of
     * persistence. On restore, this becomes the new offset and the
     * fresh run leg starts from Date.now(). Wall-clock idle while the
     * modal/session was closed never enters this number.
     */
    initialElapsedMs: number;
    /**
     * Whether the timer was running when this state was persisted. On
     * restore, the timer is resumed only if this is true. Older entries
     * without this flag are treated as running for backward compatibility.
     */
    wasRunning?: boolean;
    statSnapshot?: any;
    diagFormValue?: any;
    repairFormValue?: any;
    composantCombo?: any[];
}

@Component({
    selector: 'app-tech-di-list',
    templateUrl: './tech-di-list.component.html',
    styleUrl: './tech-di-list.component.scss',
})
export class TechDiListComponent implements OnInit, OnDestroy {
    private readonly dialogStateStorageKey = 'fix.tech-dialog-state.v1';
    private readonly assignmentToastStorageKey = 'fix.tech-assignment-toasts.v1';
    private readonly dialogStateMaxAgeMs = 12 * 60 * 60 * 1000;
    // Search state tracking
    private currentSearchField: string = '';
    private currentSearchValue: string = '';
    private searchSubject$ = new Subject<void>();
    private destroy$ = new Subject<void>();
    private lastSearchKey = '';
    private hasAttemptedDialogRestore = false;
    private pendingRestoredDialogState: PersistedTechDialogState | null = null;
    private diagnosticTimerId: any = null;
    private repairTimerId: any = null;

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
    isLoading: boolean = true;
    visible: boolean = false;
    loading: boolean = false;
    roles;
    tstatuses = [{ label: 'Pending3', value: 'Pending3' }];

    ingredient;

    uploadedFiles: any[] = [];
    cols = [
        { field: '_idnum', header: 'ID', searchKey: '_idnum' },
        { field: 'location_id', header: 'Emplacement', searchKey: 'location' },
        { field: 'status', header: 'Status', searchKey: 'status' },
        { field: 'client', header: 'Client', searchKey: 'client' },
        { field: 'company', header: 'Company', searchKey: 'company' },
        { field: 'techDiag', header: 'Tech Diag', searchKey: 'techDiag' },
        { field: 'techRep', header: 'Tech Rep', searchKey: 'techRep' },
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
    private knownTechDiIds = new Set<string>();
    isRunning: any;
    startTime: number;
    minutes: string;
    seconds: string;
    milliseconds: string;
    lapTime: string;
    laps: any[];
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
    initialOffset1: number;
    laps1: any[];

    formGroupchips: any;
    chipsValues: string[] = [];
    submitted: boolean = false;
    composantDialog: boolean = false;
    creatComposantDialog: any;
    product: {};
    diStatus: any;
    diagnostiquefinishedFLAG: boolean = true;
    reperationfinishedFLAG: boolean = true;
    DiByStat: any;
    loadingCreatingComposant: boolean;
    hasPdr: boolean;
    isReperable: boolean;
    remarque_manager: string;
    description: string;
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

    // MINI Dashboard variables
    diagEnPause_miniDashboard: number = 0;
    diagNotOpened_miniDashboard: number = 0;
    repEnPause_miniDashboard: number = 0;
    repNotOpened_miniDashboard: number = 0;
    retour1_miniDashboard: number = 0;
    retour2_miniDashboard: number = 0;
    retour3_miniDashboard: number = 0;
    finished_miniDashboard: number = 0;
    admnistration_miniDashboard: number = 0;
    detailsDi: any;
    categorieDiListDropDown: any;
    remarqueReparationnn: any;
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
    error: string;
    disabledDiagnostiqueValue: boolean;
    disabledDiagnostiqueRetourValue: boolean;
    updatedValuecomposantCombo: { nameComposant: string; quantity: number }[];
    techRetourSendFinished: boolean = true;

    diData: any[];
    isToggleEnabled: any;
    composantCategory: any;
    emplacement: any;
    _idnum: any;
    allComposants: any[] = [];

    constructor(
        private ticketSerice: TicketService,
        private apollo: Apollo,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
        private notificationService: NotificationService,
        private cdr: ChangeDetectorRef,
        private ticketRefreshService: TicketRefreshService,
        private profileService: ProfileService,
    ) {
        this.idTech = localStorage.getItem('_id');
    }

    ngOnInit() {
        this.composantSelected = null;
        this.getComposant();
        this.checkValueChanges();
        this.checkValueChangesReperable();
        this.notificationService.startWorker();

        // Setup search with debounce
        this.searchSubject$
            .pipe(debounceTime(400), takeUntil(this.destroy$))
            .subscribe(() => {
                this.loadData();
            });

        this.diagFormTech.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => this.persistActiveDialogState());

        this.remarque.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => this.persistActiveDialogState());

        this.ticketRefreshService
            .listen('tech-list')
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {
                this.loadData();
            });

        // Notification subscription
        this.notificationService.notification$
            .pipe(takeUntil(this.destroy$))
            .subscribe((message: any) => {
                this.handleTechRealtimeMessage(message, 'websocket:updateTicket');
            });

        this.subscribeToTechAssignmentNotifications();

        // Initial load
        this.loadData();
    }

    ngOnDestroy() {
        this.stopDiagnosticTimer();
        this.stopRepairTimer();
        this.destroy$.next();
        this.destroy$.complete();
    }

    private handleTechRealtimeMessage(message: any, source: string): void {
        const assignment = this.getTechAssignmentInfo(message);

        if (assignment.isRelevant) {
            if (assignment.isNewAssignment) {
                this.showTechAssignmentToast(assignment);
            }

            this.ticketRefreshService.requestRefresh('tech-list', {
                source,
                assignmentType: assignment.type,
                diIds: assignment.diIds,
            });
        }
    }

    private subscribeToTechAssignmentNotifications(): void {
        this.apollo
            .subscribe<any>({
                query: this.profileService.notificationDiagnostic(),
            })
            .pipe(takeUntil(this.destroy$))
            .subscribe(({ data }) => {
                const message = data?.notificationDiagnostic;
                this.handleTechRealtimeMessage(
                    { ...message, status: 'DIAGNOSTIC' },
                    'graphql:notificationDiagnostic',
                );
            });

        this.apollo
            .subscribe<any>({
                query: this.profileService.notificationrep(),
            })
            .pipe(takeUntil(this.destroy$))
            .subscribe(({ data }) => {
                const message = data?.notificationReparation;
                this.handleTechRealtimeMessage(
                    { ...message, status: 'REPARATION' },
                    'graphql:notificationReparation',
                );
            });
    }

    private getTechAssignmentInfo(message: any): {
        isRelevant: boolean;
        isNewAssignment: boolean;
        type: TechDialogMode;
        diIds: string[];
        diNumber?: string;
    } {
        const currentTechId = this.idTech || localStorage.getItem('_id');
        const currentUsername = localStorage.getItem('username');

        if (!message || (!currentTechId && !currentUsername)) {
            return {
                isRelevant: false,
                isNewAssignment: false,
                type: 'diagnostic',
                diIds: [],
            };
        }

        const recipients = this.collectTechRecipientsFromNotification(message);
        const diIds = this.collectDiIdsFromNotification(message);
        const statuses = this.collectValuesFromNotification(message, [
            'status',
        ]).map((status) => status.toUpperCase());
        const diNumber = this.collectValuesFromNotification(message, [
            '_idnum',
        ])[0];
        const isTargetedToCurrentTech =
            (!!currentTechId && recipients.includes(currentTechId)) ||
            (!!currentUsername && recipients.includes(currentUsername));
        const hasRepairMarker =
            statuses.includes('REPARATION') ||
            statuses.includes('INREPARATION') ||
            this.hasKeyInNotification(message, [
                'id_tech_rep',
                '_idtechRep',
                'notificationReparation',
            ]);
        const hasDiagnosticMarker =
            statuses.includes('DIAGNOSTIC') ||
            statuses.includes('INDIAGNOSTIC') ||
            this.hasKeyInNotification(message, [
                'id_tech_diag',
                '_idtechDiag',
                'notificationDiagnostic',
            ]) ||
            this.hasTechAssignmentMarker(message);
        const type: TechDialogMode = hasRepairMarker ? 'repair' : 'diagnostic';
        const isRelevant =
            isTargetedToCurrentTech &&
            (hasRepairMarker || hasDiagnosticMarker || diIds.length > 0);
        const isNewAssignment =
            isRelevant &&
            (diIds.length === 0 ||
                diIds.some((diId) => !this.knownTechDiIds.has(diId))) &&
            !this.wasAssignmentToastShown(type, diIds);

        if (isRelevant && diIds.length > 0) {
            diIds.forEach((diId) => this.knownTechDiIds.add(diId));
        }

        return {
            isRelevant,
            isNewAssignment,
            type,
            diIds,
            diNumber,
        };
    }

    private showTechAssignmentToast(assignment: {
        type: TechDialogMode;
        diIds: string[];
        diNumber?: string;
    }): void {
        this.rememberAssignmentToast(assignment.type, assignment.diIds);

        this.messageService.add({
            severity: 'info',
            summary:
                assignment.type === 'repair'
                    ? 'New repair task assigned'
                    : 'New diagnostic task assigned',
            detail: assignment.diNumber
                ? `DI #${assignment.diNumber}`
                : 'Un nouveau ticket vient d’être assigné',
            sticky: true,
        });
    }

    private wasAssignmentToastShown(
        type: TechDialogMode,
        diIds: string[],
    ): boolean {
        if (diIds.length === 0) {
            return false;
        }

        const shown = this.getShownAssignmentToastKeys();
        return diIds.every((diId) => shown.has(`${type}:${diId}`));
    }

    private rememberAssignmentToast(type: TechDialogMode, diIds: string[]) {
        if (diIds.length === 0) {
            return;
        }

        const shown = this.getShownAssignmentToastKeys();
        diIds.forEach((diId) => shown.add(`${type}:${diId}`));
        sessionStorage.setItem(
            this.assignmentToastStorageKey,
            JSON.stringify(Array.from(shown).slice(-200)),
        );
    }

    private getShownAssignmentToastKeys(): Set<string> {
        try {
            const raw = sessionStorage.getItem(this.assignmentToastStorageKey);
            return new Set(raw ? JSON.parse(raw) : []);
        } catch {
            return new Set();
        }
    }

    private collectTechRecipientsFromNotification(message: any): string[] {
        const recipients = new Set<string>();
        const stack = [message];
        const recipientKeys = [
            'id_tech_diag',
            'id_tech_rep',
            '_idtechDiag',
            '_idtechRep',
            '_idTech',
            'techId',
            'idTech',
            'username',
        ];
        const nestedKeys = [
            'message',
            'content',
            'state',
            'states',
            'stat',
            'data',
            'profile',
        ];

        while (stack.length) {
            const current = stack.pop();

            if (!current) {
                continue;
            }

            if (typeof current === 'string') {
                try {
                    stack.push(JSON.parse(current));
                } catch {
                    recipients.add(current);
                }
                continue;
            }

            if (typeof current !== 'object') {
                continue;
            }

            if (Array.isArray(current)) {
                stack.push(...current);
                continue;
            }

            recipientKeys.forEach((key) => {
                const value = current[key];

                if (typeof value === 'string') {
                    recipients.add(value);
                } else if (value && typeof value === 'object') {
                    if (typeof value._id === 'string') {
                        recipients.add(value._id);
                    }
                    stack.push(value);
                }
            });

            nestedKeys.forEach((key) => {
                if (current[key]) {
                    stack.push(current[key]);
                }
            });
        }

        return Array.from(recipients);
    }

    private collectDiIdsFromNotification(message: any): string[] {
        const diIds = new Set<string>();
        const stack = [message];
        const diIdKeys = ['_idDi', '_idDI', 'idDi', 'diId'];

        while (stack.length) {
            const current = stack.pop();

            if (!current) {
                continue;
            }

            if (typeof current === 'string') {
                try {
                    stack.push(JSON.parse(current));
                } catch {
                    // Non-JSON strings cannot carry a DI identifier.
                }
                continue;
            }

            if (typeof current !== 'object') {
                continue;
            }

            if (Array.isArray(current)) {
                stack.push(...current);
                continue;
            }

            diIdKeys.forEach((key) => {
                const value = current[key];

                if (typeof value === 'string') {
                    diIds.add(value);
                } else if (value && typeof value === 'object') {
                    if (typeof value._id === 'string') {
                        diIds.add(value._id);
                    }
                    stack.push(value);
                }
            });

            ['message', 'content', 'state', 'states', 'stat', 'data'].forEach(
                (key) => {
                    if (current[key]) {
                        stack.push(current[key]);
                    }
                },
            );
        }

        return Array.from(diIds);
    }

    private collectValuesFromNotification(
        message: any,
        keys: string[],
    ): string[] {
        const values = new Set<string>();
        const stack = [message];

        while (stack.length) {
            const current = stack.pop();

            if (!current) {
                continue;
            }

            if (typeof current === 'string') {
                try {
                    stack.push(JSON.parse(current));
                } catch {
                    // plain strings are not keyed values
                }
                continue;
            }

            if (typeof current !== 'object') {
                continue;
            }

            if (Array.isArray(current)) {
                stack.push(...current);
                continue;
            }

            keys.forEach((key) => {
                const value = current[key];
                if (typeof value === 'string' || typeof value === 'number') {
                    values.add(String(value));
                }
            });

            ['message', 'content', 'state', 'states', 'stat', 'data'].forEach(
                (key) => {
                    if (current[key]) {
                        stack.push(current[key]);
                    }
                },
            );
        }

        return Array.from(values);
    }

    private hasKeyInNotification(message: any, keys: string[]): boolean {
        const stack = [message];

        while (stack.length) {
            const current = stack.pop();

            if (!current) {
                continue;
            }

            if (typeof current !== 'object') {
                continue;
            }

            if (Array.isArray(current)) {
                stack.push(...current);
                continue;
            }

            if (keys.some((key) => Object.prototype.hasOwnProperty.call(current, key))) {
                return true;
            }

            ['message', 'content', 'state', 'states', 'stat', 'data'].forEach(
                (key) => {
                    if (current[key]) {
                        stack.push(current[key]);
                    }
                },
            );
        }

        return false;
    }

    private hasTechAssignmentMarker(message: any): boolean {
        const stack = [message];

        while (stack.length) {
            const current = stack.pop();

            if (!current) {
                continue;
            }

            if (typeof current === 'string') {
                try {
                    stack.push(JSON.parse(current));
                } catch {
                    // Non-JSON strings cannot carry the assignment marker.
                }
                continue;
            }

            if (typeof current !== 'object') {
                continue;
            }

            if (Array.isArray(current)) {
                stack.push(...current);
                continue;
            }

            if (
                current.event === 'sendDitoDiagnostique' ||
                current.messageNotification ||
                current.notificationMessage
            ) {
                return true;
            }

            ['message', 'content', 'state', 'states', 'stat', 'data'].forEach(
                (key) => {
                    if (current[key]) {
                        stack.push(current[key]);
                    }
                },
            );
        }

        return false;
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
                    query: this.ticketSerice.searchTechDI(
                        this.currentSearchField,
                        this.currentSearchValue,
                        this.first,
                        this.rows,
                    ),
                    fetchPolicy: 'no-cache',
                })
                .pipe(finalize(() => (this.isLoading = false)))
                .subscribe(({ data }) => {
                    if (data && data.searchTechDI) {
                        this.techList = data.searchTechDI.stat;
                        this.rememberTechDiIds(this.techList);
                        this.restorePersistedDialogStateOnce();
                        this.techListCount =
                            data.searchTechDI.totalTechDataCount;
                    }
                });
        } else {
            // Regular data fetch
            this.getAllTechDi(this.first, this.rows);
        }
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

    getModalTitle(mode: TechDialogMode): string {
        const prefix = mode === 'repair' ? 'Repair' : 'Diagnostic';
        const diNumber = this._idnum || this.di?._idnum || this.di?.diId;
        return `${prefix} — ${diNumber || 'DI'}`;
    }

    getModalPartyLabel(): string {
        const company = this.di?.company?.name;
        const client = [this.di?.client?.first_name, this.di?.client?.last_name]
            .filter(Boolean)
            .join(' ');

        return company || client || '—';
    }

    getModalLocationLabel(): string {
        return this.emplacement || this.formatCell(this.di, 'location_id');
    }

    getModalStatusLabel(): string {
        return this.diStatus || this.di?.status || '—';
    }

    trackByColumn = trackByColumn;

    barChart() {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');
        const textColorSecondary = documentStyle.getPropertyValue(
            '--text-color-secondary',
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
            labels: ['Diagnostic', 'Reperation', 'Retour', 'Admnistration'],
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
        this.confirmationService.confirm({
            message: 'Voulez-vous Ajouter ce composant ?',
            header: 'Confirmation Ajout',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                const {
                    name,
                    packageComposant,
                    category_composant_id,
                    link,
                } = this.composantTechnicien.value;
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
                            imagePayload,
                        ),
                        useMutationLoading: true,
                    })
                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;

                        this.loadingCreatingComposant = loading;

                        if (data) {
                            this.getComposant();
                            this.composantTechnicien.reset();
                            this.creatComposantDialog = false;
                        }
                    });
            },
        });
    }

    selctedDropDownComposantTech() {}

    showDialog() {
        this.visible = true;
    }

    onPageChange(event: PageEvent) {
        this.first = event.first;
        this.page = event.page;
        this.rows = event.rows;
        this.loadData(); // Use loadData instead of getAllTechDi
    }

    getAllTechDi(first, rows) {
        this.apollo
            .query<any>({
                query: this.ticketSerice.diListTech(first, rows),
                fetchPolicy: 'no-cache',
            })
            .pipe(finalize(() => (this.isLoading = false)))
            .subscribe(({ data }) => {
                if (data) {
                    this.techList = data.getDiForTech.stat;
                    this.rememberTechDiIds(this.techList);
                    this.restorePersistedDialogStateOnce();
                    this.techListCount = data.getDiForTech.totalTechDataCount;
                }
            });
    }

    private rememberTechDiIds(diList: any[]) {
        (diList || []).forEach((di) => {
            const diId = di?._idDi || di?._idDI || di?.idDi || di?.diId;

            if (diId) {
                this.knownTechDiIds.add(diId);
            }
        });
    }

    handleNotification(message: any) {
        if (message && message.event === 'sendDitoDiagnostique') {
            this.techList.push(message);
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
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;

                if (data) {
                    this.imageValue = data.getDiById.di.image;
                }
            });
    }

    resetModalForm() {
        this.diagFormTech.reset();
        this.di = null;
    }

    resetModalFormRep() {
        this.remarque.reset();
        this.di = null;
    }

    private persistActiveDialogState(
        mode?: TechDialogMode,
        statSnapshot?: any,
    ): void {
        const activeMode = mode || this.getActiveDialogMode();

        if (!activeMode) {
            return;
        }

        const isDiagnostic = activeMode === 'diagnostic';
        const statId = isDiagnostic ? this.selectedDi : this.statId;
        const diId = isDiagnostic ? this.selectedDi_id : this.selectedRep;

        if (!statId || !diId) {
            return;
        }

        // Save the LIVE accumulated elapsed (offset + current run leg). This
        // is the only value that matters for restoration. startedAt is no
        // longer used as a cross-session anchor; persisted purely for
        // diagnostics.
        const liveAccumulatedMs = isDiagnostic
            ? this.computeLiveElapsedDiag()
            : this.computeLiveElapsedRep();
        const wasRunning = isDiagnostic ? this.isRunning : this.isRunning1;

        const state: PersistedTechDialogState = {
            mode: activeMode,
            diId,
            statId,
            startedAt: Date.now(),
            savedAt: Date.now(),
            initialElapsedMs: liveAccumulatedMs,
            wasRunning,
            statSnapshot: statSnapshot || this.di,
            diagFormValue: this.diagFormTech.value,
            repairFormValue: this.remarque.value,
            composantCombo: this.composantCombo || [],
        };

        try {
            localStorage.setItem(
                this.dialogStateStorageKey,
                JSON.stringify(state),
            );
        } catch (error) {
            console.warn('Unable to persist tech dialog state', error);
        }
    }

    private getActiveDialogMode(): TechDialogMode | null {
        if (this.selectedDi && this.diDialogDiag[this.selectedDi]) {
            return 'diagnostic';
        }

        if (this.diDialogRep) {
            return 'repair';
        }

        return null;
    }

    private clearPersistedDialogState(mode?: TechDialogMode): void {
        const existing = this.readPersistedDialogState();

        if (!existing || !mode || existing.mode === mode) {
            localStorage.removeItem(this.dialogStateStorageKey);
        }
    }

    private readPersistedDialogState(): PersistedTechDialogState | null {
        try {
            const raw = localStorage.getItem(this.dialogStateStorageKey);
            if (!raw) {
                return null;
            }

            const parsed = JSON.parse(raw) as PersistedTechDialogState;
            if (
                !parsed?.mode ||
                !parsed?.diId ||
                !parsed?.statId ||
                Date.now() - parsed.savedAt > this.dialogStateMaxAgeMs
            ) {
                localStorage.removeItem(this.dialogStateStorageKey);
                return null;
            }

            return parsed;
        } catch {
            localStorage.removeItem(this.dialogStateStorageKey);
            return null;
        }
    }

    private restorePersistedDialogStateOnce(): void {
        if (this.hasAttemptedDialogRestore) {
            return;
        }

        const state = this.readPersistedDialogState();
        this.hasAttemptedDialogRestore = true;

        if (!state?.statSnapshot) {
            return;
        }

        this.pendingRestoredDialogState = state;
        console.debug({
            event: 'tech.dialog.restore_requested',
            mode: state.mode,
            statId: state.statId,
            diId: state.diId,
        });

        if (state.mode === 'diagnostic') {
            this.diagModal(state.statSnapshot);
        } else {
            this.repModal(state.statSnapshot);
        }
    }

    private applyPendingRestoredDialogState(
        mode: TechDialogMode,
        statId: string,
    ): void {
        const state = this.pendingRestoredDialogState;

        if (!state || state.mode !== mode || state.statId !== statId) {
            return;
        }

        if (state.diagFormValue) {
            this.diagFormTech.patchValue(state.diagFormValue, {
                emitEvent: false,
            });
        }

        if (state.repairFormValue) {
            this.remarque.patchValue(state.repairFormValue, {
                emitEvent: false,
            });
        }

        if (state.composantCombo) {
            this.composantCombo = state.composantCombo;
        }

        // Restore from accumulated elapsed time, NOT from the previous
        // session's wall-clock anchor. This keeps wall-clock idle out of
        // the timer: the new run leg starts at Date.now() with offset =
        // last-saved accumulated, so the first tick displays exactly
        // initialElapsedMs and counts forward from there.
        const savedAccumulatedMs = state.initialElapsedMs || 0;
        // Older persisted entries didn't carry wasRunning — fall back to
        // resuming so we don't accidentally freeze a timer that was live.
        const wasRunning =
            state.wasRunning !== undefined ? !!state.wasRunning : true;

        if (mode === 'diagnostic') {
            this.stopDiagnosticTimer();
            this.initialOffset = savedAccumulatedMs;
            this.startTime = 0;
            this.isRunning = false;
            // Render the saved value immediately while paused.
            const elapsed = this.computeLiveElapsedDiag();
            this.minutes = this.padZero(
                Math.floor(elapsed / (1000 * 60 * 60)),
            );
            this.seconds = this.padZero(
                Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60)),
            );
            this.milliseconds = this.padZero(
                Math.floor((elapsed % (1000 * 60)) / 1000),
            );
            if (wasRunning) {
                this.startStopwatch();
            }
        } else {
            this.stopRepairTimer();
            this.initialOffset1 = savedAccumulatedMs;
            this.startTime1 = 0;
            this.isRunning1 = false;
            const elapsed = this.computeLiveElapsedRep();
            this.minutes1 = this.padZero(
                Math.floor(elapsed / (1000 * 60 * 60)),
            );
            this.seconds1 = this.padZero(
                Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60)),
            );
            this.milliseconds1 = this.padZero(
                Math.floor((elapsed % (1000 * 60)) / 1000),
            );
            if (wasRunning) {
                this.startStopwatch1();
            }
        }

        console.debug({
            event: 'tech.timer.restored',
            mode,
            statId,
            accumulatedMs: savedAccumulatedMs,
            wasRunning,
        });

        this.pendingRestoredDialogState = null;
        this.persistActiveDialogState();
    }

    getCurrentPauseLog(pauseLogs) {
        const findNull = pauseLogs.find((log) => log.pauseEnd === null);
        return findNull;
    }

    async diagModal(di) {
        this.composantSelected = null;

        try {
            if (di.status === 'DIAGNOSTIC_Pause') {
                const getLog = this.getCurrentPauseLog(di.pauseLogs);
                if (getLog) {
                    await this.updatePauseLog(di._id, getLog._id);
                }
            }

            const promises = [];

            const retourDataPromise = this.apollo
                .query<any>({
                    query: this.ticketSerice.getDataOriginalAndRetour(di._idDi),
                })
                .toPromise();

            promises.push(retourDataPromise);
            promises.push(this.allCategoryDi());

            const diagnosticDataPromise = this.apollo
                .query<any>({
                    query: this.ticketSerice.getDiById(di._idDi),
                })
                .toPromise();
            promises.push(diagnosticDataPromise);

            promises.push(this.changeStatus(di._idDi));
            promises.push(this.getTimeSpent(di._id));
            promises.push(this.getImage(di._idDi));
            promises.push(this.getAllRemarque(di._idDi));

            const [retourData, , diagnosticData] =
                await Promise.all(promises);

            this.apollo
                .query<any>({
                    query: this.ticketSerice.findLocationById(
                        diagnosticData.data.getDiById.di.location_id,
                    ),
                })
                .subscribe(({ data, loading }) => {
                    this.isLoading = loading;
                    if (data) {
                        this.emplacement = data.findOneLocation.location_name;
                    }
                });

            this.allComposants = [
                ...diagnosticData.data.getDiById.di.array_composants,
                ...(diagnosticData.data.getDiById.logsDi?.flatMap(
                    (log) => log.array_composants,
                ) ?? []),
            ];

            this._idnum = diagnosticData.data.getDiById.di._idnum;

            if (retourData?.data?.getRetourDataStats?.length > 0) {
                this.historyOfDi = retourData.data.getRetourDataStats;
            } else {
                this.error = 'No data found';
            }

            if (diagnosticData?.data) {
                const detailsDi = diagnosticData.data.getDiById.di;
                const detailsLogs = diagnosticData.data.getDiById.logsDi;

                if (detailsLogs) {
                    this.processDiagnosticWithLogs(di, detailsLogs);
                    this.diData = detailsLogs;
                } else {
                    this.processDiagnosticWithoutLogs(di, detailsDi);
                    this.diData = detailsDi;
                }

                this.di = { ...di };
                this.selectedDi = di._id;
                this.imageValue = detailsDi.image;
                this.selectedDi_id = di._idDi;
                this.diStatus = di.status;
                this.ignoreCount = di.ignoreCount;

                this.diDialogDiag[di._id] = true;
                this.persistActiveDialogState('diagnostic', di);
                this.updateDisableValues();
            }
        } catch (error) {
            console.error('Error in diagModal:', error);
            this.error = 'Failed to load data';
        } finally {
            this.isLoading = false;
        }
    }

    getHighestIdIgnore(logs: any[]): any {
        return logs.reduce(
            (max, log) => (log.idIgnore > max.idIgnore ? log : max),
            logs[0],
        );
    }

    private processDiagnosticWithLogs(di, detailsLogs) {
        const dataLogs = this.getHighestIdIgnore(detailsLogs);

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

        this.composantCombo = dataLogs.array_composants;
        this.allComposantLogsAndOriginal = [...dataLogs.array_composants];
    }

    private processDiagnosticWithoutLogs(di, detailsDi) {
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
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;

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
        this._idnum = di._idnum;
        this.selectedRep = di._idDi;
        this.statId = di._id;

        this.apollo
            .query<any>({
                query: this.ticketSerice.getDiById(di._idDi),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    const detailsDi = data.getDiById.di;

                    this.remarque.patchValue({
                        remarqueRepair:
                            di.remarque_tech_repair ||
                            detailsDi.remarque_tech_repair ||
                            '',
                    });
                }
            });

        this.apollo
            .query<any>({
                query: this.ticketSerice.getDiById(di._idDi),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    let arrayComposantLogs;

                    const detailsDi = data.getDiById.di;
                    const detailsLogs = data.getDiById.logsDi;

                    if (detailsLogs) {
                        arrayComposantLogs = detailsLogs.flatMap((el) => {
                            return el.array_composants.map((composant) => ({
                                ...composant,
                                ignoreCount: el._id,
                            }));
                        });

                        this.composantCombo = [];

                        this.allComposantLogsAndOriginal = [
                            ...detailsDi.array_composants,
                            ...arrayComposantLogs,
                        ];
                    }

                    if (detailsDi) {
                        detailsDi.array_composants =
                            detailsDi.array_composants.map((composant) => ({
                                ...composant,
                                ignoreCount: 0,
                            }));
                    }

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

                this.diDialogDiag[di._id] = true;
            });

        this.apollo
            .query<any>({
                query: this.ticketSerice.getDataOriginalAndRetour(di._idDi),
            })
            .pipe(finalize(() => (this.isLoading = false)))
            .subscribe({
                next: ({ data, loading }) => {
                    this.isLoading = loading;
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
        this.persistActiveDialogState('repair', di);
        this.getTimeSpentRep(di._id);
        this.getImage(di._idDi);
        this.changeStatusInReparation(di._idDi);
        this.getAllRemarque(di._idDi);
        this.apollo
            .query<any>({
                query: this.ticketSerice.getStatbyID(this.selectedDi),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
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
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
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
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
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
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                }
            });
    }

    getAllRemarque(_id) {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getAllRemarque(_id),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;

                if (data) {
                    this.description = data.getAllRemarque.description;
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
        this.diDialogDiag[this.selectedDi] = false;
        this.clearPersistedDialogState('diagnostic');
    }

    hideDialogRep() {
        this.diDialogRep = false;
        this.clearPersistedDialogState('repair');
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
                    data.value._id,
                ),
                useMutationLoading: true,
            })
            .subscribe(({ loading }) => {
                this.isLoading = loading;
            });
    }

    selectedTechRep(data) {
        this.apollo
            .mutate<ConfigRepAffectationMutationResult>({
                mutation: this.ticketSerice.configRepAffectation(
                    this.selectedDi,
                    data.value._id,
                ),
                useMutationLoading: true,
            })
            .subscribe(({ loading }) => {
                this.isLoading = loading;
            });
    }

    changeStatus(_id) {
        this.apollo
            .mutate<Boolean>({
                mutation: this.ticketSerice.changeStatusDiToInDiagnostique(_id),
            })
            .subscribe(({ loading }) => {
                this.isLoading = loading;
            });
    }

    changeStatusInReparation(_id) {
        this.apollo
            .mutate<Boolean>({
                mutation: this.ticketSerice.changeStatusInRepair(_id),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                }
            });
    }

    // Timer model — accumulated active duration, never wall-clock anchor.
    //   initialOffset    : frozen elapsed for diag (ms) before current run leg
    //   initialOffset1   : frozen elapsed for rep
    //   startTime/startTime1 : wall-clock at which the current run leg
    //                          started. 0 means the timer is paused/stopped.
    // Live elapsed = offset + (running ? now - runStartedAt : 0).
    // Wall-clock idle while the modal is closed cannot enter the elapsed
    // total because runStartedAt is frozen the moment the timer stops.

    private computeLiveElapsedDiag(): number {
        const running = this.isRunning && this.startTime > 0;
        return (
            (this.initialOffset || 0) +
            (running ? Math.max(0, Date.now() - this.startTime) : 0)
        );
    }

    private computeLiveElapsedRep(): number {
        const running = this.isRunning1 && this.startTime1 > 0;
        return (
            (this.initialOffset1 || 0) +
            (running ? Math.max(0, Date.now() - this.startTime1) : 0)
        );
    }

    startStopwatch() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.startTime = Date.now();
            console.debug({
                event: 'tech.timer.started',
                mode: 'diagnostic',
                statId: this.selectedDi,
                startedAt: this.startTime,
                offsetMs: this.initialOffset || 0,
            });
            this.persistActiveDialogState();
            this.updateTimer();
        } else {
            this.stopDiagnosticTimer();
            this.persistActiveDialogState();
        }
    }

    startStopwatch1() {
        if (!this.isRunning1) {
            this.isRunning1 = true;
            this.startTime1 = Date.now();
            console.debug({
                event: 'tech.timer.started',
                mode: 'repair',
                statId: this.statId,
                startedAt: this.startTime1,
                offsetMs: this.initialOffset1 || 0,
            });
            this.persistActiveDialogState();
            this.updateTimer1();
        } else {
            this.stopRepairTimer();
            this.persistActiveDialogState();
        }
    }

    updateTimer() {
        if (!this.isRunning) {
            return;
        }

        if (this.diagnosticTimerId) {
            console.debug({
                event: 'tech.timer.duplicate_prevented',
                mode: 'diagnostic',
                statId: this.selectedDi,
            });
            return;
        }

        const tick = () => {
            const elapsedTime = this.computeLiveElapsedDiag();
            this.minutes = this.padZero(
                Math.floor(elapsedTime / (1000 * 60 * 60)),
            );
            this.seconds = this.padZero(
                Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60)),
            );
            this.milliseconds = this.padZero(
                Math.floor((elapsedTime % (1000 * 60)) / 1000),
            );
            // Persist live accumulated every tick so a crash loses at most
            // ~1s of work, never wall-clock idle while disconnected.
            this.persistActiveDialogState();
        };

        tick();
        this.diagnosticTimerId = window.setInterval(tick, 1000);
    }

    updateTimer1() {
        if (!this.isRunning1) {
            return;
        }

        if (this.repairTimerId) {
            console.debug({
                event: 'tech.timer.duplicate_prevented',
                mode: 'repair',
                statId: this.statId,
            });
            return;
        }

        const tick = () => {
            const elapsedTime = this.computeLiveElapsedRep();
            this.minutes1 = this.padZero(
                Math.floor(elapsedTime / (1000 * 60 * 60)),
            );
            this.seconds1 = this.padZero(
                Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60)),
            );
            this.milliseconds1 = this.padZero(
                Math.floor((elapsedTime % (1000 * 60)) / 1000),
            );
            this.persistActiveDialogState();
        };

        tick();
        this.repairTimerId = window.setInterval(tick, 1000);
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
        this.stopDiagnosticTimer();
        this.minutes = '00';
        this.seconds = '00';
        this.milliseconds = '00';
        this.startTime = 0;
        this.initialOffset = 0;
        this.laps = [];
    }

    reset1() {
        this.stopRepairTimer();
        this.minutes1 = '00';
        this.seconds1 = '00';
        this.milliseconds1 = '00';
        this.startTime1 = 0;
        this.initialOffset1 = 0;
        this.laps1 = [];
    }

    private stopDiagnosticTimer() {
        if (this.diagnosticTimerId) {
            clearInterval(this.diagnosticTimerId);
            this.diagnosticTimerId = null;
        }

        if (this.isRunning && this.startTime > 0) {
            // Freeze the elapsed time of the current run leg into the
            // accumulated offset. After this, any wall-clock time that
            // passes while the modal is closed is *not* counted.
            this.initialOffset =
                (this.initialOffset || 0) +
                Math.max(0, Date.now() - this.startTime);
            console.debug({
                event: 'tech.timer.stopped',
                mode: 'diagnostic',
                statId: this.selectedDi,
                accumulatedMs: this.initialOffset,
            });
        }

        this.startTime = 0;
        this.isRunning = false;
    }

    private stopRepairTimer() {
        if (this.repairTimerId) {
            clearInterval(this.repairTimerId);
            this.repairTimerId = null;
        }

        if (this.isRunning1 && this.startTime1 > 0) {
            this.initialOffset1 =
                (this.initialOffset1 || 0) +
                Math.max(0, Date.now() - this.startTime1);
            console.debug({
                event: 'tech.timer.stopped',
                mode: 'repair',
                statId: this.statId,
                accumulatedMs: this.initialOffset1,
            });
        }

        this.startTime1 = 0;
        this.isRunning1 = false;
    }

    padZero(value: number): string {
        return value.toString().padStart(2, '0');
    }

    private timeStringToMs(timeString: string): number {
        if (!this.isValidTimeFormat(timeString)) {
            return 0;
        }

        const [hours, minutes, seconds] = timeString.split(':').map(Number);
        return hours * 60 * 60 * 1000 + minutes * 60 * 1000 + seconds * 1000;
    }

    setInitialTime(timeString: string) {
        const [hours, minutes, seconds] = timeString.split(':').map(Number);
        // Reset run-leg state — the offset is the new floor, no idle to fold.
        this.startTime = 0;
        this.isRunning = false;
        this.initialOffset = this.timeStringToMs(timeString);
        this.minutes = this.padZero(hours);
        this.seconds = this.padZero(minutes);
        this.milliseconds = this.padZero(seconds);
    }

    setInitialTime1(timeString: string) {
        const [hours, minutes, seconds] = timeString.split(':').map(Number);
        this.startTime1 = 0;
        this.isRunning1 = false;
        this.initialOffset1 = this.timeStringToMs(timeString);
        this.minutes1 = this.padZero(hours);
        this.seconds1 = this.padZero(minutes);
        this.milliseconds1 = this.padZero(seconds);
    }

    getComposant() {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.getAllComposant(),
            })
            .valueChanges.pipe(takeUntil(this.destroy$))
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.composantList = data.findAllComposant;
                }
            });
    }

    openNew() {
        this.creatComposantDialog = true;
        this.findAllComposant_Category();
    }

    findAllComposant_Category() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.findAllComposant_Category(),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.composantCategory = data.findAllComposant_Category.map(
                        (el) => {
                            return {
                                name: el._id,
                                value: el.category_composant,
                            };
                        },
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
                this.isLoading = loading;
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
                this.isLoading = loading;
                if (data) {
                }
            });

        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.saveTimeDiag(
                    this.selectedDi,
                    this.lapTime,
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.diDialogDiag[this.selectedDi] = false;
                }
            });

        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.diDiagnostiqueInPAUSE(
                    this.selectedDi_id,
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                }
            });

        this.addPauseLogs(this.selectedDi, 'diag');
        this.loadData(); // Use loadData instead of getAllTechDi
        this.startStopwatch();
    }

    getDataForTech() {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.getDataForTech(),
            })
            .valueChanges.pipe(takeUntil(this.destroy$))
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.dataBarChartIsReady = true;
                    this.techDataInfo = data.getDiStatusCounts;

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

                    this.barChart();
                }
            });
    }

    selectedDropDown(selectedItem) {
        this.composantSelected = selectedItem;
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

    getSeverity(status: string) {
        if (!status) return 'secondary';

        const map: Record<string, string> = {
            // ✅ SUCCESS (green)
            CREATED: 'success',
            FINISHED: 'success',

            // 🔵 INFO (in progress)
            DIAGNOSTIC: 'info',
            INDIAGNOSTIC: 'info',
            REPARATION: 'info',
            INREPARATION: 'info',

            // 🟡 WARNING (waiting / business steps)
            INMAGASIN: 'warning',
            MagasinEstimation: 'warning',
            PRICING: 'warning',
            NEGOTIATION1: 'warning',
            NEGOTIATION2: 'warning',

            // ⚫ NEUTRAL (pending)
            PENDING1: 'secondary',
            PENDING2: 'secondary',
            PENDING3: 'secondary',

            // 🔴 ERROR / CRITICAL
            RETOUR1: 'danger',
            RETOUR2: 'danger',
            RETOUR3: 'danger',

            // ⚫ SPECIAL
            ANNULER: 'contrast',
        };

        return map[status] || 'secondary';
    }

    updateDisableValues() {
        const isReperable = this.diagFormTech.get('isReparable')?.value ?? true;
        let isPdr = this.diagFormTech.get('isPdr')?.value ?? true;

        isReperable == false ? (isPdr = false) : (isPdr = isPdr);

        const isErrorFromFixtronixTech =
            this.diagFormTech.get('isErrorFromFixtronix')?.value ?? true;
        const isArrComposantEmpty =
            this.composantCombo.length === 0 ? true : false;

        this.disabledDiagnostiqueValue =
            isReperable && isPdr && isArrComposantEmpty;

        this.techRetourSendFinished = !(
            (isPdr === false && isErrorFromFixtronixTech === true) ||
            isReperable === false
        );

        this.disabledDiagnostiqueRetourValue =
            this.disabledDiagnostiqueValue || !this.techRetourSendFinished;

        this.cdr.detectChanges();
    }

    comboComposantandQuantity() {
        const selectedName = this.composantSelected.value.name;
        let composantSelected = {
            nameComposant: selectedName,
            quantity: this.diagFormTech.value.quantity,
        };
        this.composantCombo.push(composantSelected);
        this.composantList = this.composantList.filter(
            (composant) => composant.name !== selectedName,
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
                this.isLoading = loading;

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
                        this.isLoading = loading;
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
                            this.lapTime,
                        ),
                        useMutationLoading: true,
                    })
                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;

                        if (data) {
                            this.diDialogDiag[this.selectedDi] = false;
                        }
                    });

                setTimeout(() => {
                    this.loadData(); // Use loadData instead of getAllTechDi
                }, 1000);

                this.startStopwatch();
                this.diDialogDiag[this.selectedDi] = false;
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
                            this.isLoading = loading;

                            if (data) {
                                this.disable = data.tech_startDiagnostic;
                                this.cdr.detectChanges();
                                this.changeStatusMagasinEstimation(
                                    dataDiag._idDi,
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
                            this.isLoading = loading;
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
                            this.lapTime,
                        ),
                        useMutationLoading: true,
                    })
                    .subscribe(({ data }) => {
                        if (data) {
                            this.diDialogDiag[this.selectedDi] = false;
                        }
                    });

                this.ticketRefreshService.requestRefresh('tech-list', {
                    source: 'mutation:saveLogsDi',
                });

                this.startStopwatch();
                this.getComposant();
                this.diDialogDiag[this.selectedDi] = false;
                this.clearPersistedDialogState('diagnostic');
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
                            this.selectedDi_id,
                        ),
                    })
                    .subscribe(() => {});
                this.diDialogDiag[this.selectedDi] = false;
            },
        });
    }

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
                            this.isLoading = loading;
                            if (data) {
                                this.disable = data.tech_startDiagnostic;
                                this.cdr.detectChanges();
                                this.changeStatusMagasinEstimation(
                                    dataDiag._idDi,
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
                            this.isLoading = loading;
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
                            this.lapTime,
                        ),
                        useMutationLoading: true,
                    })
                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;

                        if (data) {
                            this.diDialogDiag[this.selectedDi] = false;
                        }
                    });

                this.ticketRefreshService.requestRefresh('tech-list', {
                    source: 'mutation:techFinishDiag',
                });

                this.startStopwatch();
                this.getComposant();
                this.diDialogDiag[this.selectedDi] = false;
                this.clearPersistedDialogState('diagnostic');
            },
        });
    }

    changeStatusToPending2(_id) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.changeStatusDiToPending2(_id),
            })
            .subscribe(({ loading }) => {
                this.isLoading = loading;
            });
    }

    confirmComposant() {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.responseConfirmerRecoitComposant(
                    this.selectedDi,
                ),
            })
            .subscribe(({ loading }) => {
                this.isLoading = loading;
            });
    }

    getTimeSpent(_idStat: string) {
        this.apollo
            .watchQuery<any>({
                query: this.ticketSerice.getLastPauseTime(_idStat),
            })
            .valueChanges.pipe(takeUntil(this.destroy$))
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
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
                this.applyPendingRestoredDialogState('diagnostic', _idStat);
            });
    }

    getTimeSpentRep(_idStat: string) {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getLastPauseTime(_idStat),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (
                    data &&
                    data.getLastPauseTime.rep_time &&
                    this.isValidTimeFormat(data.getLastPauseTime.rep_time)
                ) {
                    this.setInitialTime1(data.getLastPauseTime.rep_time);
                    this.startStopwatch1();
                } else {
                    this.setInitialTime1('00:00:00');
                    this.startStopwatch1();
                }
                this.applyPendingRestoredDialogState('repair', _idStat);
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

    lapTimeForPauseAndGetBack1(isFinishRep: boolean) {
        this.lap1();
        this.resetModalFormRep();

        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.finishReparation(
                    this.DiByStat,
                    this.remarqueReparationnn,
                ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data && !loading && this.DiByStat) {
                }
            });

        this.apollo
            .mutate<any>({
                mutation:
                    this.ticketSerice.lapTimeForPauseAndGetBackForReaparation(
                        this.statId,
                        this.lapTime1,
                    ),
                useMutationLoading: true,
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.setDiInReparationPause(this.selectedRep);
                    this.diDialogRep = false;
                }
            });

        if (!isFinishRep) {
            this.addPauseLogs(this.statId, 'rep');
        }

        this.loadData(); // Use loadData instead of getAllTechDi
        this.startStopwatch1();
    }

    setDiInReparationPause(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.diReperationInPAUSE(_id),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    // The pause mutation is chained one HTTP roundtrip after
                    // lapTimeForPauseAndGetBack1's synchronous loadData(),
                    // so the initial refresh reads stale INREPARATION. Also,
                    // the WS updateTicket payload carries no tech identifier,
                    // so the relevance filter in handleTechRealtimeMessage
                    // rejects it and no refresh is requested. Trigger one
                    // here, after the pause has actually persisted.
                    this.ticketRefreshService.requestRefresh('tech-list', {
                        source: 'mutation:setDiInReparationPause',
                    });
                }
            });
    }

    checkValueChanges() {
        this.diagFormTech
            .get('isPdr')
            ?.valueChanges.pipe(takeUntil(this.destroy$))
            .subscribe((value) => {
                this.hasPdr = value;
            });
    }

    checkValueChangesReperable() {
        this.diagFormTech
            .get('isReparable')
            ?.valueChanges.pipe(takeUntil(this.destroy$))
            .subscribe((value) => {
                this.isReperable = value;
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
                            this.remarqueReparationnn,
                        ),
                        useMutationLoading: true,
                    })
                    .subscribe(({ data, loading }) => {
                        this.isLoading = loading;
                        if (data && !loading && this.DiByStat) {
                            this.changeStatusToFinished(this.DiByStat);
                        }
                    });

                this.ticketRefreshService.requestRefresh('tech-list', {
                    source: 'mutation:finishReparation',
                });
                this.startStopwatch1();
                this.clearPersistedDialogState('repair');
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
        };

        this.payloadImage = payload;
    }

    allCategoryDi() {
        this.apollo
            .query<any>({
                query: this.ticketSerice.getAllDiCategory(),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;

                if (data) {
                    this.categorieDiListDropDown = data.findAllDiCategory.map(
                        (Category_DI) => ({
                            category: `${Category_DI.category}`,
                            value: Category_DI._id,
                        }),
                    );
                }
            });
    }

    deleteSelectedProducts(): void {
        this.confirmationService.confirm({
            message: 'Voulez vous supprimer ce composant de la liste',
            header: 'Confirm',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.composantCombo = this.composantCombo.filter(
                    (val) => !this.selectedComposants.includes(val),
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
        const index = this.composantCombo.findIndex((el) => {
            el.nameComposant === composant.nameComposant;
        });
        this.composantCombo.splice(index, 1);
        this.updateDisableValues();
    }
}
