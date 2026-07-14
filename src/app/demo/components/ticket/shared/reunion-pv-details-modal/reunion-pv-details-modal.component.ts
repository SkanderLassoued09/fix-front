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
    FormArray,
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
} from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { CalendarModule } from 'primeng/calendar';
import { DropdownModule } from 'primeng/dropdown';
import { MessageService } from 'primeng/api';
import { ReunionPvService } from 'src/app/demo/service/reunion-pv.service';
import { ReunionPvPdfService } from 'src/app/demo/service/reunion-pv-pdf.service';
import { ProfileService } from 'src/app/demo/service/profile.service';

interface ProfileOption {
    _id: string;
    label: string;
}

/** 5M / Ishikawa families (mo, mt, mi, ma, me). */
const FAMILIES: ReadonlyArray<{ key: string; label: string }> = [
    { key: 'mo', label: "Main-d'œuvre" },
    { key: 'mt', label: 'Matériel' },
    { key: 'mi', label: 'Milieu' },
    { key: 'ma', label: 'Matière' },
    { key: 'me', label: 'Méthode' },
];

/**
 * PV detail modal — Phase 2 "document the meeting". Reached from the row eye
 * button AND from the ~5-min Discord reminder deep-link. Editable while the PV
 * is BROUILLON (fill Ordre du jour, Points, Décisions, Actions, 5M then save →
 * each action is pushed to Jira, idempotently); read-only once FINALISE. The
 * PDF export is always available.
 */
@Component({
    selector: 'app-reunion-pv-details-modal',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        DialogModule,
        ButtonModule,
        TooltipModule,
        CalendarModule,
        DropdownModule,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './reunion-pv-details-modal.component.html',
    styleUrls: ['./reunion-pv-details-modal.component.scss'],
})
export class ReunionPvDetailsModalComponent implements OnInit, OnChanges {
    @Input() visible = false;
    @Input() pvId: string | null = null;
    @Output() visibleChange = new EventEmitter<boolean>();
    /** Emitted after a successful save so the parent list can refresh. */
    @Output() saved = new EventEmitter<void>();

    pv: any = null;
    loading = false;
    saving = false;
    downloading = false;

    readonly families = FAMILIES;
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

    profileNames = new Map<string, string>();
    profileOptions: ProfileOption[] = [];

    form!: FormGroup;

    constructor(
        private readonly fb: FormBuilder,
        private readonly apollo: Apollo,
        private readonly reunionGql: ReunionPvService,
        private readonly profileService: ProfileService,
        private readonly pdf: ReunionPvPdfService,
        private readonly toast: MessageService,
        private readonly cdr: ChangeDetectorRef,
    ) {}

