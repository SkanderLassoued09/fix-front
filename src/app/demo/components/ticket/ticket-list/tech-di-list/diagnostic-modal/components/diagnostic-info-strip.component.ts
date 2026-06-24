import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagnosticDiSummary } from '../diagnostic-modal.types';

/**
 * Horizontal info strip directly under the header — the modal's single
 * "identity glance" row: 4 cards
 *   Client/Société · Emplacement · Statut actuel · Technicien
 *
 * Each datum lives here exactly once: the DI code is shown only in the header
 * title ("Diagnostic — DI42"), so there's no "Ticket" card; the status is
 * shown only here (removed from the header) — the "modal épuré" de-duplication.
 *
 * Read-only. Renders 'N/A' when a field is empty per the strict no-fake-data
 * rule established earlier in this codebase (coordinator modal uses the
 * same fallback convention).
 */
@Component({
  selector: 'sav-diag-info-strip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sav-info-strip">
      <div class="sav-info-strip__cell">
        <span class="sav-info-strip__icon sav-info-strip__icon--cyan">
          <i class="pi pi-user"></i>
        </span>
        <div>
          <small>Client / Société</small>
          <strong>{{ clientLine || 'N/A' }}</strong>
        </div>
      </div>

      <div class="sav-info-strip__cell">
        <span class="sav-info-strip__icon sav-info-strip__icon--blue">
          <i class="pi pi-map-marker"></i>
        </span>
        <div>
          <small>Emplacement</small>
          <strong>{{ di.locationName || 'N/A' }}</strong>
        </div>
      </div>

      <div class="sav-info-strip__cell">
        <span class="sav-info-strip__icon sav-info-strip__icon--orange">
          <i class="pi pi-flag"></i>
        </span>
        <div>
          <small>Statut actuel</small>
          <strong class="sav-info-strip__status">{{ di.statusLabel || di.status || 'N/A' }}</strong>
        </div>
      </div>

      <div class="sav-info-strip__cell">
        <span class="sav-info-strip__icon sav-info-strip__icon--green">
          <i class="pi pi-id-card"></i>
        </span>
        <div>
          <small>Technicien</small>
          <strong>{{ di.technicianName || 'N/A' }}</strong>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host { display: block; }
      .sav-info-strip {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.85rem;
        padding: 1.1rem 1.75rem;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }
      .sav-info-strip__cell {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        padding: 0.9rem 1rem;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        min-width: 0;
      }
      .sav-info-strip__icon {
        display: inline-grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border-radius: 10px;
        flex-shrink: 0;
      }
      .sav-info-strip__icon i { font-size: 1.05rem; }
      .sav-info-strip__icon--blue { background: rgba(59, 130, 246, 0.12); color: #2563eb; }
      .sav-info-strip__icon--cyan { background: rgba(6, 182, 212, 0.12); color: #0891b2; }
      .sav-info-strip__icon--orange { background: rgba(249, 115, 22, 0.12); color: #ea580c; }
      .sav-info-strip__icon--green { background: rgba(34, 197, 94, 0.12); color: #16a34a; }
      .sav-info-strip__cell > div { min-width: 0; }
      .sav-info-strip__cell small {
        display: block;
        font-size: 0.78rem;
        color: #64748b;
        font-weight: 500;
        margin-bottom: 0.18rem;
      }
      .sav-info-strip__cell strong {
        display: block;
        font-size: 0.95rem;
        font-weight: 650;
        color: #0f172a;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.25;
      }
      .sav-info-strip__status {
        color: #dc2626 !important;
        text-transform: uppercase;
        font-size: 0.85rem !important;
        font-weight: 700 !important;
        letter-spacing: 0.04em;
      }
    `,
  ],
})
export class DiagnosticInfoStripComponent {
  @Input({ required: true }) di!: DiagnosticDiSummary;

  /** Pre-composed "Client / Société" line, computed by the parent. */
  @Input() clientLine: string = '';
}
