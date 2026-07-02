import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { PdfDropzoneComponent } from '../../magasin-di-list/pdf-dropzone/pdf-dropzone.component';
import {
  DiArchiveImportService,
  ImportLigne,
  ImportReport,
} from 'src/app/demo/service/di-archive-import.service';

/**
 * "Importer des archives" — modal cloned from `app-di-import`, targeting the
 * `DiArchive` importer. Flow: choose .xlsx → dry-run preview → "Importer"
 * persists the valid rows → emits `imported` so the host refreshes its list.
 *
 * Opened by the host: `<app-di-archive-import #imp (imported)="load()">` + a
 * button `(click)="imp.open()"`. Reuses the DI-import styles.
 */
@Component({
  selector: 'app-di-archive-import',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    TableModule,
    ButtonModule,
    TagModule,
    ProgressSpinnerModule,
    TooltipModule,
    PdfDropzoneComponent,
  ],
  templateUrl: './di-archive-import.component.html',
  styleUrls: ['../di-import/di-import.component.scss'],
})
export class DiArchiveImportComponent {
  @Output() imported = new EventEmitter<void>();

  visible = false;
  loading = false;
  importing = false;
  file: File | null = null;
  fileName = '';
  report: ImportReport | null = null;

  // Preview columns: { header → key in `valeurs` } — the archive columns.
  readonly cols: { header: string; key: string }[] = [
    { header: 'N° DI', key: 'N° DI' },
    { header: 'Désignation', key: 'Désignation' },
    { header: 'N° Série', key: 'N° Série' },
    { header: 'Client', key: 'Client' },
    { header: 'Statut', key: 'Statut' },
    { header: 'Devis', key: 'Devis' },
    { header: 'BC', key: 'BC' },
    { header: 'BL', key: 'BL' },
    { header: 'Valid. Cl.', key: 'Valid. Client' },
    { header: 'Facture', key: 'Facture' },
    { header: 'Rangement', key: 'Rangement' },
  ];

  constructor(
    private readonly importSvc: DiArchiveImportService,
    private readonly message: MessageService,
  ) {}

  open(): void {
    this.reset();
    this.visible = true;
  }

  onHide(): void {
    this.reset();
  }

  private reset(): void {
    this.file = null;
    this.fileName = '';
    this.report = null;
    this.loading = false;
    this.importing = false;
  }

  downloadTemplate(): void {
    this.importSvc.downloadTemplate();
  }

  onFileSelected(file: File): void {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      this.message.add({
        severity: 'error',
        summary: 'Format invalide',
        detail: 'Un fichier .xlsx est attendu.',
      });
      return;
    }
    this.file = file;
    this.fileName = file.name;
    this.runPreview();
  }

  onFileRemoved(): void {
    this.file = null;
    this.fileName = '';
    this.report = null;
  }

  private runPreview(): void {
    if (!this.file) return;
    this.loading = true;
    this.report = null;
    this.importSvc.preview(this.file).subscribe({
      next: (r) => {
        this.loading = false;
        this.report = r;
        if (r.enTeteInvalide) {
          this.message.add({
            severity: 'error',
            summary: 'En-tête invalide',
            detail:
              r.erreurs?.[0]?.motifs?.[0] ??
              'Colonne obligatoire manquante (Désignation).',
          });
        }
      },
      error: (e) => {
        this.loading = false;
        this.message.add({
          severity: 'error',
          summary: "Échec de l'aperçu",
          detail: this.errMsg(e),
        });
      },
    });
  }

  confirmImport(): void {
    if (!this.file || !this.canImport) return;
    this.importing = true;
    this.importSvc.import(this.file).subscribe({
      next: (r) => {
        this.importing = false;
        const c = r.crees;
        this.message.add({
          severity: 'success',
          summary: 'Import terminé',
          detail: `${c?.archives ?? 0} archives importées, ${c?.ignorees ?? 0} ignorées`,
        });
        this.imported.emit();
        this.visible = false;
        this.reset();
      },
      error: (e) => {
        this.importing = false;
        this.message.add({
          severity: 'error',
          summary: "Échec de l'import",
          detail: this.errMsg(e),
        });
      },
    });
  }

  get canImport(): boolean {
    return (
      !!this.report &&
      !this.report.enTeteInvalide &&
      this.report.valides > 0 &&
      !this.importing
    );
  }

  get warningsCount(): number {
    return (
      this.report?.lignes?.filter((l) => l.statut === 'avertissement').length ??
      0
    );
  }

  rowClass(l: ImportLigne): string {
    return `di-imp-row di-imp-row--${l.statut}`;
  }

  statutSeverity(s: string): 'success' | 'warning' | 'danger' {
    return s === 'erreur' ? 'danger' : s === 'avertissement' ? 'warning' : 'success';
  }

  statutLabel(s: string): string {
    return s === 'erreur' ? 'Erreur' : s === 'avertissement' ? 'Avert.' : 'Valide';
  }

  private errMsg(e: any): string {
    return e?.error?.message ?? e?.message ?? 'Erreur réseau';
  }
}
