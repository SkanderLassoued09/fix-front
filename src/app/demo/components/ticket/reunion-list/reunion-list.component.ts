import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnInit,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { ReunionPvService } from 'src/app/demo/service/reunion-pv.service';
import { ReunionPvPdfService } from 'src/app/demo/service/reunion-pv-pdf.service';
import { ProfileService } from 'src/app/demo/service/profile.service';
import { MessageService } from 'primeng/api';
import { ReunionPvModalComponent } from '../shared/reunion-pv-modal/reunion-pv-modal.component';
import { ReunionPvDetailsModalComponent } from '../shared/reunion-pv-details-modal/reunion-pv-details-modal.component';

interface ReunionRow {
    _id: string;
    reference: string;
    titre: string;
    dateReunion: string | Date;
    lieu: string;
    modalite: string;
    statut: string;
    di: string | null;
    createdBy: string;
    contexteRetour?: { niveau?: number } | null;
    createdAt: string | Date;
}

/**
 * « Réunions » menu — top-level list of every Procès-Verbal de Réunion.
 *
 *   - Reuses the shared `ReunionPvModalComponent` in **standalone** mode
 *     for the "+ Nouvelle réunion" CTA: no DI binding, no retour level.
 *     Same component as the one fired from the Retour flow → zero code
 *     duplication.
 *   - Read-path uses the `reunionPVs` query with no filter (server caps
 *     at 200, newest first).
 *
 * Kept standalone (`standalone: true`) so a single import in the routing
 * module is enough — no module to wire up.
 */
@Component({
    selector: 'app-reunion-list',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        TableModule,
        ButtonModule,
        TagModule,
        InputTextModule,
        TooltipModule,
        ReunionPvModalComponent,
        ReunionPvDetailsModalComponent,
    ],
    providers: [DatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './reunion-list.component.html',
    styleUrls: ['./reunion-list.component.scss'],
})
export class ReunionListComponent implements OnInit {
    rows: ReunionRow[] = [];
    filter = '';
    loading = false;
    createOpen = false;

    // Details modal state — opened by the row "Voir" button.
    detailsOpen = false;
    detailsPvId: string | null = null;

    // Per-row PDF download progress (keyed by PV id) so multiple
    // simultaneous downloads can show their own spinner without blocking.
    downloadingIds = new Set<string>();

    /** profileId → display name, fetched once and reused for the PDF
     *  generator so rows with assigned responsables/participants show
     *  real names. */
    private profileNames = new Map<string, string>();

    constructor(
        private readonly apollo: Apollo,
        private readonly reunionPvGql: ReunionPvService,
        private readonly profileService: ProfileService,
        private readonly pdf: ReunionPvPdfService,
        private readonly toast: MessageService,
        private readonly cdr: ChangeDetectorRef,
    ) {}

    ngOnInit(): void {
        this.load();
        this.loadProfileNames();
    }

    /** Cache staff names so the row download path doesn't need a second
     *  query (and so the PDF shows real names, not ids). */
    private loadProfileNames(): void {
        this.apollo
            .query<any>({
                query: this.profileService.getAllProfile(200, 0),
                fetchPolicy: 'no-cache',
            })
            .subscribe({
                next: ({ data }) => {
                    const rows = data?.getAllProfiles?.profileRecord ?? [];
                    const next = new Map<string, string>();
                    for (const p of rows) {
                        const name =
                            `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() ||
                            p.username ||
                            p._id;
                        next.set(p._id, name);
                    }
                    this.profileNames = next;
                },
                error: () => {
                    /* fall back to ids in PDF */
                },
            });
    }

    /** Open the read-only details viewer. Same dialog used for the row
     *  "Voir" CTA AND (indirectly) the PDF download from inside it. */
    openDetails(row: ReunionRow): void {
        this.detailsPvId = row._id;
        this.detailsOpen = true;
    }

    /** Row-level PDF: fetch the full PV (the list payload is the lite
     *  shape), then run the generator. We intentionally re-fetch each
     *  time instead of caching so a PV edited elsewhere yields the
     *  freshest document. */
    async downloadPdf(row: ReunionRow): Promise<void> {
        if (this.downloadingIds.has(row._id)) return;
        this.downloadingIds.add(row._id);
        this.cdr.detectChanges();
        try {
            const { data } = await this.apollo
                .query<any>({
                    query: this.reunionPvGql.reunionPVById(),
                    variables: { id: row._id },
                    fetchPolicy: 'no-cache',
                })
                .toPromise()
                .then((r: any) => r ?? {});
            const pv = data?.reunionPV;
            if (!pv) {
                this.toast.add({
                    severity: 'error',
                    summary: 'PV introuvable',
                    detail: 'Impossible de charger ce procès-verbal.',
                });
                return;
            }
            await this.pdf.generateAndDownload(pv, this.profileNames);
        } catch {
            this.toast.add({
                severity: 'error',
                summary: 'Téléchargement impossible',
                detail: 'Réessayez dans un instant.',
            });
        } finally {
            this.downloadingIds.delete(row._id);
            this.cdr.detectChanges();
        }
    }

    isDownloading(id: string): boolean {
        return this.downloadingIds.has(id);
    }

    load(): void {
        this.loading = true;
        this.apollo
            .query<any>({
                query: this.reunionPvGql.reunionPVsAll(),
                fetchPolicy: 'no-cache',
            })
            .subscribe({
                next: ({ data }) => {
                    this.rows = (data?.reunionPVs ?? []) as ReunionRow[];
                    this.loading = false;
                    this.cdr.detectChanges();
                },
                error: () => {
                    this.loading = false;
                    this.cdr.detectChanges();
                },
            });
    }

    onCreated(): void {
        // PV persisted backend-side. Refresh so it lands at the top.
        this.createOpen = false;
        this.load();
    }

    onCancelled(): void {
        this.createOpen = false;
    }

    badgeSeverity(statut: string): 'success' | 'info' | 'warning' | 'danger' {
        // Brouillon → ambre, Finalisé → vert. Anything else (future
        // additions) → neutral.
        switch (statut) {
            case 'FINALISE':
                return 'success';
            case 'BROUILLON':
                return 'warning';
            default:
                return 'info';
        }
    }

    badgeLabel(statut: string): string {
        return statut === 'FINALISE' ? 'Finalisé' : 'Brouillon';
    }

    /** Filters in-memory across the visible columns. Keeps the table
     *  responsive without round-tripping to the server. */
    get filteredRows(): ReunionRow[] {
        const q = this.filter.trim().toLowerCase();
        if (!q) return this.rows;
        return this.rows.filter((r) => {
            const haystack = [
                r.reference,
                r.titre,
                r.lieu,
                r.modalite,
                r.statut,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(q);
        });
    }
}
