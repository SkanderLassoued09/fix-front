import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagnosticDiSummary } from '../diagnostic-modal.types';

/**
 * Step 1 · Informations générales — read-only DI context.
 * Tech reviews what they're about to diagnose before filling the form.
 */
@Component({
  selector: 'sav-diag-info-step',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step">
      <header class="step__head">
        <span class="step__num">1</span>
        <div>
          <h3>Informations générales</h3>
          <p>Revoyez le contexte du ticket avant de démarrer le diagnostic.</p>
        </div>
      </header>

      <div class="step__grid">
        <div class="field">
          <label>Titre du ticket</label>
          <div class="field__value">{{ di.title || 'N/A' }}</div>
        </div>
        <div class="field">
          <label>Statut actuel</label>
          <div class="field__value">{{ di.statusLabel || di.status || 'N/A' }}</div>
        </div>
        <!-- Show the relevant entity only: a company-DI has no client and a
             client-DI has no company, so rendering both always left one as
             "N/A". Mirror the sidebar's entityType rule — company → Société,
             client → Client. (Fallback to the value when entityType is unset
             so real data is never hidden.) -->
        <div
          class="field"
          *ngIf="di.entityType === 'client' || (!di.entityType && di.clientName)"
        >
          <label>Client</label>
          <div class="field__value">{{ di.clientName || 'N/A' }}</div>
        </div>
        <div
          class="field"
          *ngIf="di.entityType === 'company' || (!di.entityType && di.companyName)"
        >
          <label>Société</label>
          <div class="field__value">{{ di.companyName || 'N/A' }}</div>
        </div>
        <div class="field field--full">
          <label>Description initiale</label>
          <div class="field__value field__value--multi">
            {{ di.description || 'Aucune description ajoutée' }}
          </div>
        </div>
        <div class="field field--full" *ngIf="di.remarqueManager">
          <label>Remarque administration</label>
          <div class="field__value field__value--multi">{{ di.remarqueManager }}</div>
        </div>
        <!-- Previous-cycle remarks — only show on a retour so the tech sees
             what the previous diag/repair noted. Hidden on the original
             cycle to keep the step focused on creation context. -->
        <div
          class="field field--full"
          *ngIf="di.remarqueTechDiagnostic"
        >
          <label>Remarque tech diagnostique (précédente)</label>
          <div class="field__value field__value--multi">
            {{ di.remarqueTechDiagnostic }}
          </div>
        </div>
        <div
          class="field field--full"
          *ngIf="di.remarqueTechReparation"
        >
          <label>Remarque tech réparation (précédente)</label>
          <div class="field__value field__value--multi">
            {{ di.remarqueTechReparation }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .step { padding: 1.25rem 1.5rem; }
      .step__head { display: flex; align-items: flex-start; gap: 0.7rem; margin-bottom: 1.25rem; }
      .step__num {
        display: inline-grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #22c55e;
        color: #ffffff;
        font-weight: 700;
        font-size: 0.92rem;
        flex-shrink: 0;
      }
      .step__head h3 { margin: 0; font-size: 1rem; font-weight: 700; color: #0f172a; }
      .step__head p { margin: 0.15rem 0 0; font-size: 0.82rem; color: #64748b; }
      .step__grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.85rem;
      }
      .field--full { grid-column: 1 / -1; }
      .field label {
        display: block;
        font-size: 0.72rem;
        font-weight: 650;
        color: #64748b;
        margin-bottom: 0.25rem;
      }
      .field__value {
        padding: 0.55rem 0.7rem;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #f8fafc;
        font-size: 0.85rem;
        color: #0f172a;
      }
      .field__value--multi { line-height: 1.5; white-space: pre-wrap; }
    `,
  ],
})
export class DiagnosticInfoStepComponent {
  @Input({ required: true }) di!: DiagnosticDiSummary;
}
