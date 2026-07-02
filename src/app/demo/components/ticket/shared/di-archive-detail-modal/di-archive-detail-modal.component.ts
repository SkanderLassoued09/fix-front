import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { PdfDropzoneComponent } from '../../magasin-di-list/pdf-dropzone/pdf-dropzone.component';
import { MutationRunner } from 'src/app/demo/service/mutation-runner.service';
import { DiArchiveService } from 'src/app/demo/service/di-archive.service';

type DocKey = 'bc' | 'bl' | 'devis' | 'facture';
interface DocSlot {
  key: DocKey;
  refKey: 'bcRef' | 'blRef' | 'devisRef' | 'factureRef';
  docType: 'BC' | 'BL' | 'DEVIS' | 'FACTURE';
  label: string;
}

/**
 * `DiArchive` detail modal — 4 document slots (BC / BL / Devis / Facture) with
 * Drive upload (reusing `app-pdf-dropzone` + `MutationRunner`, exactly like the
 * `Di` flow) and a LIVE completude badge that reflects `statutCompletude` after
 * each upload/removal (the backend derives it: 4 docs ⇒ COMPLET, else INCOMPLET;
 * CLOTURE is never overwritten).
 *
 * Standalone: `<app-di-archive-detail-modal [(visible)]="open" [diArchive]="row"
 * (changed)="refresh($event)">`. The host supplies the `<p-toast>`.
 */
@Component({
  selector: 'app-di-archive-detail-modal',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    ProgressSpinnerModule,
    TooltipModule,
    PdfDropzoneComponent,
  ],
  templateUrl: './di-archive-detail-modal.component.html',
  styleUrls: ['./di-archive-detail-modal.component.scss'],
})
export class DiArchiveDetailModalComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** Emitted whenever a document changes, so the host can refresh its list. */
  @Output() changed = new EventEmitter<any>();

  @Input() set diArchive(v: any) {
    this.archive = v ? { ...v } : null;
  }
  archive: any = null;

  /** Per-slot in-flight flag (spinner + disabled). */
  busy: Record<string, boolean> = {};
  cloturing = false;

  // Clôture is an admin/manager action (button only shown to these roles).
  private readonly role = (localStorage.getItem('role') || '').toUpperCase();
  private readonly CLOTURE_ROLES = ['ADMIN_MANAGER', 'ADMIN_TECH', 'MANAGER'];

  readonly slots: DocSlot[] = [
    { key: 'bc', refKey: 'bcRef', docType: 'BC', label: 'BC' },
    { key: 'bl', refKey: 'blRef', docType: 'BL', label: 'BL' },
    { key: 'devis', refKey: 'devisRef', docType: 'DEVIS', label: 'Devis' },
    { key: 'facture', refKey: 'factureRef', docType: 'FACTURE', label: 'Facture' },
  ];

  /** A doc counts as present when it has a text ref (from the file) OR an upload. */
  hasRef(slot: DocSlot): boolean {
    const ref = this.archive?.[slot.refKey];
    return !!(ref && String(ref).trim());
  }
  isPresent(slot: DocSlot): boolean {
    return !!this.archive?.[slot.key] || this.hasRef(slot);
  }

  constructor(
    private readonly runner: MutationRunner,
    private readonly gql: DiArchiveService,
  ) {}

  onHide(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  badge(): { label: string; cls: string; icon: string } {
    switch (this.archive?.statutCompletude) {
      case 'COMPLET':
        return { label: 'Complet', cls: 'da-badge--complet', icon: 'pi-check-circle' };
      case 'CLOTURE':
        return { label: 'Clôturé', cls: 'da-badge--cloture', icon: 'pi-lock' };
      default:
        return { label: 'Incomplet', cls: 'da-badge--incomplet', icon: 'pi-exclamation-triangle' };
    }
  }

  async onUpload(slot: DocSlot, file: File): Promise<void> {
    if (!this.archive?._id || !file) return;
    // PER-SLOT loader covering the WHOLE cycle: file read → base64 (slow for a
    // ~10 MB PDF) → mutation confirmation (DB up to date). Set BEFORE the read,
    // cleared in `finally` (no leak on error). Only THIS slot's flag flips, so
    // the other 3 slots stay fully usable.
    this.busy[slot.docType] = true;
    try {
      const base64 = await this.toBase64(file);
      const data = await this.runner.run({
        key: `diArchiveDoc:${this.archive._id}:${slot.docType}`,
        mutation: this.gql.uploadDocMutation(),
        variables: { diArchiveId: this.archive._id, docType: slot.docType, file: base64 },
        successToast: { summary: 'Document ajouté', detail: `${slot.label} uploadé sur Drive.` },
      });
      this.applyResult(data?.uploadDiArchiveDoc);
    } catch {
      // MutationRunner already toasted (or the read failed). Status untouched →
      // the slot returns to its empty, upload-ready state.
    } finally {
      this.busy[slot.docType] = false;
    }
  }

  async onRemove(slot: DocSlot): Promise<void> {
    if (!this.archive?._id) return;
    // Same per-slot loader for removal — this slot only; the others stay active.
    this.busy[slot.docType] = true;
    try {
      const data = await this.runner.run({
        key: `diArchiveDocRm:${this.archive._id}:${slot.docType}`,
        mutation: this.gql.removeDocMutation(),
        variables: { diArchiveId: this.archive._id, docType: slot.docType },
        successToast: { summary: 'Document retiré', detail: `${slot.label} délié.` },
      });
      this.applyResult(data?.removeDiArchiveDoc);
    } catch {
      // toasted; nothing changed.
    } finally {
      this.busy[slot.docType] = false;
    }
  }

  // ── Clôture (admin/manager) ──────────────────────────────────────────────
  get isCloture(): boolean {
    return this.archive?.statutCompletude === 'CLOTURE';
  }
  /** Whether the current user's role may clôture (button visibility). */
  get isClotureRole(): boolean {
    return this.CLOTURE_ROLES.includes(this.role);
  }
  /** Enabled only when the 4 docs are present (COMPLET) + right role. */
  get canCloture(): boolean {
    return (
      !!this.archive &&
      this.archive.statutCompletude === 'COMPLET' &&
      this.isClotureRole &&
      !this.cloturing
    );
  }

  async onCloture(): Promise<void> {
    if (!this.canCloture) return;
    try {
      const data = await this.runner.run({
        key: `clotureDiArchive:${this.archive._id}`,
        mutation: this.gql.clotureMutation(),
        variables: { diArchiveId: this.archive._id },
        successToast: {
          summary: 'Archive clôturée',
          detail: 'La DI est marquée « Clôturé ».',
        },
        onLoading: (l) => (this.cloturing = l),
      });
      this.applyResult(data?.clotureDiArchive);
    } catch {
      /* toasted */
    }
  }

  private applyResult(updated: any): void {
    if (!updated || !this.archive) return;
    this.archive = { ...this.archive, ...updated };
    this.changed.emit(this.archive);
  }

  private toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
