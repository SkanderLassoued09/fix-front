import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Apollo } from 'apollo-angular';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { DiArchiveService } from 'src/app/demo/service/di-archive.service';
import { DiArchiveDetailModalComponent } from '../ticket/shared/di-archive-detail-modal/di-archive-detail-modal.component';
import { DiArchiveImportComponent } from '../ticket/shared/di-archive-import/di-archive-import.component';

/**
 * « Archives DI » — list of historical/migrated DIs. Each row opens the detail
 * modal (4 document slots + Drive upload + live completude badge).
 *
 * Standalone + lazy-loaded via `loadComponent` (route `/archives`). Uses the
 * ROOT `MessageService` (same one `MutationRunner` posts to) so the modal's
 * toasts land in this page's `<p-toast>`.
 */
@Component({
  selector: 'app-archive-list',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    TagModule,
    ToastModule,
    DiArchiveDetailModalComponent,
    DiArchiveImportComponent,
  ],
  templateUrl: './archive-list.component.html',
  styleUrls: ['./archive-list.component.scss'],
})
export class ArchiveListComponent implements OnInit {
  rows: any[] = [];
  loading = false;
  detailVisible = false;
  selected: any = null;

  constructor(
    private readonly apollo: Apollo,
    private readonly gql: DiArchiveService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.apollo
      .query<any>({ query: this.gql.diArchivesQuery(), fetchPolicy: 'no-cache' })
      .subscribe({
        next: ({ data }) => {
          this.rows = (data?.diArchives ?? []).map((r: any) => ({ ...r }));
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  open(row: any): void {
    this.selected = { ...row };
    this.detailVisible = true;
  }

  /** Reflect the modal's doc/completude changes back into the list row (live). */
  onChanged(updated: any): void {
    if (!updated?._id) return;
    const i = this.rows.findIndex((r) => r._id === updated._id);
    if (i >= 0) this.rows[i] = { ...this.rows[i], ...updated };
  }

  docCount(row: any): number {
    return ['bc', 'bl', 'devis', 'facture'].filter((k) => row?.[k]).length;
  }

  /** Any cell value → itself, or "—" when empty/absent. */
  dash(v: any): string {
    return (v ?? '').toString().trim() || '—';
  }

  /** Document column: text ref from the file, ✓ if uploaded (no ref), else "—". */
  docCell(row: any, refKey: string, docKey: string): string {
    const ref = (row?.[refKey] ?? '').toString().trim();
    if (ref) return ref;
    return row?.[docKey] ? '✓' : '—';
  }

  completudeSeverity(s: string): 'success' | 'warning' | 'secondary' {
    return s === 'COMPLET' ? 'success' : s === 'CLOTURE' ? 'secondary' : 'warning';
  }
  completudeLabel(s: string): string {
    return s === 'COMPLET' ? 'Complet' : s === 'CLOTURE' ? 'Clôturé' : 'Incomplet';
  }
  /** Historical status is now free text (Livré, En cours, Att. BC…) → shown as-is. */
  statutHistoLabel(s?: string): string {
    return (s ?? '').trim() || '—';
  }
}
