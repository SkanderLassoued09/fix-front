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
  DiImportService,
  ImportLigne,
  ImportReport,
} from 'src/app/demo/service/di-import.service';

/**
 * "Importer des DI" — a self-contained trigger + modal.
 *
 * Flow: choose .xlsx → automatic dry-run preview (colored table: green=valide,
 * amber=avertissement, red=erreur) → "Importer" persists the valid rows
 * (dryRun=false). Emits `imported` so the host refreshes its DI list.
 *
 * Standalone: drop `<app-di-import (imported)="loadData()">` anywhere. The host
 * supplies the `<p-toast>` (this component only pushes messages).
 */
@Component({
  selector: 'app-di-import',
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
  templateUrl: './di-import.component.html',
  styleUrls: ['./di-import.component.scss'],
})
export class DiImportComponent {
  @Output() imported = new EventEmitter<void>();

  visible = false;
  loading = false; // dry-run in flight
  importing = false; // real import in flight
  file: File | null = null;
  fileName = '';
  report: ImportReport | null = null;

  // Preview columns: { Excel label → key in `valeurs` }.
  readonly cols: { header: string; key: string }[] = [
    { header: 'N° DI', key: 'N° DI' },
    { header: 'Désignation', key: 'Désignation' },
    { header: 'N° Série', key: 'N° Série' },
    { header: 'Client', key: 'Client' },
    { header: 'Date', key: 'Date de réception' },
    { header: 'Rangement', key: 'Rangement' },
  ];

  constructor(
    private readonly importSvc: DiImportService,
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

  /** app-pdf-dropzone emitted a (size-validated) file → run the dry-run preview. */
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

  /** Dropzone cleared → drop the file + any preview. */
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
              'Colonnes obligatoires manquantes (N° DI, Désignation, N° Série, Client).',
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
          detail: `${c?.dis ?? 0} DI créées, ${c?.ignorees ?? 0} ignorées, ${
            c?.clients ?? 0
          } clients auto-créés`,
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
    return this.report?.lignes?.filter((l) => l.statut === 'avertissement')
      .length ?? 0;
  }

  rowClass(l: ImportLigne): string {
    return `di-imp-row di-imp-row--${l.statut}`;
  }

  statutSeverity(s: string): 'success' | 'warning' | 'danger' {
    return s === 'erreur' ? 'danger' : s === 'avertissement' ? 'warning' : 'success';
  }

  statutLabel(s: string): string {
    return s === 'erreur'
      ? 'Erreur'
      : s === 'avertissement'
      ? 'Avert.'
      : 'Valide';
  }

  private errMsg(e: any): string {
    return e?.error?.message ?? e?.message ?? 'Erreur réseau';
  }
}
