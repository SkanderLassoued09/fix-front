import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Apollo } from 'apollo-angular';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { TableModule, TableLazyLoadEvent } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputTextModule } from 'primeng/inputtext';
import { DiArchiveService } from 'src/app/demo/service/di-archive.service';
import { DiArchiveDetailModalComponent } from '../ticket/shared/di-archive-detail-modal/di-archive-detail-modal.component';
import { DiArchiveImportComponent } from '../ticket/shared/di-archive-import/di-archive-import.component';

/** The 4 « document manquant » choices (value = backend DiArchiveDocType). */
interface Option {
  label: string;
  value: string;
}

/**
 * « Archives DI » — SERVER-SIDE paginated/filtered list (~1400 rows). Two
 * combinable filter systems, both applied by the backend query:
 *   1. « Documents manquants » multi-select (Facture/BL/BC/Devis) — AND.
 *   2. Per-column filters (text for free fields, multi-select for the enums).
 * The killer combination — « manque Facture » + statut clôturé/terminé —
 * surfaces finished-but-never-invoiced work. Every criterion is cumulative.
 */
@Component({
  selector: 'app-archive-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    ToastModule,
    MultiSelectModule,
    InputTextModule,
    DiArchiveDetailModalComponent,
    DiArchiveImportComponent,
  ],
  templateUrl: './archive-list.component.html',
  styleUrls: ['./archive-list.component.scss'],
})
export class ArchiveListComponent implements OnInit, OnDestroy {
  rows: any[] = [];
  loading = false;
  totalRecords = 0;

  detailVisible = false;
  selected: any = null;

  // ── Pagination / sort state (server-side) ────────────────────────────────
  first = 0;
  limit = 12;
  sortField: string | undefined;
  sortOrder: number | undefined;

  // ── Filter state ─────────────────────────────────────────────────────────
  /** « Documents manquants » — backend DiArchiveDocType values (AND). */
  missingDocs: string[] = [];
  /** Free-text column filters. */
  text: Record<string, string> = {
    refOrigine: '',
    title: '',
    numSerie: '',
    client: '',
    arrangement: '',
    validClient: '',
  };
  /** Enumerated column filters (multi-select). */
  statutCompletude: string[] = [];
  statutHistorique: string[] = [];

  // ── Dropdown options ─────────────────────────────────────────────────────
  readonly missingDocOptions: Option[] = [
    { label: 'Facture manquante', value: 'FACTURE' },
    { label: 'BL manquant', value: 'BL' },
    { label: 'BC manquant', value: 'BC' },
    { label: 'Devis manquant', value: 'DEVIS' },
  ];
  readonly completudeOptions: Option[] = [
    { label: 'Incomplet', value: 'INCOMPLET' },
    { label: 'Complet', value: 'COMPLET' },
    { label: 'Clôturé', value: 'CLOTURE' },
  ];
  statutOptions: Option[] = [];

  private readonly textFilter$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly apollo: Apollo,
    private readonly gql: DiArchiveService,
  ) {}

  ngOnInit(): void {
    // Debounce free-text typing so we don't hit the server on every keystroke.
    this.textFilter$
      .pipe(debounceTime(350), takeUntil(this.destroy$))
      .subscribe(() => this.resetAndLoad());
    this.loadStatutOptions();
    // The <p-table [lazy]> fires (onLazyLoad) on init → first load happens there.
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Table-driven change (pagination / sort). Single entry point for the table. */
  onLazyLoad(event: TableLazyLoadEvent): void {
    this.first = event.first ?? 0;
    this.limit = event.rows ?? this.limit;
    this.sortField = (event.sortField as string) || undefined;
    this.sortOrder = event.sortOrder ?? undefined;
    this.load();
  }

  /** Fetch one page with the current filter + pagination + sort (server-side). */
  private load(): void {
    this.loading = true;
    this.apollo
      .query<any>({
        query: this.gql.diArchivesQuery(),
        variables: {
          filter: this.buildFilter(),
          page: {
            page: Math.floor(this.first / this.limit) + 1,
            limit: this.limit,
            sortField: this.sortField,
            sortOrder: this.sortOrder,
          },
        },
        fetchPolicy: 'no-cache',
      })
      .subscribe({
        next: ({ data }) => {
          this.rows = (data?.diArchives?.rows ?? []).map((r: any) => ({ ...r }));
          this.totalRecords = data?.diArchives?.totalCount ?? 0;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  /** Assemble the GraphQL filter — only non-empty criteria are sent. */
  private buildFilter(): Record<string, any> {
    const f: Record<string, any> = {};
    if (this.missingDocs.length) f['missingDocs'] = this.missingDocs;
    for (const key of Object.keys(this.text)) {
      const v = this.text[key]?.trim();
      if (v) f[key] = v;
    }
    if (this.statutCompletude.length) f['statutCompletude'] = this.statutCompletude;
    if (this.statutHistorique.length) f['statutHistorique'] = this.statutHistorique;
    return f;
  }

  private loadStatutOptions(): void {
    this.apollo
      .query<any>({
        query: this.gql.diArchiveStatutsQuery(),
        fetchPolicy: 'no-cache',
      })
      .subscribe({
        next: ({ data }) => {
          this.statutOptions = (data?.diArchiveStatuts ?? []).map((s: string) => ({
            label: s,
            value: s,
          }));
        },
        error: () => {},
      });
  }

  // ── Filter events ─────────────────────────────────────────────────────────

  /** A dropdown/multi-select changed → reset to page 1 and reload immediately. */
  onFilterChange(): void {
    this.resetAndLoad();
  }

  /** A text input changed → debounce then reset+reload. */
  onTextInput(): void {
    this.textFilter$.next();
  }

  private resetAndLoad(): void {
    this.first = 0;
    this.load();
  }

  hasActiveFilters(): boolean {
    return (
      this.missingDocs.length > 0 ||
      this.statutCompletude.length > 0 ||
      this.statutHistorique.length > 0 ||
      Object.values(this.text).some((v) => !!v?.trim())
    );
  }

  resetFilters(): void {
    this.missingDocs = [];
    this.statutCompletude = [];
    this.statutHistorique = [];
    for (const key of Object.keys(this.text)) this.text[key] = '';
    this.resetAndLoad();
  }

  // ── Row actions / display helpers (unchanged) ─────────────────────────────

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

  /** Import finished → reload the current page (a new batch may have landed). */
  reload(): void {
    this.load();
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
