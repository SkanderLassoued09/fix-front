import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagnosticDiSummary } from '../../../tech-di-list/diagnostic-modal/diagnostic-modal.types';
import { DiImageComponent } from 'src/app/demo/components/ticket/shared/di-image/di-image.component';

/**
 * Step 1 · Informations générales — read-only repair context.
 * Tech reviews the ticket before starting the repair work.
 */
@Component({
  selector: 'sav-repair-info-step',
  standalone: true,
  imports: [CommonModule, DiImageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step">
      <header class="step__head">
        <span class="step__num">1</span>
        <div>
          <h3>Informations générales</h3>
          <p>Revoyez le contexte du ticket avant de démarrer la réparation.</p>
        </div>
      </header>

      <div class="step__grid">
        <!-- Problem photo first: the tech should see what's wrong before
             reading the ticket metadata. Full-width, at the very top. -->
        <div class="field field--full" *ngIf="di.imageUrl || di.imageViewUrl">
          <app-di-image
            [imageUrl]="di.imageUrl || ''"
            [viewUrl]="di.imageViewUrl || ''"
          ></app-di-image>
        </div>
        <div class="field">
          <label>Titre du ticket</label>
          <div class="field__value">{{ di.title || 'N/A' }}</div>
        </div>
        <div class="field">
          <label>Statut actuel</label>
          <div class="field__value">{{ di.statusLabel || di.status || 'N/A' }}</div>
        </div>
        <div class="field">
          <label>Client</label>
          <div class="field__value">{{ di.clientName || 'N/A' }}</div>
        </div>
        <div class="field">
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
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .step { padding: 1.75rem 2rem; }
      .step__head { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.75rem; }
      .step__num {
        display: inline-grid;
        place-items: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #22c55e;
        color: #ffffff;
        font-weight: 700;
        font-size: 1.2rem;
        flex-shrink: 0;
      }
      .step__head h3 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.015em;
        line-height: 1.2;
      }
      .step__head p {
        margin: 0.3rem 0 0;
        font-size: 0.95rem;
        color: #64748b;
        line-height: 1.35;
      }
      .step__grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1.1rem;
      }
      .field--full { grid-column: 1 / -1; }
      .field label {
        display: block;
        font-size: 0.85rem;
        font-weight: 650;
        color: #64748b;
        margin-bottom: 0.4rem;
      }
      .field__value {
        padding: 0.85rem 1rem;
        border: 1px solid #e2e8f0;
        border-radius: 9px;
        background: #f8fafc;
        font-size: 0.95rem;
        color: #0f172a;
        line-height: 1.4;
      }
      .field__value--multi { white-space: pre-wrap; }
    `,
  ],
})
export class RepairInfoStepComponent {
  @Input({ required: true }) di!: DiagnosticDiSummary;
}
