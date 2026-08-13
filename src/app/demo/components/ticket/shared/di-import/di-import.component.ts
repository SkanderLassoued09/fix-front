import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';
import { PdfDropzoneComponent } from '../../magasin-di-list/pdf-dropzone/pdf-dropzone.component';
import {
  DiImportService,
  DiImportJob,
  DiImportProgress,
  ImportLigne,
  ImportReport,
  TierDecision,
} from 'src/app/demo/service/di-import.service';

/**
 * Import DI en bloc — workflow en 5 états :
 *   VÉRIFICATION (dry-run, 100% non destructif, résolution des ambiguïtés)
 *     → VALIDATION (« Valider le lot », désactivé tant qu'une ambiguïté reste)
 *     → EN COURS (job serveur, progression WebSocket filtrée par jobId)
 *     → TERMINÉ / ÉCHEC (rapport final, consultable après réouverture).
 * Aucune question utilisateur pendant l'exécution : tout est tranché avant.
 * La fermeture de l'onglet n'annule PAS le job (il vit côté serveur).
 */
type ImportPhase = 'idle' | 'verification' | 'running' | 'completed' | 'failed';
const LAST_JOB_KEY = 'di-import:lastJob';

@Component({
  selector: 'app-di-import',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    TableModule,
    ButtonModule,
    TagModule,
    ProgressSpinnerModule,
    ProgressBarModule,
    TooltipModule,
    PdfDropzoneComponent,
  ],
  templateUrl: './di-import.component.html',
  styleUrls: ['./di-import.component.scss'],
})
export class DiImportComponent implements OnDestroy {
  @Output() imported = new EventEmitter<void>();

  visible = false;
  phase: ImportPhase = 'idle';
  loading = false; // dry-run en cours
  file: File | null = null;
  fileName = '';
  report: ImportReport | null = null; // rapport dry-run

  /** Résolutions d'ambiguïté « both » (ligne → tiers choisi). */
  decisions = new Map<number, 'client' | 'company'>();
  onlyToResolve = false; // filtre « à trancher seulement »

  jobId: string | null = null;
  progress: DiImportProgress | null = null;
  job: DiImportJob | null = null; // job final (COMPLETED/FAILED)
  private startedAt = 0;
  private progressSub?: Subscription;

  readonly cols: { header: string; key: string }[] = [
    { header: 'N° DI', key: 'N° DI' },
    { header: 'Désignation', key: 'Désignation' },
    { header: 'N° Série', key: 'N° Série' },
    { header: 'Client / Société', key: 'Client' },
    { header: 'Date', key: 'Date de réception' },
    { header: 'Rangement', key: 'Rangement' },
  ];

  constructor(
    private readonly importSvc: DiImportService,
    private readonly message: MessageService,
  ) {}

  ngOnDestroy(): void {
    this.progressSub?.unsubscribe();
  }

  open(): void {
    this.reset();
    this.visible = true;
    this.tryRecover(); // reprise d'un job en cours/terminé
  }

  /** Fermeture du modal — NE PAS annuler le job serveur. */
  onHide(): void {
    this.progressSub?.unsubscribe();
  }

  private reset(): void {
    this.phase = 'idle';
    this.file = null;
    this.fileName = '';
    this.report = null;
    this.decisions = new Map();
    this.onlyToResolve = false;
    this.jobId = null;
    this.progress = null;
    this.job = null;
    this.loading = false;
    this.progressSub?.unsubscribe();
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
    this.phase = 'idle';
    this.decisions = new Map();
  }

