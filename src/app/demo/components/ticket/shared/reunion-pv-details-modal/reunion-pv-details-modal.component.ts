import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnChanges,
    Output,
    SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Apollo } from 'apollo-angular';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { TooltipModule } from 'primeng/tooltip';
import { ReunionPvService } from 'src/app/demo/service/reunion-pv.service';
import { ReunionPvPdfService } from 'src/app/demo/service/reunion-pv-pdf.service';
import { ProfileService } from 'src/app/demo/service/profile.service';

interface ProfileLite {
    _id: string;
    name: string;
}

/**
 * Read-only PV viewer — pulls the full record by id (via `reunionPVById`),
 * resolves profile names from a cached lookup, and offers a single PDF
 * download CTA. Reused by both the row "Voir" button and the row "PDF"
 * button (the PDF button uses the same fetched data so no double request).
 *
 * Standalone Angular component so a single import wires it into any
 * parent (reunion-list, future DI tab, etc.).
 */
@Component({
    selector: 'app-reunion-pv-details-modal',
    standalone: true,
    imports: [
        CommonModule,
        DialogModule,
        ButtonModule,
        TagModule,
        TableModule,
        TooltipModule,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './reunion-pv-details-modal.component.html',
    styleUrls: ['./reunion-pv-details-modal.component.scss'],
})
export class ReunionPvDetailsModalComponent implements OnChanges {
    @Input() visible = false;
    @Input() pvId: string | null = null;
    @Output() visibleChange = new EventEmitter<boolean>();

    pv: any = null;
    loading = false;
    downloading = false;
    /** profileId → display name, populated once and reused for both
     *  rendering AND the PDF generator (so names match across the two). */
    profileNames = new Map<string, string>();

    constructor(
        private readonly apollo: Apollo,
        private readonly reunionGql: ReunionPvService,
        private readonly profileService: ProfileService,
        private readonly pdf: ReunionPvPdfService,
    ) {
        this.loadProfileNames();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['visible'] && this.visible && this.pvId) {
            this.load(this.pvId);
        }
        if (!this.visible) {
            // Drop the previous payload so a stale render never flashes
            // between two openings.
            this.pv = null;
        }
    }

    close(): void {
        this.visible = false;
        this.visibleChange.emit(false);
    }

    private load(id: string): void {
        this.loading = true;
        this.apollo
            .query<any>({
                query: this.reunionGql.reunionPVById(),
                variables: { id },
                fetchPolicy: 'no-cache',
            })
            .subscribe({
                next: ({ data }) => {
                    this.pv = data?.reunionPV ?? null;
                    this.loading = false;
                },
                error: () => {
                    this.pv = null;
                    this.loading = false;
                },
            });
    }

    private loadProfileNames(): void {
        // Same query the modal uses; we deliberately cache once at
        // construction time — the staff list rarely changes mid-session.
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
                    /* fall back to ids in render */
                },
            });
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
    priorityLabel(v?: string): string {
        switch (v) {
            case 'HAUTE':
                return 'Haute';
            case 'MOYENNE':
                return 'Moyenne';
            case 'BASSE':
                return 'Basse';
            default:
                return '—';
        }
    }
    prioritySeverity(v?: string): 'danger' | 'warning' | 'info' {
        if (v === 'HAUTE') return 'danger';
        if (v === 'MOYENNE') return 'warning';
        return 'info';
    }
    actionStatutLabel(v?: string): string {
        switch (v) {
            case 'A_FAIRE':
                return 'À faire';
            case 'EN_COURS':
                return 'En cours';
            case 'TERMINE':
                return 'Terminé';
            default:
                return '—';
        }
    }
    actionStatutSeverity(v?: string): 'success' | 'info' | 'warning' {
        if (v === 'TERMINE') return 'success';
        if (v === 'EN_COURS') return 'info';
        return 'warning';
    }
}
