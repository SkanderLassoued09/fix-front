import {
    ChangeDetectorRef,
    Component,
    DoCheck,
    OnDestroy,
    OnInit,
} from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TicketService } from 'src/app/demo/service/ticket.service';
import { MutationRunner } from 'src/app/demo/service/mutation-runner.service';
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
    isEmplacementVide as isEmplacementVideUtil,
    trackByColumn,
} from '../../table-display.utils';
import {
    isDiAssignedToMe,
    TechAssignmentKind,
} from './tech-ownership.util';
import {
    AutosaveHint,
    CategoryOption,
    ComposantOption,
    DiagnosticContext,
    DiagnosticDiSummary,
    DiagnosticProgress,
    DiagnosticStep,
    DiagnosticStepKey,
} from './diagnostic-modal/diagnostic-modal.types';

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
    /**
     * Set when the timer was frozen automatically by a page hide / refresh /
     * unexpected close (NOT a manual pause). On restore the dialog reopens and
     * the timer + status auto-resume to the active state, continuing from the
     * frozen value. A manual pause leaves this false, so it reopens paused.
     */
    autoPaused?: boolean;
    status?: string;
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
    // Part 4 — lifecycle auto-pause. `autoPausedByLifecycle` tracks an in-memory
    // pause we triggered on page-hide so we can auto-resume on return.
    // `dialogAutoPaused` is the flag we persist so a refresh-restore also resumes.
    private autoPausedByLifecycle = false;
    private dialogAutoPaused = false;
    private diagnosticTimerId: any = null;
    private repairTimerId: any = null;
    private dialogAutoSaveTimerId: any = null;
    private activeDiagnosticDraft = false;
    private diagCategorySourceRef: any[] | null = null;
    private diagCategoryOptionsCache: CategoryOption[] = [];
    private diagComposantSourceRef: any[] | null = null;
    private diagComposantOptionsCache: ComposantOption[] = [];

    baseUrl = environment.apiUrl;
    selectedComposants: any[] = [];
    diagFormTech = new FormGroup({
        _idDi: new FormControl(),
        diag_time: new FormControl(),
        remarqueTech: new FormControl(''),
        // New diagnostic-modal fields (UI only — not yet wired to backend
        // mutations). The redesigned wizard separates "description /
        // symptômes / remarque" into three distinct textareas. The legacy
        // `finish()` / `finishLogsDi()` mutations still consume only
        // `remarqueTech`; the other two stay local until the backend is
        // ready to receive them.
        symptomes: new FormControl(''),
        remarqueExtra: new FormControl(''),
        isPdr: new FormControl(true),
        isReparable: new FormControl(true),
        isErrorFromFixtronix: new FormControl(false),
        quantity: new FormControl(0),
        composantSelectedDropdown: new FormControl(),
        di_category_id: new FormControl(),
        composantSelected: new FormControl(),
    });

    /** Active step in the redesigned 5-step diagnostic wizard.
     *  Defaults to `'info'` (step 1) so a fresh diagModal open always lands
     *  on "Informations générales" rather than skipping ahead to the failure
     *  step. `diagModal` also explicitly resets this on every open so a
     *  previously closed-mid-flow modal doesn't reopen on the last step. */
    activeDiagStep: DiagnosticStepKey = 'info';
    diagModalVisibleVm = false;
    diagContextVm: DiagnosticContext | null = null;
    diagStepsVm: readonly DiagnosticStep[] = [];
    diagProgressVm: DiagnosticProgress = {
        completedSteps: 0,
        totalSteps: 0,
        percent: 0,
    };
    diagAutosaveVm: AutosaveHint = {
        state: 'idle',
        lastSavedAt: null,
    };
    diagClientLineVm = '';
    diagReparableLabelVm = 'Non défini';
    diagPdrLabelVm = 'Non défini';
    diagCategoryLabelVm = '';
    diagHeaderStatusToneVm: 'running' | 'paused' | 'info' | 'neutral' =
        'neutral';
    diagCanMinimizeVm = false;

    /**
     * Feature flag for the legacy single-screen diagnostic dialog. Set to
     * false now that the redesigned wizard (<app-diagnostic-modal>) is the
     * canonical UI. The old `<p-dialog>` markup remains in the template so
     * its TS-side bindings keep compiling — its `*ngIf` just never matches.
     * Flip back to `true` to re-enable the legacy view if needed.
     */
    readonly legacyDiagModalEnabled = false;

    /**
     * Same gate for the repair flow — the new `<app-tech-repair-list>`
     * modal is now the canonical UI. The legacy `<p-dialog>` markup
     * remains so its `diDialogRep` bindings keep compiling; its `*ngIf`
     * just never matches. Flip back to `true` to re-enable the legacy view.
     */
    readonly legacyRepModalEnabled = false;

    /** Controls the new redesigned repair modal. Mirrors `diagModalVisibleVm`. */
    showRepairModal = false;

    /** Snapshot of the row's DI passed to `<app-tech-repair-list>` when opened. */
    repairDiInputVm: DiagnosticDiSummary | null = null;

    /** True when the modal should open with the timer already paused (status === REPARATION_Pause). */
    repairInitiallyPaused: boolean = false;

    /** True while « Fin réparation » mutations are in flight (anti double-submit;
     *  disables the wizard's finish button). */
    repairFinishing = false;
    /** Pre-fill payload handed to the wizard on open (category, repair remark,
     *  already-selected parts) so the tech doesn't re-enter everything. */
    repairPrefill: {
        di_category_id?: string | null;
        remarqueExtra?: string;
        parts?: Array<{ nameComposant: string; reference?: string; quantity: number }>;
    } | null = null;
    /** Parts catalog + categories fed to the wizard's pickers. */
    repairPartOptions: Array<{ name: string; reference?: string }> = [];
    repairCategories: Array<{ _id: string; category: string }> = [];

    /**
     * Map a loosely-typed row payload into the strict `DiagnosticDiSummary`
     * shape expected by the new repair modal. Mirrors the implicit shape
     * the diagnostic modal feeds through `diagContextVm`.
     */
    /**
     * Optimistic row-level patch — when the user pauses/resumes inside an
     * open wizard, mutate the matching row in `techList` so the status
     * chip + tooltip + disabled buttons reflect the new state IMMEDIATELY,
     * before the Apollo round-trip + WS broadcast lands.
     *
     * This is the front-half of a two-step sync: the server-truth refresh
     * (`ticketRefreshService.requestRefresh('tech-list', …)`) runs in
     * parallel as the back-half. If they disagree, the refresh wins.
     *
     * Without this, the new status only appears after the 350ms debounced
     * refresh completes — long enough for the user to perceive the UI as
     * stale.
     *
     * Returns a NEW array (reference change) so any future migration to
     * OnPush on the list table picks up the diff cheaply.
     */
    private patchTechListRowStatus(diId: string, newStatus: string): void {
        if (!diId || !Array.isArray(this.techList) || this.techList.length === 0) {
            return;
        }
        // Use the friendly French label so the row chip reads "En pause" /
        // "En cours" instead of the raw enum code.
        const label = this.formatHeaderStatus(newStatus);
        let touched = false;
        this.techList = this.techList.map((row) => {
            if (!row) return row;
            const matches =
                row._id === diId ||
                row._idDi === diId ||
                row._idnum === diId;
            if (!matches) return row;
            touched = true;
            return { ...row, status: newStatus, statusLabel: label };
        });
        if (touched) {
            this.cdr.markForCheck();
        }
    }

    /**
     * Request a fresh `tech-list` query from the server. The
     * `ticketRefreshService` already debounces at 350ms across emitters,
     * so calling this from multiple sites (pause/resume/WS handler) is
     * safe — duplicate requests collapse to a single fetch.
     */
    private requestTechListRefresh(source: string): void {
        this.ticketRefreshService.requestRefresh('tech-list', { source });
    }

    /**
     * Mutual-exclusion helper — called at the top of `diagModal()` and
     * `repModal()` so opening one wizard always closes the other. The
     * persisted localStorage state is left intact: the user can still
     * reopen the closed wizard later (manually via the row button or
     * automatically on the next session restore). What we kill is only
     * the *visible* modal — its form values were already autosaved at
     * 1Hz so no data is lost.
     */
    private closeOppositeModal(opening: 'diagnostic' | 'repair'): void {
        if (opening === 'diagnostic') {
            // Tear down any open repair modal (new wizard + legacy flag).
            this.showRepairModal = false;
            this.diDialogRep = false;
            this.repairDiInputVm = null;
        } else {
            // Tear down any open diagnostic modal. We can't rely on
            // `selectedDi` here because the caller (`repModal`) has already
            // reassigned it to the repair DI's id by the time we run, so
            // checking `diDialogDiag[selectedDi]` would test the wrong key.
            // Iterate the whole map instead — only one entry can be true at
            // a time anyway.
            this.diagModalVisibleVm = false;
            this.diagContextVm = null;
            // Also drop the diagnostic draft flag — otherwise getActiveDialogMode()
            // could still read it as a live diagnostic while repair is open.
            this.activeDiagnosticDraft = false;
            if (this.diDialogDiag) {
                for (const k of Object.keys(this.diDialogDiag)) {
                    this.diDialogDiag[k] = false;
                }
            }
            // Drop the pending restore hint for diagnostic so the restore
            // pipeline doesn't immediately re-open it on the next change-
            // detection cycle.
            if (this.pendingRestoredDialogState?.mode === 'diagnostic') {
                this.pendingRestoredDialogState = null;
            }
        }
    }

    /**
     * Handler for the redesigned repair wizard's pause button. Mirrors
     * `onDiagPause()` for the diagnostic flow — branches between pause and
     * resume based on the current repair status, and updates the local
     * `di.status` so the header tone (paused/orange vs running/green) flips
     * immediately while the Apollo mutations are in flight.
     *
     * - When the repair stopwatch is running → fire
     *   `lapTimeForPauseAndGetBack1(false, keepOpen=true)` which saves the
     *   lap, calls `setDiInReparationPause` to transition the DI to
     *   REPARATION_Pause server-side, but skips the legacy
     *   `diDialogRep = false` that would close the new modal.
     * - When already paused → fire `changeStatusInReparation` to transition
     *   back to INREPARATION and resume the local timer state.
     */
    onRepairModalPause(): void {
        const currentStatus = this.di?.status ?? '';

        // Status is the authoritative source — branch on it first so we can't
        // accidentally re-pause a ticket that the server already considers
        // paused (which would corrupt the pause log + time accumulator), or
        // resume one that's already running.
        if (currentStatus === 'REPARATION_Pause') {
            // Paused -> Resume.
            // Optimistic UI first: list row + open `di` flip instantly
            // (no waiting on the mutation round-trip or WS broadcast).
            // Server-truth reconcile fires in parallel via the refresh
            // service.
            // Resume the server-anchored timer from the accumulated base; the
            // server stamps Stat.repRunStartedAt = now via changeStatusInRepair.
            // Mirror that anchor onto `this.di` so the restore-on-refresh
            // snapshot stays correct — otherwise it keeps the PRE-pause anchor
            // and double-counts the elapsed time after a reload.
            const resumeAnchor = Date.now();
            this.repairRunStartedAtMs = resumeAnchor;
            if (this.di) {
                this.di = {
                    ...this.di,
                    status: 'INREPARATION',
                    repRunStartedAt: new Date(resumeAnchor),
                };
                this.repairDiInputVm = this.mapDiToRepairSummary(this.di);
            }
            this.patchTechListRowStatus(this.di?._id, 'INREPARATION');

            // Close the open pause log first (stops backend pause accrual),
            // then transition the status back to INREPARATION.
            const openLog = this.getCurrentPauseLog(this.di?.pauseLogs);
            if (openLog && this.di?._id) {
                this.updatePauseLog(this.di._id, openLog._id);
            }
            // Mirror the diagnostic pattern: use the stable `selectedRep`
            // captured in `repModal()` rather than re-reading `_idDi` off
            // the optimistically-mutated `this.di`. `selectedRep` is set
            // once at modal open and matches what the pause mutation uses.
            const diId =
                this.selectedRep || (this.di as any)?._idDi;
            if (diId) {
                this.changeStatusInReparation(diId);
            } else {
                console.error(
                    '[onRepairModalPause][resume] ABORT — no Di id available',
                );
            }
            this.startStopwatch1();
            this.persistActiveDialogState('repair');
            this.requestTechListRefresh('action:repair-resume');
            return;
        }

        // Active -> Pause: optimistic UI, then persist + transition to
        // REPARATION_Pause.
        // Freeze the server-anchored timer FIRST: fold the current run leg into
        // the accumulated base and drop the anchor so the display stops advancing.
        this.repairElapsedBaseMs =
            this.repairElapsedBaseMs +
            (this.repairRunStartedAtMs
                ? Math.max(0, Date.now() - this.repairRunStartedAtMs)
                : 0);
        this.repairRunStartedAtMs = null;
        const frozenRepTime = this.msToTimeString(this.repairElapsedBaseMs);
        if (this.di) {
            // Carry the frozen rep_time + paused status onto `this.di` so the
            // restore-on-refresh snapshot reopens FROZEN (not auto-resumed) at
            // the exact displayed value.
            this.di = {
                ...this.di,
                status: 'REPARATION_Pause',
                rep_time: frozenRepTime,
            };
            this.repairDiInputVm = this.mapDiToRepairSummary(this.di);
        }
        this.patchTechListRowStatus(this.di?._id, 'REPARATION_Pause');
        // Persist EXACTLY the displayed (server-anchored) elapsed as rep_time so
        // a reopen/refresh restores the same frozen value. Pre-set lapTime1 and
        // mark the legacy timer stopped so lapTimeForPauseAndGetBack1's lap1()
        // (which only writes while isRunning1) can't overwrite it with the
        // now-anchored legacy value.
        this.lapTime1 = frozenRepTime;
        this.isRunning1 = false;
        this.startTime1 = 0;
        this.initialOffset1 = this.repairElapsedBaseMs;
        this.lapTimeForPauseAndGetBack1(false, /* keepOpen */ true);
        // Persist the dialog snapshot in its PAUSED form (status + frozen
        // rep_time) so restoreDialogState() reopens it paused on refresh instead
        // of replaying the stale INREPARATION snapshot — which repModal() would
        // auto-resume via changeStatusInReparation.
        this.persistActiveDialogState('repair');
        this.requestTechListRefresh('action:repair-pause');
    }

    /**
     * Bridge handler — when the new repair wizard's visibility flips, mirror
     * the change on the legacy `diDialogRep` flag so any downstream legacy
     * code paths reading it (timer pause-on-close, persistence) see a
     * consistent state.
     */
    onRepairModalVisibleChange(v: boolean): void {
        this.showRepairModal = v;
        this.diDialogRep = v;
        if (!v) {
            this.repairDiInputVm = null;
        }
    }

    /**
     * B1/B2 — « Fin réparation » from the redesigned wizard. Persists the used
     * parts + repair remark (B2), then finishes the repair and moves the DI to
     * FINISHED. Anti double-submit; one success toast; on error the modal stays
     * open + the button re-enables (no frozen spinner).
     */
    async onRepairModalFinish(payload: {
        remarque: string;
        parts: Array<{ nameComposant: string; quantity: number }>;
    }): Promise<void> {
        const diId = this.selectedRep || (this.di as any)?._idDi;
        if (!diId) {
            this.messageService.add({
                severity: 'error',
                summary: 'Erreur',
                detail: 'DI introuvable.',
            });
            return;
        }
        const key = `repairFinish:${diId}`;
        if (this.mutationRunner.isBusy(key)) return; // anti double-submit
        const remark = payload?.remarque ?? '';
        const parts = (payload?.parts ?? []).map((p) => ({
            nameComposant: p.nameComposant,
            quantity: p.quantity,
        }));

        try {
            // Serialized: saveRepairParts → tech_finishReperation →
            // changestatusToFinishReparation (FINISHED). step N+1 fires only
            // after N succeeds; any failure ABORTS the rest. Exactly ONE toast
            // (success only if the WHOLE chain succeeds, else one clear error —
            // no success-then-error double toast); anti double-submit; loading
            // reset on every path; no leaked subscription. FINISHED is reachable
            // from the tech's real state — INREPARATION *and* REPARATION_Pause
            // are both allowed sources in the M1 guard.
            await this.mutationRunner.runChain({
                key,
                steps: [
                    {
                        mutation: this.ticketSerice.saveRepairParts(
                            diId,
                            parts,
                            remark,
                        ),
                    },
                    {
                        mutation: this.ticketSerice.finishReparationSafe(
                            diId,
                            remark,
                        ),
                    },
                    { mutation: this.ticketSerice.changeFinishStatus(diId) },
                ],
                successToast: {
                    summary: 'Réparation terminée',
                    detail: 'DI clôturée (FINISHED).',
                },
                errorToast: {
                    summary: 'Erreur',
                    detail: 'Échec de la clôture. Réessayez.',
                },
                onLoading: (v) => (this.repairFinishing = v),
            });

            // Side effects ONLY after the whole cascade succeeded.
            this.stopRepairTimer();
            this.showRepairModal = false;
            this.diDialogRep = false;
            this.repairDiInputVm = null;
            this.repairPrefill = null;
            this.clearPersistedDialogState('repair');
            this.loadData();
            this.requestTechListRefresh('action:repair-finish');
        } catch (e) {
            // runChain already showed the single error toast + reset loading.
            // The modal stays open + the button re-enables so the tech retries.
            // Log the REAL underlying error (the actual failing step) for diag.
            console.error('[repair-finish] cascade failed:', e);
        }
    }

    /** Creation-photo URLs for the modal image block.
     *  - imageUrl: backend proxy that streams the (private Drive) file so it can
     *    be shown inline; empty when the DI has no image reference.
     *  - imageViewUrl: raw Drive viewer link for the "open in new tab" fallback
     *    (used if the proxy can't serve, e.g. legacy filename-only rows). */
    private resolveDiImage(di: any): {
        imageUrl: string;
        imageViewUrl: string;
    } {
        const raw = (di?.image ?? '').toString().trim();
        const id = di?._id ?? di?._idDi ?? '';
        if (!raw || !id) return { imageUrl: '', imageViewUrl: '' };
        const base = (this.baseUrl ?? '').replace(/\/$/, '');
        return {
            imageUrl: `${base}/di/${id}/image`,
            imageViewUrl: /^https?:\/\//i.test(raw) ? raw : '',
        };
    }

    private mapDiToRepairSummary(di: any): DiagnosticDiSummary {
        return {
            ...this.resolveDiImage(di),
            _id: di?._id ?? '',
            _idnum: di?._idnum ?? '',
            title: di?.title ?? '',
            description: di?.description ?? '',
            status: di?.status ?? '',
            statusLabel: this.formatHeaderStatus(di?.status, di?.statusLabel),
            // Handle both the nested tech-list shape (client { first_name,
            // last_name }, company { name }) and any pre-flattened row
            // (client_id/company_id as display strings).
            clientName:
                di?.clientName ||
                [di?.client?.first_name, di?.client?.last_name]
                    .filter(Boolean)
                    .join(' ')
                    .trim() ||
                (typeof di?.client_id === 'string' ? di.client_id : '') ||
                '',
            clientPhone:
                di?.clientPhone ?? di?.client?.phone ?? di?.clientPhone ?? '',
            companyName:
                di?.companyName ??
                di?.company?.name ??
                (typeof di?.company_id === 'string' ? di.company_id : '') ??
                '',
            locationName:
                di?.locationName ??
                di?.location_name ??
                di?.location?.location_name ??
                di?.location?.name ??
                (typeof di?.location_id === 'string' ? di.location_id : '') ??
                '',
            technicianName:
                di?.technicianName ??
                di?.techRep ??
                di?.id_tech_rep?.username ??
                '',
            ignoreCount: Number(di?.ignoreCount ?? 0),
            remarqueManager: di?.remarqueManager ?? '',
        };
    }

    /**
     * Map a raw backend status code (DIAGNOSTIC_Pause, INREPARATION, …)
     * into the user-facing label rendered inside the modal header pill.
     *
     * The user wants the same wording as the diagnostic flow:
     * "En pause" for any *_Pause state and "En cours" for any active
     * processing state. (The pill CSS already applies
     * `text-transform: uppercase`, so the visible result reads
     * "EN PAUSE" / "EN COURS".)
     *
     * Anything else falls back to whatever label the backend sent so we
     * don't accidentally hide a meaningful status.
     */
    private formatHeaderStatus(
        status: string | null | undefined,
        fallbackLabel?: string | null,
    ): string {
        const s = (status ?? '').toString();
        if (!s) return fallbackLabel ?? 'N/A';
        if (s.endsWith('_Pause')) return 'En pause';
        if (s === 'INREPARATION' || s === 'INDIAGNOSTIC') return 'En cours';
        return fallbackLabel ?? s;
    }

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

    // Server-anchored timer model fed to the new repair wizard
    // (<app-tech-repair-list>), mirroring how diagContextVm feeds the diagnostic
    // modal. Derived from persisted data (Stat.rep_time + Stat.repRunStartedAt +
    // DI.status) so the repair timer survives refresh / tabs / devices — no
    // localStorage. elapsed = base + (anchor ? now - anchor : 0).
    repairElapsedBaseMs: number = 0;
    repairRunStartedAtMs: number | null = null;

    // Server anchor for the DIAGNOSTIC run leg — the diagnostic twin of
    // `repairRunStartedAtMs`. Seeded from Stat.diagRunStartedAt (the DB is the
    // single source of truth), it replaced the localStorage wall-clock anchor
    // that drifted to 837:15:12 after long idle. elapsed = initialOffset (=
    // Stat.diag_time) + (diagRunStartedAtMs ? now - diagRunStartedAtMs : 0).
    // null ⇒ paused/stopped (frozen at initialOffset).
    diagRunStartedAtMs: number | null = null;

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
        private readonly mutationRunner: MutationRunner,
    ) {
        this.idTech = localStorage.getItem('_id');
    }

    // ── Technician-ownership gating for the Diagnostic / Réparation buttons ──
    // A DI is "mine" only if I am the assigned diag/rep technician. An
    // ADMIN_TECH sees every DI (server returns all for admin roles) but must
    // only ACT on their own — others stay greyed. Read the identity fresh from
    // storage (not the constructor snapshot, which can be empty on a restored
    // session) and match on _id OR username via the shared pure util, so a DI
    // stored under either identity token still resolves to its owner.

    private currentUserTokens(): Array<string | null> {
        return [
            localStorage.getItem('_id'),
            localStorage.getItem('username'),
        ];
    }

    isDiAssignedToMe(row: any, kind: TechAssignmentKind): boolean {
        return isDiAssignedToMe(row, kind, this.currentUserTokens());
    }

    private isDiagStatusActive(row: any): boolean {
        return ['DIAGNOSTIC', 'INDIAGNOSTIC', 'DIAGNOSTIC_Pause'].includes(
            row?.status,
        );
    }

    private isRepStatusActive(row: any): boolean {
        return ['REPARATION', 'INREPARATION', 'REPARATION_Pause'].includes(
            row?.status,
        );
    }

    /** Enable rule for the Diagnostic action button on a row. */
    canDiagnose(row: any): boolean {
        return (
            this.isDiagStatusActive(row) &&
            !this.isFinishedDiag[row?._id] &&
            this.isDiAssignedToMe(row, 'diag')
        );
    }

    /** Enable rule for the Réparation action button on a row. */
    canRepair(row: any): boolean {
        return (
            this.isRepStatusActive(row) &&
            !this.isFinishedRep[row?._id] &&
            this.isDiAssignedToMe(row, 'rep')
        );
    }

    /** Tooltip that explains a greyed button (another tech's DI). */
    diagTooltip(row: any): string {
        return this.isDiagStatusActive(row) &&
            !this.isDiAssignedToMe(row, 'diag')
            ? "DI d'un autre technicien"
            : 'Diagnostic';
    }

    repTooltip(row: any): string {
        return this.isRepStatusActive(row) && !this.isDiAssignedToMe(row, 'rep')
            ? "DI d'un autre technicien"
            : 'Réparation';
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
            .pipe(debounceTime(150), takeUntil(this.destroy$))
            .subscribe(() => {
                this.persistActiveDialogState();
                this.refreshDiagnosticVm();
            });

        this.remarque.valueChanges
            .pipe(debounceTime(150), takeUntil(this.destroy$))
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
        this.startDialogAutoSave();

        // Part 4 — auto-pause an in-progress diag/rep when the tab is hidden /
        // refreshed / closed, and auto-resume when it comes back. visibilitychange
        // is the reliable "going away" signal (fires before unload, and on mobile
        // where beforeunload doesn't); beforeunload is the desktop backup that
        // guarantees the frozen snapshot is persisted before the page reloads.
        document.addEventListener(
            'visibilitychange',
            this.onDocumentVisibilityChange,
        );
        window.addEventListener('beforeunload', this.onWindowBeforeUnload);

        // Initial load
        this.loadData();
    }

    ngOnDestroy() {
        this.stopDialogAutoSave();
        this.stopDiagnosticTimer();
        this.stopRepairTimer();
        document.removeEventListener(
            'visibilitychange',
            this.onDocumentVisibilityChange,
        );
        window.removeEventListener('beforeunload', this.onWindowBeforeUnload);
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

    /** Point LOCATION : emplacement vide → vert, renseigné → rouge. */
    isEmplacementVide(row: any, field: string): boolean {
        return isEmplacementVideUtil(row, field);
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
        const status = isDiagnostic
            ? this.di?.status || this.diStatus
            : undefined;
        const snapshot = statSnapshot || this.di;

        const state: PersistedTechDialogState = {
            mode: activeMode,
            diId,
            statId,
            startedAt: Date.now(),
            savedAt: Date.now(),
            initialElapsedMs: liveAccumulatedMs,
            wasRunning,
            autoPaused: this.dialogAutoPaused,
            status,
            statSnapshot: snapshot
                ? {
                      ...snapshot,
                      status: status || snapshot.status,
                  }
                : snapshot,
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
        // Repair is authoritative when its wizard is open: check it FIRST and via
        // its OWN visibility flags. A diagnostic flag left set by a prior session
        // or an async query callback must never mis-tag a live repair as
        // diagnostic (that was the "refresh in Réparation reopens Diagnostic" bug).
        if (this.showRepairModal || this.diDialogRep) {
            return 'repair';
        }

        if (this.selectedDi && this.diDialogDiag[this.selectedDi]) {
            return 'diagnostic';
        }

        if (this.activeDiagnosticDraft && this.selectedDi && this.selectedDi_id) {
            return 'diagnostic';
        }

        return null;
    }

    private startDialogAutoSave(): void {
        if (this.dialogAutoSaveTimerId) {
            return;
        }

        this.dialogAutoSaveTimerId = window.setInterval(() => {
            this.persistActiveDialogState();
        }, 1000);
    }

    private stopDialogAutoSave(): void {
        if (!this.dialogAutoSaveTimerId) {
            return;
        }

        clearInterval(this.dialogAutoSaveTimerId);
        this.dialogAutoSaveTimerId = null;
    }

    // ───────────────────────────────────────────────────────────────
    // Part 4 — lifecycle auto-pause / resume (refresh, tab switch, close)
    // ───────────────────────────────────────────────────────────────
    private readonly onDocumentVisibilityChange = (): void => {
        if (document.visibilityState === 'hidden') {
            this.freezeActiveDialogForLifecycle();
        } else if (document.visibilityState === 'visible') {
            this.resumeActiveDialogAfterLifecyclePause();
        }
    };

    private readonly onWindowBeforeUnload = (): void => {
        // Backup for the visibilitychange:hidden freeze above. Usually a no-op
        // (hidden fires first and already flipped the DI to *_Pause), but if it
        // didn't, this still freezes + persists so the reopen never counts the
        // closed-tab idle.
        this.freezeActiveDialogForLifecycle();
    };

    /**
     * Freeze the active diag/rep on page-hide / refresh / close: reuse the
     * tested pause toggle so the timer folds its run-leg into the accumulated
     * base (no wall-clock idle is ever counted), the DI transitions to its
     * *_Pause status server-side, and the snapshot is persisted with
     * `autoPaused = true` so a refresh-restore knows to auto-resume.
     */
    private freezeActiveDialogForLifecycle(): void {
        const mode = this.getActiveDialogMode();
        if (!mode) return;
        const status = this.di?.status ?? '';
        // Already paused (manually or by a prior freeze) — don't double-pause.
        if (status.endsWith('_Pause')) return;
        const running =
            mode === 'repair' ? !!this.repairRunStartedAtMs : this.isRunning;
        if (!running) return;

        this.autoPausedByLifecycle = true;
        this.dialogAutoPaused = true; // picked up by persistActiveDialogState()
        if (mode === 'repair') {
            this.onRepairModalPause();
        } else {
            this.onDiagPause();
        }
    }

    /**
     * Resume a dialog we auto-paused on hide, when the tab becomes visible
     * again (the modal is still mounted). The frozen base is preserved, so the
     * counter continues from exactly where it stopped and the status returns to
     * the active state (the M1 guard allows *_Pause → active).
     */
    private resumeActiveDialogAfterLifecyclePause(): void {
        if (!this.autoPausedByLifecycle) return;
        this.autoPausedByLifecycle = false;
        this.dialogAutoPaused = false;
        const mode = this.getActiveDialogMode();
        if (!mode) return; // modal was closed while hidden
        const status = this.di?.status ?? '';
        if (!status.endsWith('_Pause')) return; // already resumed elsewhere
        if (mode === 'repair') {
            this.onRepairModalPause(); // status-driven toggle → resume
        } else {
            this.onDiagPause();
        }
    }

    private clearPersistedDialogState(mode?: TechDialogMode): void {
        const existing = this.readPersistedDialogState();

        if (!existing || !mode || existing.mode === mode) {
            localStorage.removeItem(this.dialogStateStorageKey);
        }

        if (!mode || mode === 'diagnostic') {
            this.activeDiagnosticDraft = false;
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

        // Keep the persisted snapshot available so that IF the tech re-opens
        // the same DI's Diagnostic/Réparation modal manually, their in-progress
        // form + timer are restored (applyPendingRestoredDialogState, called
        // from diagModal()/repModal()). We deliberately DO NOT auto-open the
        // modal here: it must only ever open on an explicit Diagnostic /
        // Réparation click — never by itself on page load / refresh.
        this.pendingRestoredDialogState = state;
        console.debug({
            event: 'tech.dialog.restore_ready',
            mode: state.mode,
            statId: state.statId,
            diId: state.diId,
        });
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
        const wasRunning =
            state.wasRunning !== undefined ? !!state.wasRunning : true;
        const savedAccumulatedMs =
            (state.initialElapsedMs || 0) +
            (wasRunning ? Math.max(0, Date.now() - (state.savedAt || Date.now())) : 0);
        // Older persisted entries didn't carry wasRunning — fall back to
        // resuming so we don't accidentally freeze a timer that was live.

        if (mode === 'diagnostic') {
            // The diagnostic timer base (Stat.diag_time) and run anchor
            // (Stat.diagRunStartedAt) were ALREADY loaded from the server by
            // getTimeSpent() — the authoritative single source of truth, with
            // the stopwatch already started/frozen per the live status. We must
            // NOT re-apply the localStorage `savedAccumulatedMs` here: it folded
            // in a `now - savedAt` term that drifted to 837:15:12 once the app
            // had been closed for a while. localStorage is now only a cache.
            // Just reconcile the optimistic status and re-render the server value.
            if (state.status) {
                this.diStatus = state.status;
                if (this.di) {
                    this.di = {
                        ...this.di,
                        status: state.status,
                    };
                }
            }
            this.renderDiagnosticElapsed(this.computeLiveElapsedDiag());
            this.refreshDiagnosticVm();
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

        // Capture BEFORE we clear the pending state below.
        const shouldAutoResume = !!state.autoPaused;

        this.pendingRestoredDialogState = null;
        this.persistActiveDialogState();

        if (shouldAutoResume) {
            // Part 4 — this session was frozen by a refresh / close while running
            // (status was flipped to *_Pause and the elapsed frozen above, so no
            // closed-tab idle was counted). The modal has now reopened at that
            // frozen value; resume it so the counter continues from where it
            // stopped and the status returns to the active state (the M1 guard
            // allows *_Pause → active). A MANUAL pause leaves autoPaused false,
            // so it stays paused here.
            this.autoPausedByLifecycle = true;
            this.resumeActiveDialogAfterLifecyclePause();
        }
    }

    getCurrentPauseLog(pauseLogs) {
        const findNull = (pauseLogs ?? []).find((log) => log.pauseEnd === null);
        return findNull;
    }

    async diagModal(di) {
        this.composantSelected = null;
        // Mutual exclusion — opening a diagnostic must close any open repair
        // modal. Without this, the persisted-state restoration on init can
        // open the repair modal first, and then a user-triggered diagnostic
        // would stack on top. The autosave (1Hz) has already flushed any
        // in-flight repair form changes so closing here is safe.
        this.closeOppositeModal('diagnostic');

        try {
            const isRestoringDiagnostic =
                this.pendingRestoredDialogState?.mode === 'diagnostic' &&
                this.pendingRestoredDialogState.statId === di._id;

            // NOTE: do NOT call `updatePauseLog` here. Same reason as
            // `repModal`: stamping `pauseEnd: now()` on the open log makes
            // the backend treat this as a resume, silently flipping the
            // status back to INDIAGNOSTIC. The resume call lives in
            // `onDiagPause()` under the "Paused -> Resume" branch.

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

            // Don't auto-transition to INDIAGNOSTIC if the user is reopening a
            // paused ticket — the explicit Resume button is the only path
            // out of DIAGNOSTIC_Pause. Skipping this also matches the
            // symmetric guard in repModal() for REPARATION_Pause.
            if (!isRestoringDiagnostic && di?.status !== 'DIAGNOSTIC_Pause') {
                promises.push(this.changeStatus(di._idDi));
            }
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

                // Merge the rich DI fields fetched by `getDiById` (title,
                // status, description, remarque_manager, client, company with
                // service contacts) INTO the row-shape `di` so `buildDiSummary`
                // sees everything. The row-shape's `_id`/_idDi take precedence
                // because they reference the Stat row the modal is anchored on.
                //
                // BUT the tech-list row carries a STRIPPED entity — its query
                // selects only `company { _id name fax }` / `client { … phone }`
                // with NO service contacts. `getDiById` returns the FULLY
                // populated company (serviceAchat/Technique/Financier) and
                // client. Spreading `di` last clobbered the populated objects
                // with the stripped ones, so the sidebar fell back to
                // "Non renseigné". Pin the populated entities from `detailsDi`
                // LAST so they always win; `detailsDi` is authoritative (the
                // object is `null` when the DI has no company/client).
                this.di = {
                    ...detailsDi,
                    ...di,
                    company: detailsDi.company ?? null,
                    client: detailsDi.client ?? null,
                };
                this.selectedDi = di._id;
                // Always open on step 1 (Informations générales). Without this
                // the field is left to whatever it carried last time (e.g.
                // 'validation' if the user closed mid-flow), and the persisted
                // restore-on-init only sets it when the modal is restored, not
                // when manually reopened.
                this.activeDiagStep = 'info';
                this.imageValue = detailsDi.image;
                this.selectedDi_id = di._idDi;
                this.diStatus = di.status;
                this.ignoreCount = di.ignoreCount;

                this.diDialogDiag[di._id] = true;
                this.diagModalVisibleVm = true;
                this.activeDiagnosticDraft = true;
                this.persistActiveDialogState('diagnostic', di);
                this.updateDisableValues();
                this.refreshDiagnosticVm();
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

        this.diagFormTech.patchValue(
            {
                _idDi: di._id,
                diag_time: di.diag_time || dataLogs.diag_time || '',
                remarqueTech:
                    di.remarqueTech ||
                    dataLogs.remarque_tech_diagnostic ||
                    '',
                isPdr: di.isPdr || dataLogs.contain_pdr || true,
                di_category_id:
                    di.di_category_id || dataLogs.di_category_id || true,
                isReparable:
                    di.isReparable || dataLogs.can_be_repaired || true,
                quantity: di.quantity || 0,
                composantSelectedDropdown:
                    di.composantSelectedDropdown ?? dataLogs.array_composants,
            },
            { emitEvent: false },
        );

        this.composantCombo = dataLogs.array_composants;
        this.allComposantLogsAndOriginal = [...dataLogs.array_composants];
    }

    private processDiagnosticWithoutLogs(di, detailsDi) {
        this.diagFormTech.patchValue(
            {
                _idDi: di._id,
                diag_time: di.diag_time || detailsDi.diag_time || '',
                remarqueTech:
                    this.cleanStr(di.remarqueTech) ||
                    this.cleanStr(detailsDi.remarque_tech_diagnostic) ||
                    '',
                isPdr: di.isPdr || detailsDi.contain_pdr || true,
                isReparable:
                    di.isReparable || detailsDi.can_be_repaired || true,
                di_category_id:
                    di.di_category_id || detailsDi.di_category_id || '',
                quantity: di.quantity || 0,
                composantSelectedDropdown:
                    di.composantSelectedDropdown ?? detailsDi.array_composants,
            },
            { emitEvent: false },
        );

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
        // NOTE: do NOT call `updatePauseLog` here even if the DI is in
        // REPARATION_Pause. That mutation stamps `pauseEnd: now()` on the
        // open pause log, which the backend treats as "user resumed work" —
        // transitioning the DI back to INREPARATION on the next refresh.
        // The user must explicitly click Reprendre to end the pause. The
        // resume call lives in `onRepairModalPause()`.
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
                            this.cleanStr(di.remarque_tech_repair) ||
                            this.cleanStr(detailsDi.remarque_tech_repair) ||
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

                        // B3 — pre-fill the redesigned repair wizard from the DI
                        // so the tech doesn't re-enter category / remark / parts.
                        this.repairPrefill = {
                            di_category_id: detailsDi.di_category_id ?? null,
                            remarqueExtra:
                                di.remarque_tech_repair ||
                                detailsDi.remarque_tech_repair ||
                                '',
                            parts: (detailsDi.array_composants || []).map(
                                (c: any) => ({
                                    nameComposant: c.nameComposant,
                                    reference: c.reference ?? '',
                                    quantity: c.quantity,
                                }),
                            ),
                        };
                        // Feed the wizard's pickers from the catalogs already
                        // loaded by the host (best-effort — empty until loaded).
                        this.repairPartOptions = (this.composantList || []).map(
                            (c: any) => ({
                                name: c.name,
                                reference: c.package ?? '',
                            }),
                        );
                        this.repairCategories = (
                            this.composantCategory || []
                        ).map((c: any) => ({ _id: c.name, category: c.value }));
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

                // NOTE: do NOT set `this.diDialogDiag[di._id] = true` here — this
                // is the REPAIR modal. Flagging the diagnostic dialog as open made
                // `getActiveDialogMode()` report 'diagnostic' for a live repair
                // (and because this runs in an async query callback it fired AFTER
                // `closeOppositeModal('repair')` had cleared the flag). The 1Hz
                // autosave then persisted mode='diagnostic', so a refresh reopened
                // Diagnostic instead of Réparation. The repair wizard is tracked
                // by `showRepairModal` / `diDialogRep` only.
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
        this.ignoreCount = di.ignoreCount;
        this.resetModalForm();
        // `resetModalForm()` nulls `this.di` (it clears the diagnostic form and
        // the working DI). Assign the repair DI AFTER the reset so the
        // pause/resume handler `onRepairModalPause()` can branch on
        // `this.di.status`. Previously `this.di` was set on the line above and
        // immediately nulled here, leaving it null at click time — so every
        // header click was treated as a pause (Reprendre never resumed) and the
        // optimistic `if (this.di)` UI update was skipped (header pill stuck).
        // The diagnostic flow is immune because it branches on `diStatus`, not
        // `this.di`; this realigns repair with that reliability.
        this.di = { ...di };
        this.selectedDi = di._id;
        // Mutual exclusion — opening a repair must close any open diagnostic.
        // Otherwise a restored-on-init diagnostic stacks under the manually-
        // opened repair, leaving two modals visible at once.
        this.closeOppositeModal('repair');
        this.diDialogRep = true;
        // Mirror what diagModal() does for the diagnostic flow: snapshot the
        // row into a normalized DI summary and flip the new redesigned modal
        // open. The legacy `<p-dialog>` above is gated by
        // `legacyRepModalEnabled` so only the new wizard renders.
        this.repairDiInputVm = this.mapDiToRepairSummary(di);
        // Hint the modal to start paused if the DI is already in
        // REPARATION_Pause — otherwise the timer would tick while showing
        // a paused server status.
        this.repairInitiallyPaused = di?.status === 'REPARATION_Pause';
        // Seed the server-anchored repair timer from the row's persisted data:
        //   - paused          → frozen at accumulated rep_time (no anchor)
        //   - already running → use the persisted run-leg start (survives refresh)
        //   - fresh start     → anchor "now"; the open auto-transition stamps
        //                       Stat.repRunStartedAt = now server-side to match.
        this.repairElapsedBaseMs = this.timeStringToMs(di?.rep_time || '00:00:00');
        if (di?.status === 'REPARATION_Pause') {
            this.repairRunStartedAtMs = null;
        } else if (di?.status === 'INREPARATION') {
            this.repairRunStartedAtMs = di?.repRunStartedAt
                ? new Date(di.repRunStartedAt).getTime()
                : Date.now();
        } else {
            this.repairRunStartedAtMs = Date.now();
        }
        this.showRepairModal = true;
        this.persistActiveDialogState('repair', di);
        this.getTimeSpentRep(di._id);
        this.getImage(di._idDi);
        // Only transition the DI to INREPARATION when it's NOT already paused.
        // Otherwise reopening a paused ticket would silently revive it on the
        // server and the user's pause would be lost.
        if (di?.status !== 'REPARATION_Pause') {
            this.changeStatusInReparation(di._idDi);
        }
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
        console.log(
            '[changeStatusInReparation] Apollo mutate _id=',
            _id,
        );
        this.apollo
            .mutate<Boolean>({
                mutation: this.ticketSerice.changeStatusInRepair(_id),
            })
            .subscribe({
                next: ({ data, loading }) => {
                    console.log(
                        '[changeStatusInReparation] response data=',
                        data,
                        'loading=',
                        loading,
                    );
                    this.isLoading = loading;
                },
                error: (err) => {
                    console.error(
                        '[changeStatusInReparation] GraphQL error:',
                        err,
                    );
                },
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
        // Single source of truth: the run leg is anchored to the SERVER's
        // Stat.diagRunStartedAt (mirrored into diagRunStartedAtMs), never a
        // local startTime read back from localStorage — that drifted to
        // 837:15:12 when the app sat closed for a long time. null anchor ⇒
        // paused/stopped ⇒ frozen at the accumulated base.
        return (
            (this.initialOffset || 0) +
            (this.diagRunStartedAtMs
                ? Math.max(0, Date.now() - this.diagRunStartedAtMs)
                : 0)
        );
    }

    private computeLiveElapsedRep(): number {
        const running = this.isRunning1 && this.startTime1 > 0;
        return (
            (this.initialOffset1 || 0) +
            (running ? Math.max(0, Date.now() - this.startTime1) : 0)
        );
    }

    private renderDiagnosticElapsed(elapsedTime: number): void {
        this.minutes = this.padZero(
            Math.floor(elapsedTime / (1000 * 60 * 60)),
        );
        this.seconds = this.padZero(
            Math.floor((elapsedTime % (1000 * 60 * 60)) / (1000 * 60)),
        );
        this.milliseconds = this.padZero(
            Math.floor((elapsedTime % (1000 * 60)) / 1000),
        );
    }

    private markDiagnosticPausedFrontend(): void {
        this.diStatus = 'DIAGNOSTIC_Pause';
        if (this.di) {
            this.di = {
                ...this.di,
                status: 'DIAGNOSTIC_Pause',
            };
        }
    }

    startStopwatch(anchorMs?: number) {
        if (!this.isRunning) {
            this.isRunning = true;
            // Prefer the authoritative server anchor (Stat.diagRunStartedAt,
            // passed by getTimeSpent / resume) so elapsed survives refresh and
            // never drifts. Fall back to "now" only for a fresh start the
            // server is stamping in parallel.
            this.startTime = anchorMs ?? Date.now();
            this.diagRunStartedAtMs = this.startTime;
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
            this.renderDiagnosticElapsed(elapsedTime);
            // Persist live accumulated every tick so a crash loses at most
            // ~1s of work, never wall-clock idle while disconnected.
            this.persistActiveDialogState();
            this.refreshDiagnosticVm();
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
            // NO leading space — this string is persisted as Stat.diag_time; a
            // leading " " produced `" 00:15:02"` in DB, which the HH:MM:SS regex
            // then rejected → the timer reset to 0 (data loss).
            this.lapTime = `${this.minutes}:${this.seconds}:${this.milliseconds}`;
        }
    }

    lap1() {
        if (this.isRunning1) {
            // NO leading space (persisted as Stat.rep_time). See `lap()`.
            this.lapTime1 = `${this.minutes1}:${this.seconds1}:${this.milliseconds1}`;
        }
    }

    reset() {
        this.stopDiagnosticTimer();
        this.minutes = '00';
        this.seconds = '00';
        this.milliseconds = '00';
        this.startTime = 0;
        this.diagRunStartedAtMs = null;
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

        if (this.isRunning && this.diagRunStartedAtMs) {
            // Freeze the elapsed time of the current run leg into the
            // accumulated offset, using the SERVER anchor. After this, any
            // wall-clock time that passes while stopped is *not* counted.
            this.initialOffset =
                (this.initialOffset || 0) +
                Math.max(0, Date.now() - this.diagRunStartedAtMs);
            console.debug({
                event: 'tech.timer.stopped',
                mode: 'diagnostic',
                statId: this.selectedDi,
                accumulatedMs: this.initialOffset,
            });
        }

        this.startTime = 0;
        this.diagRunStartedAtMs = null;
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
        // Defensive trim — tolerate any legacy DB value stored with a leading/
        // trailing space (`" 00:15:02"`) so it parses instead of resetting to 0.
        const s = (timeString ?? '').trim();
        if (!this.isValidTimeFormat(s)) {
            return 0;
        }

        const [hours, minutes, seconds] = s.split(':').map(Number);
        return hours * 60 * 60 * 1000 + minutes * 60 * 1000 + seconds * 1000;
    }

    /** Inverse of timeStringToMs — "HH:MM:SS" for persisting rep_time. */
    private msToTimeString(ms: number): string {
        const total = Math.max(0, Math.floor(ms / 1000));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        return `${this.padZero(h)}:${this.padZero(m)}:${this.padZero(s)}`;
    }

    setInitialTime(timeString: string) {
        const s = (timeString ?? '').trim(); // tolerate legacy spaced values
        const [hours, minutes, seconds] = s.split(':').map(Number);
        // Reset run-leg state — the offset is the new floor, no idle to fold.
        // Drop any stale anchor; the caller re-anchors from the server next.
        this.startTime = 0;
        this.diagRunStartedAtMs = null;
        this.isRunning = false;
        this.initialOffset = this.timeStringToMs(s);
        this.minutes = this.padZero(hours);
        this.seconds = this.padZero(minutes);
        this.milliseconds = this.padZero(seconds);
    }

    setInitialTime1(timeString: string) {
        const s = (timeString ?? '').trim(); // tolerate legacy spaced values
        const [hours, minutes, seconds] = s.split(':').map(Number);
        this.startTime1 = 0;
        this.isRunning1 = false;
        this.initialOffset1 = this.timeStringToMs(s);
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
                    this.refreshDiagnosticVm();
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
        if (!this.selectedDi || !this.selectedDi_id) {
            return;
        }

        this.stopDiagnosticTimer();
        this.renderDiagnosticElapsed(this.computeLiveElapsedDiag());
        this.markDiagnosticPausedFrontend();
        // NO leading space (persisted as Stat.diag_time). See `lap()`.
        this.lapTime = `${this.minutes}:${this.seconds}:${this.milliseconds}`;
        this.persistActiveDialogState('diagnostic');
        this.refreshDiagnosticVm();

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
            .pipe(takeUntil(this.destroy$))
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
            .pipe(takeUntil(this.destroy$))
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.persistActiveDialogState('diagnostic');
                }
            });

        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.diDiagnostiqueInPAUSE(
                    this.selectedDi_id,
                ),
                useMutationLoading: true,
            })
            .pipe(takeUntil(this.destroy$))
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    this.markDiagnosticPausedFrontend();
                    this.refreshDiagnosticVm();
                    this.persistActiveDialogState('diagnostic');
                }
            });

        this.addPauseLogs(this.selectedDi, 'diag');
        this.loadData(); // Use loadData instead of getAllTechDi
        this.persistActiveDialogState('diagnostic');
        this.refreshDiagnosticVm();
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
        this.diagFormTech
            .get('composantSelected')
            ?.setValue(selectedItem?.value ?? selectedItem ?? null);
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

        // « Finir diag » n'est JAMAIS gaté par la sélection PDR : conclure un
        // diagnostic sans aucune pièce est un cas valide, donc décocher la
        // dernière PDR ne doit plus rien bloquer (l'ancienne règle
        // `isReperable && isPdr && listeVide` désactivait le bouton, et le
        // faisait même dès l'ouverture puisque `isPdr` vaut true par défaut).
        // La cohérence est assurée côté routage : `techFinishDiag` dérive `pdr`
        // de la liste RÉELLE, donc 0 pièce part en tarification au lieu du
        // Magasin (qui recevrait une demande de pièces vide).
        this.disabledDiagnostiqueValue = false;

        this.techRetourSendFinished = !(
            (isPdr === false && isErrorFromFixtronixTech === true) ||
            isReperable === false
        );

        this.disabledDiagnostiqueRetourValue =
            this.disabledDiagnostiqueValue || !this.techRetourSendFinished;

        this.cdr.detectChanges();
    }

    private resolveSelectedComposantName(): string | null {
        const formSelection =
            this.diagFormTech.get('composantSelected')?.value ?? null;
        const legacySelection = this.composantSelected ?? null;
        const selected = formSelection ?? legacySelection?.value ?? legacySelection;

        if (typeof selected === 'string') {
            return selected.trim() || null;
        }

        const name = selected?.name ?? selected?.nameComposant ?? null;
        return typeof name === 'string' && name.trim() ? name.trim() : null;
    }

    private resolveSelectedQuantity(): number | null {
        const rawQuantity = this.diagFormTech.get('quantity')?.value;
        const quantity =
            typeof rawQuantity === 'number'
                ? rawQuantity
                : Number(rawQuantity);

        if (!Number.isFinite(quantity) || quantity <= 0) {
            return null;
        }

        return quantity;
    }

    private showComponentAddValidation(detail: string): void {
        this.messageService.add({
            severity: 'warn',
            summary: 'Composant requis',
            detail,
            life: 2500,
        });
    }

    comboComposantandQuantity(): void {
        const selectedName = this.resolveSelectedComposantName();
        if (!selectedName) {
            this.showComponentAddValidation(
                'Sélectionnez un composant avant de l’ajouter.',
            );
            return;
        }

        const quantity = this.resolveSelectedQuantity();
        if (quantity === null) {
            this.showComponentAddValidation(
                'Indiquez une quantité valide supérieure à 0.',
            );
            return;
        }

        const composantSelected = {
            nameComposant: selectedName,
            quantity,
        };

        this.composantCombo = [
            ...(this.composantCombo ?? []),
            composantSelected,
        ];
        this.composantList = (this.composantList ?? []).filter(
            (composant) => composant?.name !== selectedName,
        );

        this.composantSelected = null;
        this.diagFormTech.patchValue(
            {
                composantSelected: null,
            },
            { emitEvent: false },
        );
        this.updateDisableValues();
        this.refreshDiagnosticVm();
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

    techFinishDiag(opts: { notReparable?: boolean } = {}) {
        const isNotReparable = !!opts.notReparable;
        this.confirmationService.confirm({
            message: isNotReparable
                ? 'Marquer ce DI comme non réparable et clôturer ?'
                : 'Voulez vous confirmer les changements',
            header: isNotReparable
                ? 'Clôture non réparable'
                : 'Confirmation Diagnostique',
            icon: isNotReparable
                ? 'pi pi-times-circle'
                : 'pi pi-exclamation-triangle',
            accept: async () => {
                const dataDiag = {
                    _idDi: this.selectedDi_id,
                    // getRawValue: the PDR control is DISABLED when the DI is
                    // non-réparable, and disabled controls are dropped from
                    // `.value` — read the raw (forced-false) value instead.
                    //
                    // Dérivé de la liste RÉELLE : 0 pièce ⇒ pas de PDR, quel que
                    // soit le toggle. Sans ça, un diag terminé avec le toggle ON
                    // mais aucune pièce partirait au Magasin avec une demande
                    // vide — c'est ce que l'ancienne garde du bouton empêchait.
                    pdr:
                        !!this.diagFormTech.getRawValue().isPdr &&
                        this.composantCombo.length > 0,
                    // Force `reparable: false` on the non-réparable shortcut
                    // so the backend snapshot is consistent with the FINISHED
                    // transition (no PDR step required either).
                    reparable: isNotReparable
                        ? false
                        : this.diagFormTech.value.isReparable,
                    remarqueTech: this.diagFormTech.value.remarqueTech,
                    di_category_id: this.diagFormTech.value.di_category_id,
                    isErrorFromFixtronix:
                        this.diagFormTech.value.isErrorFromFixtronix ?? false,
                    // No composant required for a non-réparable DI — skip the
                    // PDR step's payload to avoid carrying stale rows.
                    composant: isNotReparable ? [] : this.composantCombo,
                };

                // Snapshot the elapsed diag time BEFORE the chain (pure
                // computation; `saveTimeDiag` sends `this.lapTime`).
                this.lap();

                // Three-way branch:
                //  - non-réparable shortcut → changeFinishStatus. The backend
                //    (changeStatusTofinsh) skips Magasin and, on the ORIGINAL
                //    flow, bills the diagnostic → PENDING2 (tarification); a
                //    RETOUR non-réparable closes to FINISHED instead.
                //  - pdr && reparable → MagasinEstimation
                //  - reparable && !pdr → Pending2 (pricing pseudo).
                const transitionStep = isNotReparable
                    ? {
                          mutation: this.ticketSerice.changeFinishStatus(
                              dataDiag._idDi,
                          ),
                      }
                    : dataDiag.pdr && dataDiag.reparable
                      ? {
                            mutation:
                                this.ticketSerice.changeStatusMagasinEstimation(
                                    dataDiag._idDi,
                                ),
                        }
                      : {
                            mutation: this.ticketSerice.changeStatusDiToPending2(
                                dataDiag._idDi,
                            ),
                        };

                try {
                    // Serialized: saveTimeDiag → finish → transition. A failure
                    // aborts the rest; anti double-submit; single toast; loading
                    // reset on every path.
                    await this.mutationRunner.runChain({
                        key: `techFinishDiag:${dataDiag._idDi}`,
                        steps: [
                            {
                                mutation: this.ticketSerice.saveTimeDiag(
                                    this.selectedDi,
                                    this.lapTime,
                                ),
                            },
                            { mutation: this.ticketSerice.finish(dataDiag) },
                            transitionStep,
                        ],
                        successToast: {
                            summary: 'Diagnostic terminé',
                            detail: 'DI transmise à l’étape suivante.',
                        },
                        errorToast: {
                            summary: 'Erreur',
                            detail: 'Échec de la clôture du diagnostic. Réessayez.',
                        },
                        onLoading: (v) => (this.isLoading = v),
                    });

                    // Side effects ONLY after the whole cascade succeeded —
                    // never before (no premature close / stopwatch restart).
                    this.cdr.detectChanges();
                    this.ticketRefreshService.requestRefresh('tech-list', {
                        source: 'mutation:techFinishDiag',
                    });
                    this.startStopwatch();
                    this.getComposant();
                    this.diDialogDiag[this.selectedDi] = false;
                    this.clearPersistedDialogState('diagnostic');
                } catch {
                    /* toast shown by the runner; modal stays open, stopwatch
                       not restarted, status unchanged past the failed step */
                }
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
                // Authoritative source of "should the timer tick?" is the
                // server-side status, NOT the historical timer flag. When the
                // user reopens a paused DI, we hydrate the accumulated time
                // but keep the stopwatch idle until they hit Resume.
                const isPaused = this.di?.status === 'DIAGNOSTIC_Pause';
                if (
                    data &&
                    data.getLastPauseTime.diag_time &&
                    this.isValidTimeFormat(data.getLastPauseTime.diag_time)
                ) {
                    this.setInitialTime(data.getLastPauseTime.diag_time);
                } else {
                    this.setInitialTime('00:00:00');
                }
                if (!isPaused) {
                    // Anchor the live run leg to the SERVER's Stat.diagRunStartedAt
                    // (the single source of truth), NOT "now". This is what kills
                    // the 837:15:12 drift on restore: elapsed = diag_time +
                    // (now - diagRunStartedAt), independent of localStorage. Fall
                    // back to now only when the server hasn't stamped an anchor
                    // yet (legacy in-flight DI) — the next start/resume fixes it.
                    const serverAnchor = this.di?.diagRunStartedAt
                        ? new Date(this.di.diagRunStartedAt).getTime()
                        : Date.now();
                    this.startStopwatch(serverAnchor);
                } else {
                    // Paused: no live anchor — display the frozen base only.
                    this.diagRunStartedAtMs = null;
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
                // Same guard as getTimeSpent: don't tick on a paused DI.
                const isPaused = this.di?.status === 'REPARATION_Pause';
                if (
                    data &&
                    data.getLastPauseTime.rep_time &&
                    this.isValidTimeFormat(data.getLastPauseTime.rep_time)
                ) {
                    this.setInitialTime1(data.getLastPauseTime.rep_time);
                } else {
                    this.setInitialTime1('00:00:00');
                }
                if (!isPaused) {
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

    /**
     * @param isFinishRep  true when called from the "Fin réparation" flow.
     * @param keepOpen     true to keep the modal mounted in paused state —
     *                     used by the redesigned wizard (`tech-repair-list`)
     *                     so pause mirrors the diagnostic UX (paused but
     *                     still visible). Defaults to false to preserve the
     *                     legacy save-and-close behavior.
     */
    lapTimeForPauseAndGetBack1(
        isFinishRep: boolean,
        keepOpen: boolean = false,
    ) {
        // Mirror `lapTimeForPauseAndGetBack()` (diagnostic) exactly:
        // 1. STOP the timer first (the previous version forgot this, so
        //    the chrono kept ticking through the pause and into the next
        //    session).
        // 2. Snapshot the lap time for the backend persist.
        // 3. Fire mutations.
        // 4. Form reset only when this is a finalization, never on plain
        //    pause — otherwise the user loses their typed remarks.
        // 5. Do NOT call startStopwatch1() at the end. Pause = stopped.
        //    Resume is the explicit user action that ticks the timer back
        //    on (via `onRepairModalPause()`'s Resume branch +
        //    `getTimeSpentRep()` on reopen).
        this.stopRepairTimer();
        this.lap1();

        if (isFinishRep) {
            this.resetModalFormRep();
        }

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
                    // FINISH path keeps its original behavior: the status is
                    // persisted here, after the lap mutation resolves.
                    if (isFinishRep) {
                        this.setDiInReparationPause(this.selectedRep);
                    }
                    if (!keepOpen) {
                        this.diDialogRep = false;
                    }
                }
            });

        // PAUSE path: persist REPARATION_Pause DIRECTLY, in parallel with the
        // lap mutation — mirroring the diagnostic flow, where
        // `lapTimeForPauseAndGetBack()` fires `diDiagnostiqueInPAUSE(...)`
        // directly (not chained behind another mutation's response). Firing it
        // here flips the status in a single roundtrip, so the 350ms-debounced
        // tech-list refresh reads the fresh REPARATION_Pause instead of stale
        // INREPARATION (which previously reverted the optimistic chip back to
        // "En cours"). The finish path above keeps its chained behavior.
        if (!isFinishRep) {
            this.setDiInReparationPause(this.selectedRep);
        }

        if (!isFinishRep) {
            this.addPauseLogs(this.statId, 'rep');
        }

        this.loadData();
    }

    setDiInReparationPause(_id: string) {
        this.apollo
            .mutate<any>({
                mutation: this.ticketSerice.diReperationInPAUSE(_id),
            })
            .subscribe(({ data, loading }) => {
                this.isLoading = loading;
                if (data) {
                    // Belt-and-suspenders reconcile. The backend already
                    // broadcasts this status change over WS WITH the Stat's
                    // tech ids (di.service.broadcastDiStatusChange →
                    // target.id_tech_rep), which tech-list's relevance filter
                    // (handleTechRealtimeMessage / getTechAssignmentInfo)
                    // accepts. We still request one refresh here so the current
                    // view reconciles against server truth the instant the
                    // pause persists, independent of WS delivery/timing.
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
                // The Composants step is hidden when isPdr=false (see diagSteps
                // getter). If the tech is currently parked on it when they
                // toggle to false, snap them to Résumé so they're not stranded
                // on a step that no longer exists in the wizard.
                if (value === false && this.activeDiagStep === 'components') {
                    this.activeDiagStep = 'summary';
                }
            });
    }

    checkValueChangesReperable() {
        this.diagFormTech
            .get('isReparable')
            ?.valueChanges.pipe(takeUntil(this.destroy$))
            .subscribe((value) => {
                this.isReperable = value;
                // Non réparable → aucun PDR à demander : forcer le toggle PDR à
                // false et le désactiver (grisé). Réactivé dès que « réparable »
                // repasse à vrai.
                const pdr = this.diagFormTech.get('isPdr');
                if (!value) {
                    pdr?.setValue(false, { emitEvent: false });
                    pdr?.disable({ emitEvent: false });
                } else {
                    pdr?.enable({ emitEvent: false });
                }
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
                    this.refreshDiagnosticVm();
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

    // ═══════════════════════════════════════════════════════════════════
    // DIAGNOSTIC MODAL (redesigned wizard) — view-model adapters
    //
    // These getters/handlers translate the legacy loosely-typed state
    // (this.di, this.diagFormTech, this.composantCombo, timer fields,
    // etc.) into the strict shapes that <app-diagnostic-modal> expects.
    //
    // No legacy methods are modified — handlers just delegate to existing
    // mutations (techFinishDiag, saveLogsDi, lapTimeForPauseAndGetBack,
    // comboComposantandQuantity, openNew, persistActiveDialogState).
    // ═══════════════════════════════════════════════════════════════════

    /** Whether the redesigned diagnostic modal is open for the active DI. */
    get diagModalVisible(): boolean {
        return !!(this.selectedDi && this.diDialogDiag[this.selectedDi]);
    }

    /** Tone driver for the header status badge. */
    get diagHeaderStatusTone(): 'running' | 'paused' | 'info' | 'neutral' {
        const status: string = this.di?.status ?? '';
        if (status.endsWith('_Pause')) return 'paused';
        if (status === 'INDIAGNOSTIC' || status === 'DIAGNOSTIC') {
            return this.isRunning ? 'running' : 'info';
        }
        return 'neutral';
    }

    private isDiagnosticOfficiallyPaused(): boolean {
        return (
            this.di?.status === 'DIAGNOSTIC_Pause' ||
            this.diStatus === 'DIAGNOSTIC_Pause'
        );
    }

    private canMinimizeDiagnostic(): boolean {
        return this.isDiagnosticOfficiallyPaused() && !this.isRunning;
    }

    /** Built-in label maps so the strip/sidebar never show raw enum codes. */
    private static readonly DIAG_STATUS_LABEL: Record<string, string> = {
        CREATED: 'Créé',
        PENDING1: 'En attente diagnostic',
        DIAGNOSTIC: 'Diagnostic assigné',
        DIAGNOSTIC_Pause: 'En pause',
        INDIAGNOSTIC: 'En cours',
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

    /**
     * Strip nullish-as-string pollution: legacy rows literally store the STRING
     * "undefined" / "null" instead of an actual nullish (typical pre-validation
     * form submit). A naive `||` treats them as truthy and they leak to the UI.
     * Used by every read path that loads DI fields into forms or summaries.
     */
    private cleanStr(v: any): string {
        if (v == null) return '';
        const s = String(v).trim();
        if (!s || s === 'undefined' || s === 'null') return '';
        return s;
    }

    /** Normalize this.di → DiagnosticDiSummary (strict shape, never null). */
    private buildDiSummary(): DiagnosticDiSummary {
        const d: any = this.di ?? {};
        const clean = (v: any): string => this.cleanStr(v);
        const cleanSvc = (s: any) =>
            s && typeof s === 'object'
                ? {
                      name: clean(s.name) || undefined,
                      email: clean(s.email) || undefined,
                      phone: clean(s.phone) || undefined,
                  }
                : undefined;
        const status: string = clean(d.status);
        const clientName = [
            clean(d.client?.first_name),
            clean(d.client?.last_name),
        ]
            .filter(Boolean)
            .join(' ')
            .trim();
        const companyName =
            clean(d.company?.raisonSociale) || clean(d.company?.name) || '';
        const techName = clean(d.techDiag) || clean(d.techRep) || '';
        // entityType drives the sidebar's contact block: company → 3 services,
        // client → single phone, null → nothing rendered. Detection mirrors
        // backend `isResolvableId` (treat string "null"/"undefined" as null).
        const hasCompany =
            d.company &&
            typeof d.company === 'object' &&
            !!companyName;
        const hasClient =
            d.client && typeof d.client === 'object' && !!clientName;
        const entityType: 'company' | 'client' | null = hasCompany
            ? 'company'
            : hasClient
              ? 'client'
              : null;
        return {
            ...this.resolveDiImage(d),
            _id: clean(d._id),
            _idnum: clean(d._idnum),
            title: clean(d.title),
            description: clean(d.description),
            status,
            statusLabel:
                TechDiListComponent.DIAG_STATUS_LABEL[status] ?? status,
            clientName,
            clientPhone: clean(d.client?.phone),
            companyName,
            locationName:
                clean(d.location_name) ||
                clean(d.location_id) ||
                '',
            technicianName: techName,
            remarqueManager: clean(d.remarque_manager),
            ignoreCount: Number(d.ignoreCount ?? 0),
            entityType,
            serviceAchat:
                entityType === 'company'
                    ? cleanSvc(d.company?.serviceAchat)
                    : undefined,
            serviceTechnique:
                entityType === 'company'
                    ? cleanSvc(d.company?.serviceTechnique)
                    : undefined,
            serviceFinancier:
                entityType === 'company'
                    ? cleanSvc(d.company?.serviceFinancier)
                    : undefined,
            remarqueTechDiagnostic: clean(d.remarque_tech_diagnostic),
            remarqueTechReparation: clean(d.remarque_tech_repair),
        };
    }

    /** Pre-composed "Client / Société" line for the info strip. */
    get diagClientLine(): string {
        const s = this.buildDiSummary();
        if (s.companyName && s.clientName) {
            return `${s.companyName} · ${s.clientName}`;
        }
        return s.companyName || s.clientName || '';
    }

    /** Categories — adapt the existing dropdown array shape. */
    private get diagCategoryOptions(): CategoryOption[] {
        const list: any[] = (this as any).categorieDiListDropDown ?? [];
        if (list === this.diagCategorySourceRef) {
            return this.diagCategoryOptionsCache;
        }

        this.diagCategorySourceRef = list;
        this.diagCategoryOptionsCache = list.map((c) => ({
            _id: c.value ?? c._id ?? '',
            category: c.category ?? c.label ?? 'N/A',
        }));
        return this.diagCategoryOptionsCache;
    }

    /** Composants — adapt the existing list. */
    private get diagComposantOptions(): ComposantOption[] {
        const list: any[] = this.composantList ?? [];
        if (list === this.diagComposantSourceRef) {
            return this.diagComposantOptionsCache;
        }

        this.diagComposantSourceRef = list;
        this.diagComposantOptionsCache = list.map((c) => ({
            _id: c._id ?? c.name ?? '',
            name: c.name ?? c.nameComposant ?? '',
        }));
        return this.diagComposantOptionsCache;
    }

    /** "Oui / Non / Non défini" for boolean form values. */
    private booleanLabel(value: unknown): string {
        if (value === true) return 'Oui';
        if (value === false) return 'Non';
        return 'Non défini';
    }

    get diagReparableLabel(): string {
        return this.booleanLabel(this.diagFormTech.get('isReparable')?.value);
    }
    get diagPdrLabel(): string {
        return this.booleanLabel(this.diagFormTech.get('isPdr')?.value);
    }
    get diagCategoryLabel(): string {
        const id = this.diagFormTech.get('di_category_id')?.value;
        const match = this.diagCategoryOptions.find((c) => c._id === id);
        return match?.category ?? '';
    }

    /** Build the typed context object passed into the modal. */
    get diagContext(): DiagnosticContext {
        return {
            di: this.buildDiSummary(),
            ignoreCount: this.ignoreCount ?? 0,
            form: this.diagFormTech,
            timer: {
                display: `${this.minutes ?? '00'}:${this.seconds ?? '00'}:${this.milliseconds ?? '00'}`,
                isRunning: !!this.isRunning,
            },
            hasPdr: !!this.hasPdr,
            isReperable: !!this.isReperable,
            isErrorFromFixtronix:
                !!this.diagFormTech.get('isErrorFromFixtronix')?.value,
            composantCombo: this.composantCombo ?? [],
            composantOptions: this.diagComposantOptions,
            categories: this.diagCategoryOptions,
            disabledFinish: !!this.disabledDiagnostiqueValue,
            disabledRetour: !!this.disabledDiagnostiqueRetourValue,
            retourSendFinished: !!(this as any).techRetourSendFinished,
        };
    }

    /** Step states derived from form completeness + active step. */
    get diagSteps(): readonly DiagnosticStep[] {
        const form = this.diagFormTech;
        const hasInfo = !!this.di?._idnum;
        const hasFailure =
            !!form.get('di_category_id')?.value &&
            !!(form.get('remarqueTech')?.value ?? '').trim();
        const hasComponentsDecision =
            form.get('isPdr')?.value === false ||
            (this.composantCombo ?? []).length > 0;
        const hasValidation =
            form.get('isPdr')?.value !== null &&
            form.get('isReparable')?.value !== null;

        // Per-step hint labels match the target screenshot exactly:
        //   "Complétée" (green ✓) for completed
        //   "En cours" for the active step
        //   "À faire" for pending
        // The hint is overridden to "En cours" when the step is the active
        // one so the user sees stage-by-stage progress regardless of form
        // completion order.
        const hintFor = (
            key: DiagnosticStepKey,
            done: boolean,
        ): string => {
            if (key === this.activeDiagStep) return 'En cours';
            if (done) return 'Complétée';
            return 'À faire';
        };

        // Hide the Composants step entirely when the diagnostic is marked
        // "pas de PDR" (isPdr === false). Composants list parts to order, so
        // it's irrelevant on a no-PDR DI — keeping it in the wizard would
        // force the tech through a meaningless step. Only `false` skips —
        // `null` (not yet decided) keeps the step visible.
        const skipComponents = form.get('isPdr')?.value === false;
        const order: { key: DiagnosticStepKey; label: string; hint: string }[] =
            [
                {
                    key: 'info',
                    label: 'Informations générales',
                    hint: hintFor('info', hasInfo),
                },
                {
                    key: 'failure',
                    label: 'Panne & Symptômes',
                    hint: hintFor('failure', hasFailure),
                },
                {
                    key: 'validation',
                    label: 'Validation',
                    hint: hintFor('validation', hasValidation),
                },
                ...(skipComponents
                    ? []
                    : [
                          {
                              key: 'components' as DiagnosticStepKey,
                              label: 'Composants',
                              hint: hintFor(
                                  'components',
                                  hasComponentsDecision,
                              ),
                          },
                      ]),
                {
                    key: 'summary',
                    label: 'Résumé',
                    hint: hintFor('summary', false),
                },
            ];

        const completedFlags: Record<DiagnosticStepKey, boolean> = {
            info: hasInfo,
            failure: hasFailure,
            components: hasComponentsDecision,
            validation: hasValidation,
            summary: false,
        };

        return order.map(({ key, label, hint }) => {
            let state: 'completed' | 'current' | 'pending';
            if (key === this.activeDiagStep) state = 'current';
            else if (completedFlags[key]) state = 'completed';
            else state = 'pending';
            return {
                key,
                number: order.findIndex((o) => o.key === key) + 1,
                label,
                hint,
                state,
            };
        });
    }

    /** Progress derived from the same completion flags. */
    get diagProgress(): DiagnosticProgress {
        const completedSteps = this.diagSteps.filter(
            (s) => s.state === 'completed',
        ).length;
        const totalSteps = this.diagSteps.length;
        return {
            completedSteps,
            totalSteps,
            percent:
                totalSteps > 0
                    ? Math.round((completedSteps / totalSteps) * 100)
                    : 0,
        };
    }

    /** Autosave hint — driven by form pristine/dirty state. */
    get diagAutosave(): AutosaveHint {
        return {
            state: this.diagFormTech.dirty ? 'saved' : 'idle',
            lastSavedAt: this.diagFormTech.dirty ? new Date() : null,
        };
    }

    /**
     * The modal inputs are intentionally cached instead of bound to getters in
     * the template. The old getter path allocates arrays/objects and maps the
     * full composant/category lists; doing that on every change-detection tick
     * can lock Chrome while the PrimeNG dialog is opening.
     */
    private refreshDiagnosticVm(): void {
        // Mutual-exclusion guard — when a repair flow is active, the
        // diagnostic VM must NOT rebuild. The shared `this.di` /
        // `this.selectedDi` fields get overwritten by `repModal()`, so
        // without this short-circuit the diag context silently rebuilds
        // with stale data and PrimeNG renders an empty shell under the
        // repair wizard.
        if (this.showRepairModal || this.diDialogRep) {
            this.diagModalVisibleVm = false;
            this.diagContextVm = null;
            return;
        }

        if (!this.di?._id && !this.selectedDi) {
            this.diagModalVisibleVm = false;
            this.diagContextVm = null;
            return;
        }

        this.diagModalVisibleVm = this.diagModalVisible;
        this.diagHeaderStatusToneVm = this.diagHeaderStatusTone;
        this.diagClientLineVm = this.diagClientLine;
        this.diagReparableLabelVm = this.diagReparableLabel;
        this.diagPdrLabelVm = this.diagPdrLabel;
        this.diagCategoryLabelVm = this.diagCategoryLabel;
        this.diagCanMinimizeVm = this.canMinimizeDiagnostic();
        this.diagContextVm = this.diagContext;
        this.diagStepsVm = this.diagSteps;

        const completedSteps = this.diagStepsVm.filter(
            (s) => s.state === 'completed',
        ).length;
        const totalSteps = this.diagStepsVm.length;
        this.diagProgressVm = {
            completedSteps,
            totalSteps,
            percent:
                totalSteps > 0
                    ? Math.round((completedSteps / totalSteps) * 100)
                    : 0,
        };
        this.diagAutosaveVm = this.diagAutosave;
    }

    setDiagModalVisible(visible: boolean): void {
        this.diagModalVisibleVm = visible;
        if (this.selectedDi) {
            this.diDialogDiag[this.selectedDi] = visible;
        }
        if (!visible) {
            this.onDiagMinimize();
            return;
        }
        this.refreshDiagnosticVm();
    }

    // ─── Modal output handlers — pure delegation to existing methods ───

    onDiagPause(): void {
        // Status is the authoritative source — `isRunning` can drift out of
        // sync with the server when the user reopens a paused DI (a stray
        // setInterval can leave the flag true on a paused ticket). Branch on
        // status first so the action matches what the user sees in the
        // header pill.
        if (this.isDiagnosticOfficiallyPaused()) {
            // Paused -> Resume.
            // Optimistic UI first (modal + list row), then close the pause
            // log so the backend stops accruing pause duration, then flip
            // the status to INDIAGNOSTIC, then ask the list to reconcile
            // against server truth.
            this.diStatus = 'INDIAGNOSTIC';
            // Anchor the resumed leg to "now" and mirror it onto the snapshot —
            // `changeStatus` stamps Stat.diagRunStartedAt = now server-side, so
            // a restore reads the same value instead of the pre-pause anchor
            // (which would double-count). Matches onRepairModalPause's resume.
            const resumeAnchor = Date.now();
            if (this.di) {
                this.di = {
                    ...this.di,
                    status: 'INDIAGNOSTIC',
                    diagRunStartedAt: new Date(resumeAnchor),
                };
            }
            this.patchTechListRowStatus(this.di?._id, 'INDIAGNOSTIC');
            this.refreshDiagnosticVm();

            const openLog = this.getCurrentPauseLog(this.di?.pauseLogs);
            if (openLog && this.di?._id) {
                this.updatePauseLog(this.di._id, openLog._id);
            }
            this.changeStatus(this.selectedDi_id);
            this.startStopwatch(resumeAnchor);
            this.persistActiveDialogState('diagnostic');
            this.requestTechListRefresh('action:diag-resume');
            return;
        }

        // Active -> Pause. The heavy `lapTimeForPauseAndGetBack()` already
        // fires the backend mutations; we layer optimistic UI + a refresh
        // request on top so the list row + chip flip immediately. Drop the run
        // anchor on the snapshot too (the server clears Stat.diagRunStartedAt in
        // changeToDiagnosticInPause) so a paused restore stays frozen.
        if (this.di) {
            this.di = {
                ...this.di,
                status: 'DIAGNOSTIC_Pause',
                diagRunStartedAt: null,
            };
        }
        this.patchTechListRowStatus(this.di?._id, 'DIAGNOSTIC_Pause');
        this.lapTimeForPauseAndGetBack();
        this.requestTechListRefresh('action:diag-pause');
    }

    onDiagMinimize(): void {
        if (!this.canMinimizeDiagnostic()) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Diagnostic actif',
                detail: 'Mettez le diagnostic en pause avant de réduire la fenêtre.',
                life: 2500,
            });
            return;
        }

        this.persistActiveDialogState('diagnostic');
        if (this.selectedDi) {
            this.diDialogDiag[this.selectedDi] = false;
        }
        this.diagModalVisibleVm = false;
        this.diagContextVm = null;
    }

    onDiagStepChange(step: DiagnosticStepKey): void {
        this.activeDiagStep = step;
        this.refreshDiagnosticVm();
    }

    onDiagSaveDraft(): void {
        try {
            this.persistActiveDialogState?.('diagnostic');
        } catch {
            // best-effort — don't break the UX if persistence is unavailable
        }
        this.messageService?.add?.({
            severity: 'success',
            summary: 'Brouillon enregistré',
            detail: 'Vos modifications sont sauvegardées localement.',
            life: 2500,
        });
    }

    onDiagAddComposant(): void {
        try {
            this.comboComposantandQuantity();
        } catch {
            this.messageService.add({
                severity: 'error',
                summary: 'Ajout impossible',
                detail: 'Le composant n’a pas pu être ajouté. Vérifiez la sélection et la quantité.',
                life: 3000,
            });
        }
    }

    onDiagRemoveComposant(name: string): void {
        this.composantCombo = (this.composantCombo ?? []).filter(
            (c) => c.nameComposant !== name,
        );
        this.updateDisableValues?.();
        this.refreshDiagnosticVm();
    }

    onDiagCreateComposant(): void {
        (this as any).openNew?.();
    }

    onDiagFinish(): void {
        this.techFinishDiag?.();
    }

    onDiagFinishRetour(): void {
        (this as any).saveLogsDi?.();
    }

    onDiagSendToFinishRetour(): void {
        (this as any).retourEnvoyerVersFinir?.();
    }

    /** Non-réparable shortcut: same cascade as `techFinishDiag` but the
     *  transition step is `changeFinishStatus` instead of the
     *  MagasinEstimation / Pending2 branch. M1 guard now allows
     *  DIAGNOSTIC(_Pause) → FINISHED. */
    onDiagFinishNotReparable(): void {
        this.techFinishDiag?.({ notReparable: true });
    }
}
