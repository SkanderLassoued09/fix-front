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
import { Subscription, debounceTime } from 'rxjs';

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
     * « Réduire » a été cliqué. INTENTION seulement : c'est l'hôte qui ferme,
     * après confirmation s'il reste du travail non sauvegardé (`hasUnsavedWork`).
     */
    @Output() minimizeClicked = new EventEmitter<void>();

    /**
     * Emitted when the user confirms « Fin réparation ». The host
     * (tech-di-list) runs the real finish mutations (persist parts + remark,
     * tech_finishReperation, changestatusToFinishReparation → FINISHED). The
     * payload carries the typed remark and the used parts so nothing is lost.
     */
    @Output() finishClicked = new EventEmitter<{
        remarque: string;
        parts: RepairPartEntry[];
        repairSuccess: boolean | null;
        testsValidated: boolean | null;
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
        worksDone?: string;
        testsDone?: string;
        remarqueExtra?: string;
        parts?: RepairPartEntry[];
        /** Brouillon navigateur restauré par l'hôte. */
        repairSuccess?: boolean | null;
        testsValidated?: boolean | null;
        warranty?: boolean | null;
        step?: RepairStepKey;
        restoredDraft?: boolean;
    } | null = null;

    /** Horodatage du brouillon restauré (bandeau « Brouillon restauré »), sinon null. */
    @Input() draftRestoredAt: number | null = null;

    /**
     * Saisie modifiée (débouncée) — l'hôte l'écrit dans le brouillon navigateur
     * (`tech-form-draft.store`). JAMAIS émis par le préremplissage.
     */
    @Output() draftChange = new EventEmitter<{
        value: Record<string, unknown>;
        parts: RepairPartEntry[];
        step: RepairStepKey;
    }>();

    /** « Ignorer le brouillon » cliqué dans le bandeau. */
    @Output() discardDraft = new EventEmitter<void>();

    private draftSub: Subscription | null = null;

    activeRepairStep: RepairStepKey = 'works';

    // ───────────────────────────────────────────────────────────────
    // Form (single FormGroup; one control per UI field across all steps)
    // ───────────────────────────────────────────────────────────────
    repairForm: FormGroup = this.fb.group({
        di_category_id: [null, Validators.required],
        remarqueExtra: ['', Validators.maxLength(1000)],
        partSelected: [null],
        quantity: [1, [Validators.min(1)]],
        worksDone: ['', [Validators.required, Validators.maxLength(1000)]],
        testsDone: ['', [Validators.required, Validators.maxLength(1000)]],
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

    /** Cf. `renderTimer` — plafond de plausibilité d'un segment continu (12 h). */
    private static readonly MAX_PLAUSIBLE_LEG_MS = 12 * 60 * 60 * 1000;

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
        // Frappe du technicien → brouillon navigateur (le préremplissage patche
        // sans émettre, il ne déclenche donc rien).
        this.draftSub = this.repairForm.valueChanges
            .pipe(debounceTime(300))
            .subscribe(() => this.flushDraft());
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['diInput'] && this.diInput) {
            this.di = this.diInput;
        }
        // B3 — pre-fill from the DI when the host hands us a prefill (once per
        // open; a new object reference is passed only on open, so timer ticks
        // never clobber the tech's edits).
        if (changes['prefill'] && this.prefill) {
            // RESET complet, pas un patch : le wizard reste monté d'une DI à
            // l'autre, et un patch laissait les bascules Oui/Non (et la catégorie)
            // de la DI précédente. Sans émission : le préremplissage n'est pas une
            // saisie et ne doit pas créer de brouillon.
            this.repairForm.reset(
                {
                    di_category_id: this.prefill.di_category_id ?? null,
                    remarqueExtra: this.prefill.remarqueExtra ?? '',
                    partSelected: null,
                    quantity: 1,
                    worksDone: this.prefill.worksDone ?? '',
                    // `testsDone` est OBLIGATOIRE : l'oublier rebloquerait « Fin
                    // réparation » sur un champ que le technicien avait rempli.
                    testsDone: this.prefill.testsDone ?? '',
                    repairSuccess: this.prefill.repairSuccess ?? null,
                    testsValidated: this.prefill.testsValidated ?? null,
                    warranty: this.prefill.warranty ?? null,
                },
                { emitEvent: false },
            );
            if (this.prefill.restoredDraft) {
                // Brouillon restauré = travail non envoyé : réduire doit demander.
                this.repairForm.markAsDirty();
            }
            this.parts = [...(this.prefill.parts ?? [])];
            this.activeRepairStep = this.prefill.step ?? 'works';
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
        this.draftSub?.unsubscribe();
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
        // INTENTION seulement — c'est l'hôte qui ferme, après confirmation si du
        // travail est en cours. Ce composant fermait directement, sans rien
        // demander et sans sauvegarder : les travaux saisis et les pièces
        // ajoutées étaient perdus. Il n'injecte ni ConfirmationService ni
        // MessageService : la décision appartient au parent (« dumb tree →
        // smart parent », comme pause/reprise).
        this.minimizeClicked.emit();
    }

    /**
     * Le technicien a-t-il saisi quelque chose qui serait perdu à la fermeture ?
     *
     * `dirty` est fiable ici : le préremplissage passe par `patchValue`
     * (ngOnChanges), qui ne salit PAS le formulaire — `dirty` signifie donc bien
     * « l'utilisateur a tapé ». On y ajoute une pièce ajoutée à la main, qui ne
     * transite pas par le formulaire.
     */
    get hasUnsavedWork(): boolean {
        const prefilled = this.prefill?.parts?.length ?? 0;
        return this.repairForm.dirty || this.parts.length !== prefilled;
    }

    onRepairStepChange(next: RepairStepKey): void {
        this.activeRepairStep = next;
        this.flushDraft();
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
        this.flushDraft();
        // TODO: persist part addition through TicketService when ready.
    }

    onRepairRemovePart(nameComposant: string): void {
        this.parts = this.parts.filter(
            (p) => p.nameComposant !== nameComposant,
        );
        this.flushDraft();
        // TODO: persist removal through TicketService.
    }

    /**
     * Émet la saisie courante pour le brouillon navigateur. Appelé aussi par
     * l'hôte, sans attendre le debounce, avant un rafraîchissement ou une
     * fermeture d'onglet.
     */
    flushDraft(): void {
        this.draftChange.emit({
            value: this.repairForm.getRawValue(),
            parts: [...this.parts],
            step: this.activeRepairStep,
        });
    }

    onRepairFinish(): void {
        // Anti double-submit + respect the form gate. The host owns the
        // mutations (it has Apollo + the DI/stat ids); we emit the payload and
        // let it run finish → FINISHED. The host closes the modal on success;
        // we do NOT close here (so a failure keeps the modal open + editable).
        if (this.finishing || this.computeFinishDisabled()) return;
        this.stopTimer();
        const raw = this.repairForm.getRawValue();
        this.finishClicked.emit({
            remarque: this.buildRepairRemark(),
            parts: [...this.parts],
            repairSuccess:
                typeof raw.repairSuccess === 'boolean' ? raw.repairSuccess : null,
            testsValidated:
                typeof raw.testsValidated === 'boolean' ? raw.testsValidated : null,
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

    /**
     * Libellé de la catégorie de la DI.
     *
     * Tolère l'ID **ou** le LIBELLÉ dans `di_category_id` : les projections
     * divergent (la vue coordination y met le libellé, `getDiById` l'id) et les
     * DI héritées stockent directement le libellé. Même tolérance que
     * `optionValue()` du modal détail — un `===` strict sur l'id affichait
     * « Non définie » sur toutes ces DI.
     *
     * Dernier recours : la valeur brute. Montrer un libellé hérité vaut mieux
     * que « Non définie » quand la donnée est là mais hors référentiel.
     */
    get categoryLabel(): string {
        const raw = String(
            this.repairForm.get('di_category_id')?.value ?? '',
        ).trim();
        if (!raw) return '';
        const byId = this.categories.find((c) => String(c._id) === raw);
        if (byId) return byId.category;
        const byLabel = this.categories.find(
            (c) => String(c.category) === raw,
        );
        return byLabel ? byLabel.category : raw;
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

    /** Valeur d'un contrôle texte, espaces retirés. `Validators.required` seul
     *  laisse passer une chaîne d'espaces — la garde doit donc trimer. */
    private trimmedValue(control: string): string {
        return ((this.repairForm.get(control)?.value as string) ?? '').trim();
    }

    /**
     * PREMIÈRE raison qui empêche de clôturer, ou `null` si tout est réuni.
     *
     * SOURCE UNIQUE de la règle de clôture : `computeFinishDisabled()` en
     * dérive et le résumé l'affiche sous le bouton désactivé. Auparavant le
     * bouton se grisait sans rien dire — le technicien devait deviner quel
     * champ manquait.
     *
     * Le wizard est réduit à « Travaux & tests » + « Résumé » : la garde ne
     * porte donc QUE sur ce que ces étapes collectent. `di_category_id` est
     * pré-rempli et purement informatif, il ne doit pas bloquer la clôture
     * (un pré-remplissage vide gèlerait « Fin réparation »).
     */
    get finishBlockedReason(): string | null {
        if (!this.trimmedValue('worksDone')) {
            return 'Renseignez les travaux effectués.';
        }
        if (!this.trimmedValue('testsDone')) {
            return 'Renseignez les tests effectués.';
        }
        const success = this.repairForm.get('repairSuccess')?.value;
        if (success !== true && success !== false) {
            return 'Indiquez si la réparation est réussie.';
        }
        const tests = this.repairForm.get('testsValidated')?.value;
        if (tests !== true && tests !== false) {
            return 'Indiquez si les tests sont validés.';
        }
        return null;
    }

    private computeFinishDisabled(): boolean {
        // `finishing` = clôture déjà en vol (anti double-soumission).
        return this.finishing || this.finishBlockedReason !== null;
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
        // Même garde que l'hôte : un segment ouvert depuis plus d'une journée est
        // une session abandonnée, pas du temps travaillé. On l'ignore plutôt que
        // d'afficher des centaines d'heures (l'hôte annule déjà l'ancre hors phase).
        const rawLeg = running
            ? Date.now() - (this.runStartedAtMs as number)
            : 0;
        const leg =
            rawLeg > 0 && rawLeg <= TechRepairListComponent.MAX_PLAUSIBLE_LEG_MS
                ? rawLeg
                : 0;
        const ms = (this.elapsedBaseMs || 0) + leg;
        // AFFICHAGE piloté par l'ancre (`running`), mais le LIBELLÉ du bouton
        // (Mettre en pause ↔ Reprendre) vient du STATUT — même source que l'action
        // de pause/reprise. Sinon l'ancre `runStartedAtMs` (qui peut dériver) fait
        // pointer libellé et action à l'opposé → « il faut cliquer deux fois ».
        const paused = (this.di?.status ?? '') === 'REPARATION_Pause';
        this.timer = {
            display: this.formatHMS(Math.floor(ms / 1000)),
            isRunning: !paused,
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
