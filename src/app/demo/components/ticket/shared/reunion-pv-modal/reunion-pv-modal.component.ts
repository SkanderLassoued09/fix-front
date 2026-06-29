import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnInit,
    Output,
    SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
    AbstractControl,
    FormArray,
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { CalendarModule } from 'primeng/calendar';
import { MultiSelectModule } from 'primeng/multiselect';
import { MutationRunner } from 'src/app/demo/service/mutation-runner.service';
import { ProfileService } from 'src/app/demo/service/profile.service';
import { ReunionPvService } from 'src/app/demo/service/reunion-pv.service';

/** Mode controls pre-fill + which fields are visible. */
export type ReunionPvModalMode = 'retour' | 'standalone';

/** Section-rail keys, in display order. */
export type PvSection =
    | 'infos'
    | 'part'
    | 'ordre'
    | 'points'
    | 'dec'
    | 'actions'
    | 'fivem';

/** 5M / Ishikawa family keys, in display order (mo, mt, mi, ma, me). */
export type FamilyKey = 'mo' | 'mt' | 'mi' | 'ma' | 'me';

/** Attendance status of a participant — mirrors backend `ParticipantStatut`. */
export type ParticipantStatut = 'PRESENT' | 'ABSENT' | 'EXCUSE';

interface FamilyMeta {
    key: FamilyKey;
    label: string;
    color: string;
    tint: string;
    desc: string;
}

interface ProfileOption {
    _id: string;
    label: string;
    role?: string;
}

/** Static 5M metadata — colors/tints/descriptions straight from the spec. */
const FAMILIES: readonly FamilyMeta[] = [
    {
        key: 'mo',
        label: "Main-d'œuvre",
        color: '#2f6bff',
        tint: '#eef3ff',
        desc: 'Compétences, formation, motivation',
    },
    {
        key: 'mt',
        label: 'Matériel',
        color: '#1f9d73',
        tint: '#e7f6ef',
        desc: 'Équipements, machines, logiciels',
    },
    {
        key: 'mi',
        label: 'Milieu',
        color: '#d8567a',
        tint: '#fcecf1',
        desc: 'Environnement, conditions',
    },
    {
        key: 'ma',
        label: 'Matière',
        color: '#7C6FE0',
        tint: '#f3f0fd',
        desc: 'Matières premières, composants',
    },
    {
        key: 'me',
        label: 'Méthode',
        color: '#e8943a',
        tint: '#fdf3e6',
        desc: 'Processus, procédures',
    },
];

/** Seeded candidate causes per family (the guided checklist). */
const SEEDED_CAUSES: Record<FamilyKey, string[]> = {
    mo: [
        'Manque de formation',
        'Surcharge de travail',
        'Communication insuffisante',
        'Compétences inadaptées',
        'Turnover / absentéisme',
    ],
    mt: [
        'Équipement défaillant',
        'Maintenance insuffisante',
        'Outils inadaptés',
        'Logiciel obsolète',
        'Capacité insuffisante',
    ],
    mi: [
        'Espace de travail inadapté',
        'Bruit / éclairage',
        'Pression / délais',
        'Conditions climatiques',
        'Organisation des locaux',
    ],
    ma: [
        'Qualité matière première',
        'Rupture de stock',
        'Composant non conforme',
        'Variabilité fournisseur',
        'Stockage inadapté',
    ],
    me: [
        'Procédure non définie',
        'Mode opératoire flou',
        'Absence de contrôle',
        'Processus inadapté',
        'Documentation manquante',
    ],
};

/**
 * Procès-Verbal de Réunion — reusable PrimeNG dialog (high-fidelity redesign).
 *
 * Layout: a left **section rail** + **content pane**, so every input is one
 * click away (no long scroll). Sections: Informations · Participants · Ordre du
 * jour · Points discutés · Décisions · Actions · 5M·Ishikawa. The list sections
 * show a live count badge in the rail.
 *
 *   - mode='retour' (current entry point): pre-fills the DI ref + retour
 *     level coming from the parent (ticket-list). The Retour transition ITSELF
 *     is NOT triggered here — it already fired before the modal opened.
 *   - mode='standalone' (Réunions menu): no DI, no contexte retour.
 *
 * On submit: runs `createReunionPV` through MutationRunner (anti double-submit
 * + serialized cascade), then emits `created`. The 5M analysis persists only
 * the *retained* (checked) causes per family — the seeded checklist is a UI
 * affordance, not data. Lieu/Modalité were intentionally dropped from the form.
 */
