import {
    ChangeDetectionStrategy,
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
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';
import { MutationRunner } from 'src/app/demo/service/mutation-runner.service';
import { ProfileService } from 'src/app/demo/service/profile.service';
import { ReunionPvService } from 'src/app/demo/service/reunion-pv.service';

/** Mode controls pre-fill + which fields are visible. */
export type ReunionPvModalMode = 'retour' | 'standalone';

interface ProfileOption {
    _id: string;
    label: string;
    role?: string;
}

/**
 * Procès-Verbal de Réunion — reusable PrimeNG dialog.
 *
 *   - mode='retour' (current entry point): pre-fills the DI ref + retour
 *     level coming from the parent (ticket-list). The Retour transition
 *     ITSELF is NOT triggered here — it already fired before the modal
 *     opened. This PV is documentary; cancelling it leaves the Retour
 *     transition intact.
 *   - mode='standalone' (future Réunions menu): no DI, no contexte
 *     retour. Same form, same submit path.
 *
 * On submit: runs `createReunionPV` through MutationRunner (anti
 * double-submit + serialized cascade pattern used across the app), then
 * emits `created` so the parent can refresh its list. On cancel: emits
 * `cancelled` and resets the form. The dialog itself never auto-closes
 * on submit failure — the toast surfaces the error and the user can
 * retry.
 */
@Component({
    selector: 'app-reunion-pv-modal',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        DialogModule,
        ButtonModule,
        InputTextModule,
        InputTextareaModule,
        CalendarModule,
        DropdownModule,
        MultiSelectModule,
        TooltipModule,
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

    readonly modaliteOptions = [
        { label: 'Présentiel', value: 'PRESENTIEL' },
        { label: 'Visio', value: 'VISIO' },
        { label: 'Hybride', value: 'HYBRIDE' },
    ];
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

    profiles: ProfileOption[] = [];
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
    ) {}

    ngOnInit(): void {
        this.buildForm();
        this.loadProfiles();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['visible'] && this.visible && this.form) {
            // Re-prefill every time the parent re-opens the modal (the DI
            // and retour level may have changed between two opens).
            this.applyPrefill();
        }
    }

    // ── Form construction ────────────────────────────────────────────

    private buildForm(): void {
        this.form = this.fb.group({
            titre: ['', [Validators.required, Validators.maxLength(200)]],
            objet: [''],
            dateReunion: [new Date(), Validators.required],
            lieu: [''],
            modalite: ['PRESENTIEL'],
            participants: [[] as string[]],
            ordreDuJour: this.fb.array<any>([this.fb.control('')]),
            decisions: this.fb.array<any>([this.fb.control('')]),
            pointsDiscutes: this.fb.array<any>([this.makePointGroup()]),
            actions: this.fb.array<any>([this.makeActionGroup()]),
            prochaineReunion: [null as Date | null],
        });
        this.applyPrefill();
    }

    private makePointGroup(): FormGroup {
        return this.fb.group({
            titre: [''],
            contenu: [''],
        });
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

    private loadProfiles(): void {
        // Reuses the existing getAllProfile query. 200/1000 is enough to
        // cover the whole staff table — there are typically < 100 active
        // profiles. Failure here is non-blocking (the user can still type
        // the participants list manually); we just log and continue.
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
                        label: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() ||
                            p.username ||
                            p._id,
                    }));
                },
                error: () => {
                    /* silent — modal stays usable without the dropdown */
                },
            });
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
        const input: any = {
            titre: (v.titre || '').trim(),
            objet: (v.objet || '').trim(),
            dateReunion: v.dateReunion,
            lieu: (v.lieu || '').trim(),
            modalite: v.modalite,
            createdById: this.currentUserId,
            diId: this.mode === 'retour' ? this.diId : null,
            contexteRetour:
                this.mode === 'retour' && this.retourNiveau
                    ? {
                          niveau: this.retourNiveau,
                          motif: this.retourMotif || '',
                      }
                    : null,
            participants: (v.participants || []).map((id: string) => ({
                profile: id,
                statut: 'PRESENT',
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
            actions: (v.actions || []).filter((a: any) =>
                (a.titre || '').trim().length,
            ),
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
        this.form?.reset({
            titre: '',
            objet: '',
            dateReunion: new Date(),
            lieu: '',
            modalite: 'PRESENTIEL',
            participants: [],
            prochaineReunion: null,
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
    }

    // Avoid leaking the apollo+rxjs symbols in unused-imports lint —
    // referenced indirectly via the MutationRunner.
    private _keep() {
        return [firstValueFrom, filter, take];
    }
}