    ngOnInit(): void {
        this.buildForm();
        this.loadProfiles();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['visible'] && this.visible && this.pvId) {
            this.load(this.pvId);
        }
        if (changes['visible'] && !this.visible) {
            this.pv = null;
        }
    }

    /** BROUILLON → editable; FINALISE → read-only. */
    get editable(): boolean {
        return this.pv?.statut !== 'FINALISE';
    }

    /** "Motif" line under the title — the meeting object, falling back to the
     *  retour motif captured at creation. */
    get motifText(): string {
        return (this.pv?.objet || this.pv?.contexteRetour?.motif || '').trim();
    }

    /** Two-letter uppercase initials from a display name (avatar tiles). */
    initials(text: any): string {
        const s = String(text ?? '').trim();
        if (!s) return '?';
        const words = s.split(/\s+/).filter(Boolean);
        if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }

    /** 5M is only relevant for meetings tied to a DI Retour. */
    get showFivem(): boolean {
        return !!this.pv?.contexteRetour;
    }

    close(): void {
        this.visible = false;
        this.visibleChange.emit(false);
    }

    // ── Form ─────────────────────────────────────────────────────────

    private buildForm(): void {
        this.form = this.fb.group({
            ordreDuJour: this.fb.array<any>([]),
            decisions: this.fb.array<any>([]),
            pointsDiscutes: this.fb.array<any>([]),
            actions: this.fb.array<any>([]),
            probleme: [''],
            // one textarea (newline-separated causes) per 5M family
            fivem: this.fb.group(
                FAMILIES.reduce(
                    (acc, f) => ({ ...acc, [f.key]: [''] }),
                    {} as Record<string, any>,
                ),
            ),
        });
    }

    get ordreDuJour(): FormArray {
        return this.form.get('ordreDuJour') as FormArray;
    }
    get decisions(): FormArray {
        return this.form.get('decisions') as FormArray;
    }
    get pointsDiscutes(): FormArray {
        return this.form.get('pointsDiscutes') as FormArray;
    }
    get actions(): FormArray {
        return this.form.get('actions') as FormArray;
    }
    get fivemGroup(): FormGroup {
        return this.form.get('fivem') as FormGroup;
    }

    addOrdreLine(): void {
        this.ordreDuJour.push(this.fb.control(''));
    }
    removeOrdreLine(i: number): void {
        this.ordreDuJour.removeAt(i);
    }
    addDecisionLine(): void {
        this.decisions.push(this.fb.control(''));
    }
    removeDecisionLine(i: number): void {
        this.decisions.removeAt(i);
    }
    addPoint(): void {
        this.pointsDiscutes.push(this.fb.group({ titre: [''], contenu: [''] }));
    }
    removePoint(i: number): void {
        this.pointsDiscutes.removeAt(i);
    }
    addAction(): void {
        this.actions.push(
            this.fb.group({
                _id: [null as string | null],
                titre: [''],
                description: [''],
                responsable: [null as string | null],
                echeance: [null as Date | null],
                priorite: ['MOYENNE'],
                statut: ['A_FAIRE'],
                jira: [null as any],
            }),
        );
    }
    removeAction(i: number): void {
        this.actions.removeAt(i);
    }

    /** Read-only Jira badge helpers, per action row. */
    actionJira(i: number): any {
        return (this.actions.at(i) as FormGroup).get('jira')?.value ?? null;
    }

    private patchFormFromPv(pv: any): void {
        // Clear all arrays first (re-open with a different PV).
        [this.ordreDuJour, this.decisions, this.pointsDiscutes, this.actions].forEach(
            (arr) => {
                while (arr.length) arr.removeAt(0);
            },
        );

        (pv?.ordreDuJour ?? []).forEach((s: string) =>
            this.ordreDuJour.push(this.fb.control(s)),
        );
        (pv?.decisions ?? []).forEach((s: string) =>
            this.decisions.push(this.fb.control(s)),
        );
        (pv?.pointsDiscutes ?? []).forEach((p: any) =>
            this.pointsDiscutes.push(
                this.fb.group({ titre: [p?.titre ?? ''], contenu: [p?.contenu ?? ''] }),
            ),
        );
        (pv?.actions ?? []).forEach((a: any) =>
            this.actions.push(
                this.fb.group({
                    _id: [a?._id ?? null],
                    titre: [a?.titre ?? ''],
                    description: [a?.description ?? ''],
                    responsable: [a?.responsable ?? null],
                    echeance: [a?.echeance ? new Date(a.echeance) : null],
                    priorite: [a?.priorite ?? 'MOYENNE'],
                    statut: [a?.statut ?? 'A_FAIRE'],
                    jira: [a?.jira ?? null],
                }),
            ),
        );

        // 5M: problem + one newline-joined textarea per family.
        const fivemPatch: Record<string, string> = {};
        for (const fam of FAMILIES) {
            const famData = (pv?.ishikawa?.familles ?? []).find(
                (f: any) => f.key === fam.key,
            );
            fivemPatch[fam.key] = (famData?.causes ?? [])
                .map((c: any) => c.label)
                .filter(Boolean)
                .join('\n');
        }
        this.form.patchValue({
            probleme: pv?.ishikawa?.probleme ?? '',
            fivem: fivemPatch,
        });

        if (!this.editable) this.form.disable();
        else this.form.enable();
    }

    // ── Data loaders ─────────────────────────────────────────────────

    private load(id: string): void {
        this.loading = true;
        this.cdr.markForCheck();
        this.apollo
            .query<any>({
                query: this.reunionGql.reunionPVById(),
                variables: { id },
                fetchPolicy: 'no-cache',
            })
            .subscribe({
                next: ({ data }) => {
                    this.pv = data?.reunionPV ?? null;
                    if (this.pv) this.patchFormFromPv(this.pv);
                    this.loading = false;
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.pv = null;
                    this.loading = false;
                    this.cdr.markForCheck();
                },
            });
    }

    private loadProfiles(): void {
        this.apollo
            .query<any>({
                query: this.profileService.getAllProfile(200, 0),
                fetchPolicy: 'no-cache',
            })
            .subscribe({
                next: ({ data }) => {
                    const rows = data?.getAllProfiles?.profileRecord ?? [];
                    const names = new Map<string, string>();
                    const opts: ProfileOption[] = [];
                    for (const p of rows) {
                        const name =
                            `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() ||
                            p.username ||
                            p._id;
                        names.set(p._id, name);
                        opts.push({ _id: p._id, label: name });
                    }
                    this.profileNames = names;
                    this.profileOptions = opts;
                    this.cdr.markForCheck();
                },
                error: () => {
                    /* fall back to ids in render */
                },
            });
    }

    // ── Save ─────────────────────────────────────────────────────────

    private buildIshikawaPayload(): any | null {
        const probleme = (this.form.value.probleme || '').trim();
        const familles = FAMILIES.map((fam) => {
            const raw: string = this.fivemGroup.get(fam.key)?.value || '';
            const causes = raw
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean)
                .map((label) => ({ label, detail: '', custom: true }));
            return { key: fam.key, label: fam.label, causes };
        }).filter((f) => f.causes.length);
        if (!probleme && !familles.length) return null;
        return { probleme, familles };
    }

    private buildUpdateInput(finalize: boolean): any {
        const v = this.form.getRawValue();
        return {
            _id: this.pv._id,
            ordreDuJour: (v.ordreDuJour || [])
                .map((s: string) => (s || '').trim())
                .filter(Boolean),
            decisions: (v.decisions || [])
                .map((s: string) => (s || '').trim())
                .filter(Boolean),
            pointsDiscutes: (v.pointsDiscutes || [])
                .filter((p: any) => (p.titre || '').trim().length)
                .map((p: any) => ({
                    titre: (p.titre || '').trim(),
                    contenu: (p.contenu || '').trim(),
                })),
            actions: (v.actions || [])
                .filter((a: any) => (a.titre || '').trim().length)
                .map((a: any) => ({
                    // echo _id so the backend UPDATES the same Jira issue
                    ...(a._id ? { _id: a._id } : {}),
                    titre: (a.titre || '').trim(),
                    description: (a.description || '').trim(),
                    responsable: a.responsable || null,
                    echeance: a.echeance ?? null,
                    priorite: a.priorite,
                    statut: a.statut,
                })),
            ishikawa: this.showFivem ? this.buildIshikawaPayload() : null,
            ...(finalize ? { statut: 'FINALISE' } : {}),
        };
    }

    async save(finalize = false): Promise<void> {
        if (!this.pv?._id || this.saving) return;
        this.saving = true;
        this.cdr.markForCheck();
        try {
            const res: any = await this.apollo
                .mutate({
                    mutation: this.reunionGql.updateReunionPVDetails(),
                    variables: { input: this.buildUpdateInput(finalize) },
                })
                .toPromise();
            const updated = res?.data?.updateReunionPVDetails;
            if (updated) {
                // Re-sync local pv (statut + jira back-links) and re-patch.
                this.pv = { ...this.pv, ...updated };
                this.patchFormFromPv(this.pv);
                this.toast.add({
                    severity: 'success',
                    summary: finalize ? 'Réunion finalisée' : 'Réunion documentée',
                    detail: finalize
                        ? 'Le PV est finalisé.'
                        : 'Les sections ont été enregistrées et les actions poussées dans Jira.',
                });
                this.saved.emit();
            }
        } catch {
            this.toast.add({
                severity: 'error',
                summary: 'Enregistrement impossible',
                detail: 'Vérifiez les champs et réessayez.',
            });
        } finally {
            this.saving = false;
            this.cdr.markForCheck();
        }
    }

    async downloadPdf(): Promise<void> {
        if (!this.pv) return;
        this.downloading = true;
        try {
            await this.pdf.generateAndDownload(this.pv, this.profileNames);
        } finally {
            this.downloading = false;
        }
    }

    // ── Label helpers (kept for the read-only header/tags) ───────────

    nameOf(id?: string): string {
        if (!id) return '—';
        return this.profileNames.get(id) || id;
    }
    statutLabel(v?: string): string {
        return v === 'FINALISE' ? 'Finalisé' : 'Brouillon';
    }
    statutSeverity(v?: string): 'success' | 'warning' | 'info' {
        return v === 'FINALISE' ? 'success' : 'warning';
    }
    modaliteLabel(v?: string): string {
        switch (v) {
            case 'PRESENTIEL':
                return 'Présentiel';
            case 'VISIO':
                return 'Visioconférence';
            case 'HYBRIDE':
                return 'Hybride';
            default:
                return '—';
        }
    }
    presenceLabel(v?: string): string {
        switch (v) {
            case 'PRESENT':
                return 'Présent';
            case 'ABSENT':
                return 'Absent';
            case 'EXCUSE':
                return 'Excusé';
            default:
                return '—';
        }
    }
}
