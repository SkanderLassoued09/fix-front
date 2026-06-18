import {
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    SimpleChanges,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import {
    CategoryOption,
    DiagnosticDiSummary,
    DiagnosticStep,
    TimerDisplayState,
} from '../tech-di-list/diagnostic-modal/diagnostic-modal.types';

import {
    RepairBadgeValue,
    RepairContext,
    RepairPartEntry,
    RepairPartOption,
    RepairProgress,
    RepairStepKey,
} from './repair-modal/repair-modal.types';

/**
 * Smart parent for the repair flow. Mirrors the wiring pattern of
 * `tech-di-list` for the diagnostic modal: it owns the FormGroup, the
 * timer, the active step, and exposes view-model getters that the dumb
 * `<app-repair-modal>` tree consumes.
 *
 * Apollo mutations + backend bindings are STUBBED with TODO markers —
 * the UI is fully functional locally (form binds, timer ticks, navigation
 * works, parts add/remove) so the screen can be validated visually before
 * the GraphQL hookups land.
 */
@Component({
    selector: 'app-tech-repair-list',
    templateUrl: './tech-repair-list.component.html',
    styleUrls: ['./tech-repair-list.component.scss'],
})
export class TechRepairListComponent implements OnInit, OnDestroy, OnChanges {
    // ───────────────────────────────────────────────────────────────
    // Visibility — driven from the host (tech-di-list) so the modal
    // behaves exactly like the diagnostic modal: closed by default,
    // opened on demand via the wrench button.
    // ───────────────────────────────────────────────────────────────
    @Input() visible: boolean = false;
    @Output() visibleChange = new EventEmitter<boolean>();

    /**
     * Optional DI input — when the parent passes a row, the modal opens
     * with that ticket's data. Falls back to a placeholder otherwise so
     * the modal can still render for visual review.
     */
    @Input() diInput: DiagnosticDiSummary | null = null;

    /**
     * When true, the modal opens with the timer already paused — used by
     * the host when reopening a DI that is already in `REPARATION_Pause`.
     */
    @Input() initiallyPaused: boolean = false;

    /**
     * Emitted whenever the user clicks the pause/resume button in the
     * header. The host (tech-di-list) decides which Apollo mutation to
     * fire (lapTimeForPauseAndGetBack1 for pause, changeStatusInReparation
     * for resume) based on its own timer + status state.
     */
    @Output() pauseClicked = new EventEmitter<void>();

    /**
     * Emitted when the user confirms « Fin réparation ». The host
     * (tech-di-list) runs the real finish mutations (persist parts + remark,
     * tech_finishReperation, changestatusToFinishReparation → FINISHED). The
     * payload carries the typed remark and the used parts so nothing is lost.
     */
    @Output() finishClicked = new EventEmitter<{
        remarque: string;
        parts: RepairPartEntry[];
    }>();

    /** True while the host's finish mutation chain is in flight — disables the
     *  « Fin réparation » button so it can't be double-submitted. */
    @Input() finishing = false;

    /**
     * Initial values to pre-fill the form + parts when the wizard opens on an
     * existing DI (category, repair remark, already-selected parts). Patched
     * once per open in ngOnChanges so the tech doesn't re-enter everything.
     */
    @Input() prefill: {
        di_category_id?: string | null;
        repairPlan?: string;
        worksDone?: string;
        remarqueExtra?: string;
        parts?: RepairPartEntry[];
    } | null = null;

    activeRepairStep: RepairStepKey = 'works';

    // ───────────────────────────────────────────────────────────────
    // Form (single FormGroup; one control per UI field across all steps)
    // ───────────────────────────────────────────────────────────────
    repairForm: FormGroup = this.fb.group({
        di_category_id: [null, Validators.required],
        repairPlan: ['', [Validators.required, Validators.maxLength(1000)]],
        remarqueExtra: ['', Validators.maxLength(1000)],
        partSelected: [null],
        quantity: [1, [Validators.min(1)]],
        worksDone: ['', [Validators.required, Validators.maxLength(1000)]],
        testsDone: ['', Validators.maxLength(1000)],
        repairSuccess: [null],
        testsValidated: [null],
        warranty: [null],
    });

    // ───────────────────────────────────────────────────────────────
    // Timer — SERVER-ANCHORED (no in-memory 0-based counter, no localStorage),
    // so it survives refresh / tabs / devices. The host derives both values
    // from persisted data (Stat.rep_time + Stat.repRunStartedAt + DI.status):
    //   elapsedBaseMs  : accumulated repair time, frozen at the last pause.
    //   runStartedAtMs : epoch ms when the current run leg started; null while
    //                    paused. Displayed elapsed =
    //                    elapsedBaseMs + (running ? now - runStartedAtMs : 0).
    // ───────────────────────────────────────────────────────────────
    @Input() elapsedBaseMs: number = 0;
    @Input() runStartedAtMs: number | null = null;

    timer: TimerDisplayState = { display: '00:00:00', isRunning: false };
    private timerHandle: ReturnType<typeof setInterval> | null = null;

    // ───────────────────────────────────────────────────────────────
    // Catalog & state (STUBBED — to be backed by real Apollo queries)
    // ───────────────────────────────────────────────────────────────
    di: DiagnosticDiSummary = {
        _id: 'placeholder',
        _idnum: 'RE23',
        title: '',
        description: '',
        status: 'EN PAUSE',
        statusLabel: 'EN PAUSE',
        clientName: '',
        clientPhone: '',
        companyName: '',
        locationName: '',
        technicianName: '',
        remarqueManager: '',
    };

    @Input() categories: readonly CategoryOption[] = [];
    @Input() partOptions: readonly RepairPartOption[] = [];
    parts: readonly RepairPartEntry[] = [];

    constructor(
        private readonly fb: FormBuilder,
        private readonly cdr: ChangeDetectorRef,
    ) {}

    ngOnInit(): void {
        this.renderTimer();
        if (this.visible) this.startTimer();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['diInput'] && this.diInput) {
            this.di = this.diInput;
        }
        // B3 — pre-fill from the DI when the host hands us a prefill (once per
        // open; a new object reference is passed only on open, so timer ticks
        // never clobber the tech's edits).
        if (changes['prefill'] && this.prefill) {
            this.repairForm.patchValue({
                di_category_id:
                    this.prefill.di_category_id ??
                    this.repairForm.get('di_category_id')?.value ??
                    null,
                repairPlan: this.prefill.repairPlan ?? '',
                worksDone: this.prefill.worksDone ?? '',
                remarqueExtra: this.prefill.remarqueExtra ?? '',
            });
            this.parts = [...(this.prefill.parts ?? [])];
        }
        if (changes['elapsedBaseMs'] || changes['runStartedAtMs']) {
            // Re-derive the display from the server-provided anchor. open,
            // refresh-restore, pause and resume all flow through here.
            this.renderTimer();
        }
        if (changes['visible']) {
            if (this.visible) {
                this.startTimer();
            } else {
                this.stopTimer();
            }
        }
    }

    ngOnDestroy(): void {
        this.stopTimer();
    }

    // ───────────────────────────────────────────────────────────────
    // Modal visibility — propagate to the host via two-way binding.
    // ───────────────────────────────────────────────────────────────
    setRepairModalVisible(v: boolean): void {
        if (this.visible === v) return;
        this.visible = v;
        this.visibleChange.emit(v);
    }

    // ───────────────────────────────────────────────────────────────
    // Intent handlers (dumb tree → smart parent)
    // ───────────────────────────────────────────────────────────────
    onRepairPause(): void {
        // Intent only. The host (tech-di-list.onRepairModalPause) decides
        // pause vs resume from the DI status and flips `runStartedAtMs`, which
        // flows back through ngOnChanges → renderTimer to freeze / resume the
        // displayed elapsed.
        this.pauseClicked.emit();
    }

    onRepairMinimize(): void {
        this.setRepairModalVisible(false);
        // TODO: persist active draft so reopening picks up where we left off.
    }

    onRepairStepChange(next: RepairStepKey): void {
        this.activeRepairStep = next;
    }

    onRepairAddPart(): void {
        const opt = this.repairForm.get('partSelected')?.value as
            | RepairPartOption
            | null;
        const qty = (this.repairForm.get('quantity')?.value as number) || 1;
        if (!opt) return;
        const next: RepairPartEntry = {
            nameComposant: opt.name,
            reference: opt.reference,
            quantity: qty,
        };
        // Dedup by name+reference; replace qty if already there.
        const without = this.parts.filter(
            (p) =>
                !(
                    p.nameComposant === next.nameComposant &&
                    p.reference === next.reference
                ),
        );
        this.parts = [...without, next];
        this.repairForm.get('partSelected')?.reset();
        this.repairForm.get('quantity')?.setValue(1);
        // TODO: persist part addition through TicketService when ready.
    }

    onRepairRemovePart(nameComposant: string): void {
        this.parts = this.parts.filter(
            (p) => p.nameComposant !== nameComposant,
        );
        // TODO: persist removal through TicketService.
    }

    onRepairFinish(): void {
        // Anti double-submit + respect the form gate. The host owns the
        // mutations (it has Apollo + the DI/stat ids); we emit the payload and
        // let it run finish → FINISHED. The host closes the modal on success;
        // we do NOT close here (so a failure keeps the modal open + editable).
        if (this.finishing || this.computeFinishDisabled()) return;
        this.stopTimer();
        this.finishClicked.emit({
            remarque: this.buildRepairRemark(),
            parts: [...this.parts],
        });
    }

    /** Fold the wizard's free-text fields into the single repair remark the
     *  backend stores (`tech_finishReperation` takes one `remarque`). */
    private buildRepairRemark(): string {
        const v = this.repairForm.value;
        return [
            v.worksDone && `Travaux: ${v.worksDone}`,
            v.testsDone && `Tests: ${v.testsDone}`,
            v.remarqueExtra && `Remarque: ${v.remarqueExtra}`,
        ]
            .filter(Boolean)
            .join(' · ')
            .trim();
    }

    // ───────────────────────────────────────────────────────────────
    // View-model getters — feed the dumb tree
    // ───────────────────────────────────────────────────────────────
    // Repair wizard reduced to the two steps that actually capture the tech's
    // input: « Travaux & tests » then « Résumé ». The former « Informations
    // générales », « Plan d'intervention » and « Pièces utilisées » steps were
    // removed — their data is prefilled from the DI (category / plan / parts
    // sourced upstream in the magasin B3 flow) and is display-only here, so it
    // no longer needs its own wizard step. Numbering/progress derive from this
    // array, so the stepper now shows 1/2 → 2/2 automatically.
    private static readonly STEP_ORDER: readonly RepairStepKey[] = [
        'works',
        'summary',
    ];

    private static readonly STEP_LABELS: Readonly<
        Record<RepairStepKey, string>
    > = {
        info: 'Informations générales',
        plan: "Plan d'intervention",
        parts: 'Pièces utilisées',
        works: 'Travaux & tests',
        summary: 'Résumé',
    };

    get repairSteps(): readonly DiagnosticStep[] {
        const active = this.activeRepairStep;
        const activeIdx = TechRepairListComponent.STEP_ORDER.indexOf(active);
        return TechRepairListComponent.STEP_ORDER.map((key, idx) => {
            const state =
                idx < activeIdx
                    ? 'completed'
                    : idx === activeIdx
                      ? 'current'
                      : 'pending';
            const hint =
                state === 'completed'
                    ? 'Complétée'
                    : state === 'current'
                      ? 'En cours'
                      : 'À faire';
            return {
                // The shared stepper is typed against DiagnosticStepKey but
                // it only uses these as opaque identifiers — repair keys
                // pass through fine at runtime; we cast at the boundary.
                key: key as unknown as DiagnosticStep['key'],
                number: idx + 1,
                label: TechRepairListComponent.STEP_LABELS[key],
                hint,
                state,
            } satisfies DiagnosticStep;
        });
    }

    get repairProgress(): RepairProgress {
        const total = TechRepairListComponent.STEP_ORDER.length;
        const activeIdx = TechRepairListComponent.STEP_ORDER.indexOf(
            this.activeRepairStep,
        );
        const completed = Math.max(0, activeIdx);
        return {
            completedSteps: completed,
            totalSteps: total,
            percent: Math.round((completed / total) * 100),
        };
    }

    get repairContext(): RepairContext {
        return {
            di: this.di,
            form: this.repairForm,
            timer: this.timer,
            partOptions: this.partOptions,
            parts: this.parts,
            categories: this.categories,
            disabledFinish: this.computeFinishDisabled(),
        };
    }

    get clientLine(): string {
        const c = this.di.clientName?.trim();
        const co = this.di.companyName?.trim();
        if (c && co) return `${c} · ${co}`;
        return c || co || '';
    }

    get categoryLabel(): string {
        const id = this.repairForm.get('di_category_id')?.value;
        const found = this.categories.find((c) => c._id === id);
        return found?.category ?? '';
    }

    get repairPlanValue(): string {
        return (this.repairForm.get('repairPlan')?.value as string) || '';
    }

    get repairSuccessLabel(): RepairBadgeValue {
        return this.tristate(this.repairForm.get('repairSuccess')?.value);
    }

    get testsValidatedLabel(): RepairBadgeValue {
        return this.tristate(this.repairForm.get('testsValidated')?.value);
    }

    get warrantyLabel(): string {
        return this.tristate(this.repairForm.get('warranty')?.value);
    }

    get elapsedLabel(): string {
        // Mirrors timer.display so the sidebar shows the running time.
        return this.timer.display === '00:00:00' ? '—' : this.timer.display;
    }

    get headerStatusTone(): 'running' | 'paused' | 'info' | 'neutral' {
        // Mirrors `tech-di-list.diagHeaderStatusTone` exactly so the repair
        // header pill flips colors on the same rules as the diagnostic one.
        //
        //   *_Pause            -> 'paused' (red pill)
        //   INREPARATION       -> 'running' if the timer is ticking,
        //                         else 'info'
        //   REPARATION         -> same as INREPARATION (not assigned yet
        //                         but still actively shown to the tech)
        //   anything else      -> 'neutral'
        const status = this.di?.status ?? '';
        if (status.endsWith('_Pause')) return 'paused';
        if (status === 'INREPARATION' || status === 'REPARATION') {
            return this.timer.isRunning ? 'running' : 'info';
        }
        return 'neutral';
    }

    get canMinimize(): boolean {
        return !this.timer.isRunning;
    }

    // ───────────────────────────────────────────────────────────────
    // Helpers
    // ───────────────────────────────────────────────────────────────
    private tristate(v: unknown): RepairBadgeValue {
        if (v === true) return 'Oui';
        if (v === false) return 'Non';
        return 'Non défini';
    }

    private computeFinishDisabled(): boolean {
        // The wizard is reduced to « Travaux & tests » + « Résumé », so the gate
        // only requires what those steps collect: the works description and the
        // two yes/no validations. di_category_id / repairPlan are prefilled,
        // display-only, and NOT part of the finish payload, so they must not
        // block closure (otherwise an empty prefill would freeze « Fin réparation »).
        const requiredFilled = !!(
            this.repairForm.get('worksDone')?.value as string
        )?.trim();
        const success = this.repairForm.get('repairSuccess')?.value;
        const tests = this.repairForm.get('testsValidated')?.value;
        // Also disabled while a finish is in flight (anti double-submit).
        return (
            this.finishing ||
            !(
                requiredFilled &&
                (success === true || success === false) &&
                (tests === true || tests === false)
            )
        );
    }

    // ───────────────────────────────────────────────────────────────
    // Timer plumbing — keep things explicit; mirrors tech-di-list's 1Hz
    // approach (setInterval + ChangeDetectorRef) but localized here.
    // ───────────────────────────────────────────────────────────────
    /**
     * Recompute the displayed elapsed from the server-anchored model. Now-based
     * and idempotent: the interval just re-renders each second, advancing only
     * while running (runStartedAtMs != null) and showing the frozen base while
     * paused.
     */
    private renderTimer(): void {
        const running = this.runStartedAtMs != null;
        const ms =
            (this.elapsedBaseMs || 0) +
            (running
                ? Math.max(0, Date.now() - (this.runStartedAtMs as number))
                : 0);
        this.timer = {
            display: this.formatHMS(Math.floor(ms / 1000)),
            isRunning: running,
        };
        this.cdr.markForCheck();
    }

    private startTimer(): void {
        this.stopTimer();
        this.renderTimer();
        this.timerHandle = setInterval(() => this.renderTimer(), 1000);
    }

    private stopTimer(): void {
        if (this.timerHandle !== null) {
            clearInterval(this.timerHandle);
            this.timerHandle = null;
        }
    }

    private formatHMS(total: number): string {
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
}