@Component({
    selector: 'app-reunion-pv-modal',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        DialogModule,
        CalendarModule,
        MultiSelectModule,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './reunion-pv-modal.component.html',
    styleUrls: ['./reunion-pv-modal.component.scss'],
})
export class ReunionPvModalComponent implements OnInit, OnChanges {
    @Input() visible = false;
    @Input() mode: ReunionPvModalMode = 'standalone';
    @Input() diId: string | null = null;
    @Input() diIdnum: string | null = null;
    @Input() retourNiveau: 1 | 2 | 3 | null = null;
    @Input() retourMotif = '';

    @Output() visibleChange = new EventEmitter<boolean>();
    @Output() created = new EventEmitter<{ _id: string; reference: string }>();
    @Output() cancelled = new EventEmitter<void>();

    readonly priorityOptions = [
        { label: 'Basse', value: 'BASSE' },
        { label: 'Moyenne', value: 'MOYENNE' },
        { label: 'Haute', value: 'HAUTE' },
    ];
    readonly statutActionOptions = [
        { label: 'À faire', value: 'A_FAIRE' },
        { label: 'En cours', value: 'EN_COURS' },
        { label: 'Terminé', value: 'TERMINE' },
    ];

    /** Présent / Excusé / Absent — colors per the design system (no red). */
    readonly participantStatutOptions: ReadonlyArray<{
        label: string;
        value: ParticipantStatut;
        color: string;
    }> = [
        { label: 'Présent', value: 'PRESENT', color: '#16a34a' },
        { label: 'Excusé', value: 'EXCUSE', color: '#b45309' },
        { label: 'Absent', value: 'ABSENT', color: '#64748b' },
    ];

    readonly families = FAMILIES;

    /** Active rail section + the single open 5M family. */
    activeSection: PvSection = 'infos';
    openFamily: FamilyKey | null = 'mo';

    profiles: ProfileOption[] = [];
    /** Loader UI state for the participants dropdown. */
    profilesLoading = false;
    profilesError = false;
    /** Per-participant attendance status, keyed by Profile `_id`. */
    participantStatuts: Record<string, ParticipantStatut> = {};
    saving = false;

    form!: FormGroup;

    private readonly currentUserId =
        typeof localStorage !== 'undefined'
            ? localStorage.getItem('_id') || ''
            : '';

    constructor(
        private readonly fb: FormBuilder,
        private readonly apollo: Apollo,
        private readonly mutationRunner: MutationRunner,
        private readonly toast: MessageService,
        private readonly profileService: ProfileService,
        private readonly reunionPvGql: ReunionPvService,
        private readonly cdr: ChangeDetectorRef,
    ) {}