  /** Dry-run — 100% non destructif. */
  private runPreview(): void {
    if (!this.file) return;
    this.loading = true;
    this.report = null;
    this.decisions = new Map();
    this.importSvc.preview(this.file).subscribe({
      next: (r) => {
        this.loading = false;
        this.report = r;
        this.phase = 'verification';
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

  // ---- Ambiguïtés « both » (à trancher) ------------------------------------
  isAmbiguous(l: ImportLigne): boolean {
    return (
      l.statut === 'erreur' &&
      (l.motifs ?? []).some((m) => /Client ET comme Soci/i.test(m))
    );
  }
  get ambiguousLines(): ImportLigne[] {
    return (this.report?.lignes ?? []).filter((l) => this.isAmbiguous(l));
  }
  get unresolvedCount(): number {
    return this.ambiguousLines.filter((l) => !this.decisions.has(l.ligne)).length;
  }
  decisionOf(ligne: number): 'client' | 'company' | undefined {
    return this.decisions.get(ligne);
  }
  resolve(ligne: number, kind: 'client' | 'company'): void {
    this.decisions.set(ligne, kind);
  }

  get displayedLignes(): ImportLigne[] {
    const all = this.report?.lignes ?? [];
    return this.onlyToResolve ? all.filter((l) => this.isAmbiguous(l)) : all;
  }

  /** Lignes qui SERONT importées = valides + ambiguïtés tranchées. */
  get toImportCount(): number {
    return (this.report?.valides ?? 0) + this.decisions.size;
  }

  /** « Valider le lot » actif : aucune ambiguïté non tranchée + au moins 1 à importer. */
  get canValidate(): boolean {
    return (
      this.phase === 'verification' &&
      !!this.report &&
      !this.report.enTeteInvalide &&
      this.unresolvedCount === 0 &&
      this.toImportCount > 0
    );
  }

  // ---- Validation → exécution en job --------------------------------------
  validate(): void {
    if (!this.canValidate || !this.file) return;
    this.phase = 'running';
    this.startedAt = Date.now();
    this.progress = {
      jobId: '',
      done: 0,
      total: this.toImportCount,
      currentRef: null,
      phase: 'RUNNING',
    };
    const decisions: TierDecision[] = [...this.decisions.entries()].map(
      ([ligne, kind]) => ({ ligne, kind }),
    );
    this.importSvc.execute(this.file, decisions).subscribe({
      next: (ref) => {
        if (!ref.jobId) {
          this.phase = 'verification';
          this.message.add({
            severity: 'error',
            summary: 'Fichier rejeté',
            detail: ref.report?.erreurs?.[0]?.motifs?.[0] ?? 'Aucune ligne exécutable.',
          });
          return;
        }
        this.jobId = ref.jobId;
        localStorage.setItem(LAST_JOB_KEY, ref.jobId);
        this.progress = {
          jobId: ref.jobId,
          done: 0,
          total: ref.total,
          currentRef: null,
          phase: 'RUNNING',
        };
        this.subscribeProgress(ref.jobId);
      },
      error: (e) => {
        this.phase = 'verification';
        this.message.add({
          severity: 'error',
          summary: "Échec du démarrage",
          detail: this.errMsg(e),
        });
      },
    });
  }

  private subscribeProgress(jobId: string): void {
    this.progressSub?.unsubscribe();
    this.progressSub = this.importSvc.onProgress(jobId).subscribe((p) => {
      this.progress = p;
      if (p.phase === 'COMPLETED' || p.phase === 'FAILED') {
        this.fetchFinalJob(jobId);
      }
    });
  }

  private fetchFinalJob(jobId: string): void {
    this.importSvc.getJob(jobId).subscribe({
      next: (job) => {
        this.job = job;
        if (job.status === 'COMPLETED') {
          this.phase = 'completed';
          this.imported.emit();
        } else if (job.status === 'FAILED') {
          this.phase = 'failed';
        }
      },
      error: () => {
        /* garde l'affichage de progression ; le back reste la source */
      },
    });
  }

  // ---- Reprise après réouverture/reconnexion ------------------------------
  private tryRecover(): void {
    const jid = localStorage.getItem(LAST_JOB_KEY);
    if (!jid) return;
    this.importSvc.getJob(jid).subscribe({
      next: (job) => {
        this.jobId = jid;
        if (job.status === 'RUNNING' || job.status === 'PENDING') {
          this.phase = 'running';
          this.startedAt = Date.now();
          this.progress = {
            jobId: jid,
            done: job.done,
            total: job.total,
            currentRef: job.currentRef ?? null,
            phase: job.status,
          };
          this.subscribeProgress(jid);
        } else if (job.status === 'COMPLETED') {
          this.job = job;
          this.phase = 'completed';
        } else if (job.status === 'FAILED') {
          this.job = job;
          this.phase = 'failed';
        }
      },
      error: () => localStorage.removeItem(LAST_JOB_KEY), // 403/404 → oublier
    });
  }

  /** Repartir sur un nouvel import après un job terminé. */
  restart(): void {
    localStorage.removeItem(LAST_JOB_KEY);
    this.reset();
  }

  // ---- Helpers progression -------------------------------------------------
  get pct(): number {
    const p = this.progress;
    return p && p.total ? Math.round((p.done / p.total) * 100) : 0;
  }
  get etaLabel(): string {
    const p = this.progress;
    if (!p || !p.done || !this.startedAt) return '';
    const elapsed = (Date.now() - this.startedAt) / 1000;
    const rate = p.done / elapsed;
    if (!isFinite(rate) || rate <= 0) return '';
    const remaining = Math.max(0, Math.round((p.total - p.done) / rate));
    return `~${remaining}s restant`;
  }

  // ---- Helpers rapport final ----------------------------------------------
  get finalReport(): ImportReport | undefined {
    return this.job?.report;
  }
  get crees() {
    return this.finalReport?.crees;
  }
  get elapsedLabel(): string {
    const s = this.job?.createdAt;
    const e = this.job?.updatedAt;
    if (!s || !e) return '';
    const ms = new Date(e).getTime() - new Date(s).getTime();
    if (!isFinite(ms) || ms < 0) return '';
    return `${Math.round(ms / 1000)}s`;
  }

  // ---- Helpers affichage (existants) --------------------------------------
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
