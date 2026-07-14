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
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { CalendarModule } from 'primeng/calendar';
import { MultiSelectModule } from 'primeng/multiselect';
import { MutationRunner } from 'src/app/demo/service/mutation-runner.service';
import { ProfileService } from 'src/app/demo/service/profile.service';
import { ReunionPvService } from 'src/app/demo/service/reunion-pv.service';

/** Mode controls pre-fill + whether a DI/contexte-retour is attached. */
export type ReunionPvModalMode = 'retour' | 'standalone';

/** Attendance status of a participant — mirrors backend `ParticipantStatut`. */
export type ParticipantStatut = 'PRESENT' | 'ABSENT' | 'EXCUSE';

interface ProfileOption {
    _id: string;
    label: string;
    role?: string;
}

/**
 * Procès-Verbal de Réunion — LIGHT creation dialog (Phase 1 of the 2-phase flow).
 *
 * Captures ONLY the 5 essentials + participants:
 *   Titre* · Objet · Date de la réunion* (avec heure) · Prochaine réunion · Participants.
 *
 * The detailed sections (Ordre du jour, Points discutés, Décisions, Actions à
 * mener, 5M·Ishikawa) are documented LATER, at meeting time, in the detail modal
 * (`app-reunion-pv-details-modal`) — reached from the ~5-min Discord reminder.
 *
 * On submit: `createReunionPV` through MutationRunner, then emits `created`.
 *   - mode='retour': pre-fills titre/objet from the DI ref + retour level and
 *     attaches `diId` + `contexteRetour` (so the detail modal can show 5M).
 *   - mode='standalone' (Réunions menu): no DI, no contexte retour.
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

    profiles: ProfileOption[] = [];
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
            this.applyPrefill();
        }
    }

    // ── Form construction (light) ────────────────────────────────────

    private buildForm(): void {
        this.form = this.fb.group({
            titre: ['', [Validators.required, Validators.maxLength(200)]],
            objet: [''],
            dateReunion: [new Date(), Validators.required],
            prochaineReunion: [null as Date | null],
            participants: [[] as string[]],
        });
        this.applyPrefill();
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
            this.form.patchValue({ titre, objet });
        }
    }

    // ── Profiles loader ──────────────────────────────────────────────

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

    // ── Participants (select → chips) ───────────────────────────────

    get selectedParticipants(): string[] {
        return (this.form.get('participants')?.value as string[]) ?? [];
    }

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

    // ── Submit / cancel ─────────────────────────────────────────────

    async submit(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
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
        // LIGHT payload — detailed sections are documented later in the detail
        // modal. contexteRetour/diId are kept so 5M can be shown conditionally.
        const input: any = {
            titre: (v.titre || '').trim(),
            objet: (v.objet || '').trim(),
            dateReunion: v.dateReunion,
            prochaineReunion: v.prochaineReunion ?? null,
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
        this.participantStatuts = {};
        this.form?.reset({
            titre: '',
            objet: '',
            dateReunion: new Date(),
            prochaineReunion: null,
            participants: [],
        });
    }
}