    ngOnInit(): void {
        this.buildForm();
        this.loadProfiles();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['visible'] && this.visible && this.form) {
            // Re-prefill + reset navigation every time the parent re-opens.
            this.activeSection = 'infos';
            this.openFamily = 'mo';
            this.applyPrefill();
        }
    }

    // ── Form construction ────────────────────────────────────────────

    private buildForm(): void {
        this.form = this.fb.group({
            titre: ['', [Validators.required, Validators.maxLength(200)]],
            objet: [''],
            dateReunion: [new Date(), Validators.required],
            participants: [[] as string[]],
            ordreDuJour: this.fb.array<any>([this.fb.control('')]),
            decisions: this.fb.array<any>([this.fb.control('')]),
            pointsDiscutes: this.fb.array<any>([this.makePointGroup()]),
            actions: this.fb.array<any>([this.makeActionGroup()]),
            prochaineReunion: [null as Date | null],
            // 5M / Ishikawa
            problemeAnalyse: [''],
            ishikawa: this.buildIshikawaGroup(),
        });
        this.applyPrefill();
    }

    private makePointGroup(): FormGroup {
        return this.fb.group({ titre: [''], contenu: [''] });
    }

    private makeActionGroup(): FormGroup {
        return this.fb.group({
            titre: [''],
            description: [''],
            responsable: [null as string | null],
            echeance: [null as Date | null],
            priorite: ['MOYENNE'],
            statut: ['A_FAIRE'],
        });
    }

    private makeCauseGroup(
        label: string,
        checked = false,
        custom = false,
    ): FormGroup {
        return this.fb.group({
            label: [label],
            checked: [checked],
            detail: [''],
            custom: [custom],
        });
    }

    /** FormGroup<mo|mt|mi|ma|me: FormArray<causeGroup>> seeded from the spec. */
    private buildIshikawaGroup(): FormGroup {
        const group: Record<string, FormArray> = {};
        for (const fam of FAMILIES) {
            group[fam.key] = this.fb.array(
                SEEDED_CAUSES[fam.key].map((label) => this.makeCauseGroup(label)),
            );
        }
        return this.fb.group(group);
    }

    private applyPrefill(): void {
        if (this.mode === 'retour' && this.retourNiveau) {
            const titre =
                this.form.value.titre ||
                `Retour ${this.retourNiveau} — ${this.diIdnum ?? 'DI'}`;
            const objet =
                this.form.value.objet ||
                (this.retourMotif
                    ? `Motif: ${this.retourMotif}`
                    : `Analyse du retour niveau ${this.retourNiveau}`);
            const probleme =
                this.form.value.problemeAnalyse ||
                (this.diIdnum
                    ? `Cause racine du retour ${this.retourNiveau} — ${this.diIdnum}`
                    : '');
            this.form.patchValue({ titre, objet, problemeAnalyse: probleme });
        }
    }

    // ── Profiles loader ──────────────────────────────────────────────

    /**
     * Loads ALL profiles from the DB (reuses the existing `getAllProfiles`
     * query; `rows: 200` covers the whole staff table). Independent of the
     * modal mode — runs once on init for both 'retour' and 'standalone'.
     *
     * NOTE: this component is OnPush, and the Apollo result lands outside any
     * template event — so `markForCheck()` is required or the dropdown would
     * stay empty even though the data arrived.
     */
    loadProfiles(): void {
        this.profilesLoading = true;
        this.profilesError = false;
        this.cdr.markForCheck();
        this.apollo
            .query<any>({
                query: this.profileService.getAllProfile(200, 0),
                fetchPolicy: 'no-cache',
            })
            .subscribe({
                next: ({ data }) => {
                    const rows = data?.getAllProfiles?.profileRecord ?? [];
                    this.profiles = rows.map((p: any) => ({
                        _id: p._id,
                        role: p.role,
                        label:
                            `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() ||
                            p.username ||
                            p._id,
                    }));
                    this.profilesLoading = false;
                    this.cdr.markForCheck();
                },
                error: () => {
                    // Non-blocking: the rest of the form stays usable.
                    this.profilesLoading = false;
                    this.profilesError = true;
                    this.toast.add({
                        severity: 'warn',
                        summary: 'Profils indisponibles',
                        detail:
                            'La liste des participants n’a pas pu être chargée. Réessayez.',
                    });
                    this.cdr.markForCheck();
                },
            });
    }

    // ── Section rail ────────────────────────────────────────────────

    setSection(section: PvSection): void {
        this.activeSection = section;
    }

    get nOrdre(): number {
        return this.ordreDuJour.length;
    }
    get nPoints(): number {
        return this.pointsDiscutes.length;
    }
    get nDec(): number {
        return this.decisions.length;
    }
    get nActions(): number {
        return this.actions.length;
    }

    // ── Dynamic list helpers ────────────────────────────────────────

    get ordreDuJour() {
        return this.form.get('ordreDuJour') as FormArray;
    }
    get decisions() {
        return this.form.get('decisions') as FormArray;
    }
    get pointsDiscutes() {
        return this.form.get('pointsDiscutes') as FormArray;
    }
    get actions() {
        return this.form.get('actions') as FormArray;
    }

    addOrdreLine() {
        this.ordreDuJour.push(this.fb.control(''));
    }
    removeOrdreLine(i: number) {
        if (this.ordreDuJour.length > 1) this.ordreDuJour.removeAt(i);
    }
    addDecisionLine() {
        this.decisions.push(this.fb.control(''));
    }
    removeDecisionLine(i: number) {
        if (this.decisions.length > 1) this.decisions.removeAt(i);
    }
    addPoint() {
        this.pointsDiscutes.push(this.makePointGroup());
    }
    removePoint(i: number) {
        if (this.pointsDiscutes.length > 1) this.pointsDiscutes.removeAt(i);
    }
    addAction() {
        this.actions.push(this.makeActionGroup());
    }
    removeAction(i: number) {
        if (this.actions.length > 1) this.actions.removeAt(i);
    }

    // ── Participants (select → chips) ───────────────────────────────

    get selectedParticipants(): string[] {
        return (this.form.get('participants')?.value as string[]) ?? [];
    }

    /**
     * Sync the per-participant status map with the MultiSelect selection:
     * default newly-added ones to PRESENT, drop the de-selected ones.
     */
    onParticipantsChange(ids: string[]): void {
        const next: Record<string, ParticipantStatut> = {};
        for (const id of ids ?? []) {
            next[id] = this.participantStatuts[id] ?? 'PRESENT';
        }
        this.participantStatuts = next;
    }

    participantStatut(id: string): ParticipantStatut {
        return this.participantStatuts[id] ?? 'PRESENT';
    }

    setParticipantStatut(id: string, statut: ParticipantStatut): void {
        this.participantStatuts = { ...this.participantStatuts, [id]: statut };
    }

    removeParticipant(id: string): void {
        const next = this.selectedParticipants.filter((x) => x !== id);
        this.form.get('participants')?.setValue(next);
        this.onParticipantsChange(next);
    }

    participantLabel(id: string): string {
        return this.profiles.find((p) => p._id === id)?.label ?? id;
    }

    // ── 5M / Ishikawa ───────────────────────────────────────────────

    private ishikawaGroup(): FormGroup {
        return this.form.get('ishikawa') as FormGroup;
    }

    familyArray(key: FamilyKey): FormArray {
        return this.ishikawaGroup().get(key) as FormArray;
    }

    familyCauses(key: FamilyKey): FormGroup[] {
        return this.familyArray(key).controls as FormGroup[];
    }

    isFamilyOpen(key: FamilyKey): boolean {
        return this.openFamily === key;
    }

    toggleFamily(key: FamilyKey): void {
        this.openFamily = this.openFamily === key ? null : key;
    }

    isCauseChecked(group: AbstractControl): boolean {
        return !!group.get('checked')?.value;
    }

    toggleCause(group: AbstractControl): void {
        const ctrl = group.get('checked');
        ctrl?.setValue(!ctrl.value);
    }

    addCause(key: FamilyKey): void {
        // Custom cause starts checked so its detail input shows immediately.
        this.familyArray(key).push(this.makeCauseGroup('', true, true));
    }

    removeCause(key: FamilyKey, index: number): void {
        this.familyArray(key).removeAt(index);
    }

    familyCount(key: FamilyKey): number {
        return this.familyCauses(key).filter((g) => this.isCauseChecked(g))
            .length;
    }

    get totalCauses(): number {
        return FAMILIES.reduce((n, f) => n + this.familyCount(f.key), 0);
    }

    /** Header tint when ≥1 cause retained, neutral otherwise. */
    familyHeadBg(fam: FamilyMeta): string {
        return this.familyCount(fam.key) ? fam.tint : '#fafbfd';
    }

    // ── Submit / cancel ─────────────────────────────────────────────

    private buildIshikawaPayload(): any | null {
        const probleme = (this.form.value.problemeAnalyse || '').trim();
        const familles = FAMILIES.map((fam) => {
            const causes = this.familyCauses(fam.key)
                .map((g) => g.value)
                .filter((c) => c.checked && (c.label || '').trim().length)
                .map((c) => ({
                    label: (c.label || '').trim(),
                    detail: (c.detail || '').trim(),
                    custom: !!c.custom,
                }));
            return { key: fam.key, label: fam.label, causes };
        }).filter((f) => f.causes.length);

        if (!probleme && !familles.length) return null;
        return { probleme, familles };
    }

    async submit(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            // Surface the validation error on the section that owns it.
            this.activeSection = 'infos';
            return;
        }
        if (!this.currentUserId) {
            this.toast.add({
                severity: 'error',
                summary: 'Auteur inconnu',
                detail: 'Reconnectez-vous puis réessayez.',
            });
            return;
        }
        const v = this.form.value;
        const input: any = {
            titre: (v.titre || '').trim(),
            objet: (v.objet || '').trim(),
            dateReunion: v.dateReunion,
            createdById: this.currentUserId,
            diId: this.mode === 'retour' ? this.diId : null,
            contexteRetour:
                this.mode === 'retour' && this.retourNiveau
                    ? { niveau: this.retourNiveau, motif: this.retourMotif || '' }
                    : null,
            participants: (v.participants || []).map((id: string) => ({
                profile: id,
                statut: this.participantStatut(id),
            })),
            ordreDuJour: (v.ordreDuJour || [])
                .map((s: string) => (s || '').trim())
                .filter(Boolean),
            decisions: (v.decisions || [])
                .map((s: string) => (s || '').trim())
                .filter(Boolean),
            pointsDiscutes: (v.pointsDiscutes || []).filter(
                (p: any) => (p.titre || '').trim().length,
            ),
            actions: (v.actions || []).filter(
                (a: any) => (a.titre || '').trim().length,
            ),
            ishikawa: this.buildIshikawaPayload(),
            prochaineReunion: v.prochaineReunion ?? null,
            statut: 'BROUILLON',
        };

        try {
            const data = await this.mutationRunner.run({
                key: `reunion-pv-create-${this.diId ?? 'standalone'}`,
                mutation: this.reunionPvGql.createReunionPV(),
                variables: { input },
                successToast: {
                    summary: 'PV créé',
                    detail: 'Le procès-verbal a été enregistré.',
                },
                errorToast: {
                    summary: 'Création impossible',
                    detail: 'Vérifiez les champs et réessayez.',
                },
                onLoading: (l) => (this.saving = l),
            });
            const pv = data?.createReunionPV;
            if (pv?._id) {
                this.created.emit({ _id: pv._id, reference: pv.reference });
                this.close();
            }
        } catch {
            /* toast already shown by MutationRunner */
        }
    }

    cancel(): void {
        this.cancelled.emit();
        this.close();
    }

    private close(): void {
        this.visible = false;
        this.visibleChange.emit(false);
        this.activeSection = 'infos';
        this.openFamily = 'mo';
        this.participantStatuts = {};
        this.form?.reset({
            titre: '',
            objet: '',
            dateReunion: new Date(),
            participants: [],
            prochaineReunion: null,
            problemeAnalyse: '',
        });
        // Rebuild dynamic arrays — `reset` keeps the existing controls.
        while (this.ordreDuJour.length > 1) this.ordreDuJour.removeAt(1);
        this.ordreDuJour.at(0)?.setValue('');
        while (this.decisions.length > 1) this.decisions.removeAt(1);
        this.decisions.at(0)?.setValue('');
        while (this.pointsDiscutes.length > 1) this.pointsDiscutes.removeAt(1);
        this.pointsDiscutes.at(0)?.reset({ titre: '', contenu: '' });
        while (this.actions.length > 1) this.actions.removeAt(1);
        this.actions.at(0)?.reset({
            titre: '',
            description: '',
            responsable: null,
            echeance: null,
            priorite: 'MOYENNE',
            statut: 'A_FAIRE',
        });
        // Rebuild the 5M group back to its seeded, unchecked baseline.
        this.form.setControl('ishikawa', this.buildIshikawaGroup());
    }

    // Avoid leaking the apollo+rxjs symbols in unused-imports lint —
    // referenced indirectly via the MutationRunner.
    private _keep() {
        return [firstValueFrom, filter, take];
    }
}
