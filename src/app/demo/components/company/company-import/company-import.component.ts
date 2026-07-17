import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { PdfDropzoneComponent } from '../../ticket/magasin-di-list/pdf-dropzone/pdf-dropzone.component';
import {
  CompanyImportService,
  ImportLigne,
  ImportReport,
} from 'src/app/demo/service/company-import.service';

/**
 * « Importer des sociétés » — modal cloné de l'import DiArchive.
 * Flux : choisir .xlsx → APERÇU (dry-run) montrant à créer / à mettre à jour /
 * erreurs par ligne → « Importer » écrit → `imported` rafraîchit la liste hôte.
 * Ouvert par l'hôte : `<app-company-import #imp (imported)="loadData()">`.
 */
@Component({
  selector: 'app-company-import',
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
  templateUrl: './company-import.component.html',
  styleUrls: ['../../ticket/shared/di-import/di-import.component.scss'],
})
export class CompanyImportComponent {
  @Output() imported = new EventEmitter<void>();

  visible = false;
  loading = false;
  importing = false;
  file: File | null = null;
  fileName = '';
  report: ImportReport | null = null;

  /** Colonnes-clés de l'aperçu (le fichier en compte 22 ; on montre l'essentiel). */
  readonly cols: { header: string; key: string }[] = [
    { header: 'Raison sociale', key: 'Raison sociale' },
    { header: 'Nom', key: 'Nom' },
    { header: 'Mat. fiscale', key: 'Matricule fiscale' },
    { header: 'E-mail', key: 'E-mail' },
    { header: 'Téléphone', key: 'Téléphone' },
  ];

  constructor(
    private readonly importSvc: CompanyImportService,
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
              'Colonne obligatoire manquante (Raison sociale).',
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
          detail: `${c?.crees ?? 0} créée(s), ${c?.majs ?? 0} mise(s) à jour, ${c?.erreurs ?? 0} échec(s)`,
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
      this.report?.lignes?.filter((l) => l.statut === 'avertissement').length ?? 0
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

  actionLabel(a: LigneActionLike): string {
    return a === 'create' ? 'Créer' : a === 'update' ? 'Màj' : '—';
  }
  actionSeverity(a: LigneActionLike): 'success' | 'info' | 'secondary' {
    return a === 'create' ? 'success' : a === 'update' ? 'info' : 'secondary';
  }

  private errMsg(e: any): string {
    return e?.error?.message ?? e?.message ?? 'Erreur réseau';
  }
}

type LigneActionLike = 'create' | 'update' | null;
