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

    activeRepairStep: RepairStepKey = 'info';

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
    // Timer (mirrors tech-di-list's 1Hz tick approach)
    // ───────────────────────────────────────────────────────────────
    timer: TimerDisplayState = { display: '00:00:00', isRunning: true };
    private timerSeconds: number = 0;
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

    categories: readonly CategoryOption[] = [];
    partOptions: readonly RepairPartOption[] = [];
    parts: readonly RepairPartEntry[] = [];

    constructor(
        private readonly fb: FormBuilder,
        private readonly cdr: ChangeDetectorRef,
    ) {}

    ngOnInit(): void {
        if (this.visible) this.startTimer();
        // TODO: load real DI / categories / parts catalog via TicketService
        // when the repair Apollo endpoints are ready.
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['diInput'] && this.diInput) {
            this.di = this.diInput;
        }
        if (changes['initiallyPaused']) {
            // Reflect the host's "open in paused state" hint into the local
            // timer so the header shows the right pill (paused/orange) and
            // the seconds don't start ticking on REPARATION_Pause tickets.
            this.timer = {
                display: this.timer.display,
                isRunning: !this.initiallyPaused,
            };
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
        console.log(
            '[REPAIR][CLICK] tech-repair-list.onRepairPause timer.isRunning=',
            this.timer.isRunning,
            'di.status=',
            this.di?.status,
        );
        if (this.timer.isRunning) this.pauseTimer();
        else this.resumeTimer();
        this.pauseClicked.emit();
        console.log(
            '[REPAIR][CLICK] tech-repair-list emitted pauseClicked',
        );
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
        // TODO: call the "Fin réparation" Apollo mutation when the schema lands.
        // For now we just close the modal so the visual flow is testable.
        this.stopTimer();
        this.setRepairModalVisible(false);
    }

    // ───────────────────────────────────────────────────────────────
    // View-model getters — feed the dumb tree
    // ───────────────────────────────────────────────────────────────
    private static readonly STEP_ORDER: readonly RepairStepKey[] = [
        'info',
        'plan',
        'parts',
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
        // Mirrors the diagnostic "disabledFinish" logic: required form
        // controls + the two yes/no toggles must be set.
        const requiredFilled =
            !!this.repairForm.get('di_category_id')?.value &&
            !!(this.repairForm.get('repairPlan')?.value as string)?.trim() &&
            !!(this.repairForm.get('worksDone')?.value as string)?.trim();
        const success = this.repairForm.get('repairSuccess')?.value;
        const tests = this.repairForm.get('testsValidated')?.value;
        return !(
            requiredFilled &&
            (success === true || success === false) &&
            (tests === true || tests === false)
        );
    }

    // ───────────────────────────────────────────────────────────────
    // Timer plumbing — keep things explicit; mirrors tech-di-list's 1Hz
    // approach (setInterval + ChangeDetectorRef) but localized here.
    // ───────────────────────────────────────────────────────────────
    private startTimer(): void {
        this.stopTimer();
        this.timerHandle = setInterval(() => {
            if (!this.timer.isRunning) return;
            this.timerSeconds += 1;
            this.timer = {
                display: this.formatHMS(this.timerSeconds),
                isRunning: true,
            };
            this.cdr.markForCheck();
        }, 1000);
    }

    private pauseTimer(): void {
        this.timer = { display: this.timer.display, isRunning: false };
    }

    private resumeTimer(): void {
        this.timer = { display: this.timer.display, isRunning: true };
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
