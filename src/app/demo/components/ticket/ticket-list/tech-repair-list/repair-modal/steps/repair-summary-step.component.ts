import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagnosticDiSummary } from '../../../tech-di-list/diagnostic-modal/diagnostic-modal.types';
import { RepairBadgeValue, RepairPartEntry } from '../repair-modal.types';

/**
 * Step 5 · Résumé — three info sections (TICKET / CLIENT / STATUT),
 * the plan + category recap, two yes/no badges (Réparation réussie,
 * Tests validés), and the "Fin réparation" CTA.
 */
@Component({
  selector: 'sav-repair-summary-step',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step">
      <header class="step__head">
        <span class="step__num">5</span>
        <div>
          <h3>Résumé de la réparation</h3>
          <p>Revoyez les informations avant de clôturer le ticket.</p>
        </div>
      </header>

      <div class="grid">
        <section class="card card--ticket">
          <div class="card__label">TICKET</div>
          <strong>{{ di._idnum || 'N/A' }}</strong>
          <span>{{ di.title || 'Sans titre' }}</span>
        </section>
        <section class="card card--client">
          <div class="card__label">CLIENT</div>
          <strong>{{ di.clientName || 'N/A' }}</strong>
          <span>{{ di.companyName || di.locationName || 'N/A' }}</span>
        </section>
        <section class="card card--status">
          <div class="card__label">STATUT</div>
          <strong>{{ di.statusLabel || di.status || 'N/A' }}</strong>
          <span>{{ di.technicianName || 'N/A' }}</span>
        </section>
      </div>

      <section class="block">
        <div class="block__label">PLAN D'INTERVENTION</div>
        <p class="block__body" *ngIf="repairPlan; else noPlan">{{ repairPlan }}</p>
        <ng-template #noPlan>
          <p class="block__body block__body--faded">Aucun plan renseigné</p>
        </ng-template>
        <div class="block__sub">
          <span>Catégorie</span>
          <strong [class.faded]="!categoryLabel">{{ categoryLabel || 'Non définie' }}</strong>
        </div>
      </section>

      <section class="block" *ngIf="parts.length">
        <div class="block__label">PIÈCES UTILISÉES ({{ parts.length }})</div>
        <ul class="parts">
          <li *ngFor="let p of parts; trackBy: trackByName">
            <strong>{{ p.nameComposant }}</strong>
            <span class="parts__ref">{{ p.reference || '—' }}</span>
            <span class="parts__qty">×{{ p.quantity }}</span>
          </li>
        </ul>
      </section>

      <section class="badges">
        <div class="badge" [ngClass]="badgeClass(repairSuccess)">
          <i class="pi pi-verified"></i>
          <div>
            <small>Réparation réussie</small>
            <strong>{{ repairSuccess }}</strong>
          </div>
        </div>
        <div class="badge" [ngClass]="badgeClass(testsValidated)">
          <i class="pi pi-check-circle"></i>
          <div>
            <small>Tests validés</small>
            <strong>{{ testsValidated }}</strong>
          </div>
        </div>
      </section>

      <footer class="cta">
        <button
          type="button"
          class="cta__btn"
          [disabled]="primaryDisabled"
          (click)="finishRepair.emit()"
        >
          <i class="pi pi-check"></i>
          Fin réparation
        </button>
      </footer>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .step { padding: 1.75rem 2rem; }
      .step__head { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
      .step__num {
        display: inline-grid;
        place-items: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #e2e8f0;
        color: #64748b;
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

      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.85rem;
        margin-bottom: 1.25rem;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        padding: 1rem 1.05rem;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        background: #f8fafc;
        min-width: 0;
      }
      .card__label {
        font-size: 0.7rem;
        font-weight: 700;
        color: #64748b;
        letter-spacing: 0.08em;
      }
      .card strong {
        font-size: 1.05rem;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .card span {
        font-size: 0.88rem;
        color: #475569;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .card--ticket strong { color: #1d4ed8; }
      .card--status strong { color: #ea580c; }

      .block {
        padding: 1.1rem 1.15rem;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        background: #ffffff;
        margin-bottom: 1.25rem;
      }
      .block__label {
        font-size: 0.72rem;
        font-weight: 700;
        color: #64748b;
        letter-spacing: 0.08em;
        margin-bottom: 0.65rem;
      }
      .block__body {
        margin: 0;
        font-size: 0.95rem;
        color: #0f172a;
        line-height: 1.5;
        white-space: pre-wrap;
      }
      .block__body--faded { color: #94a3b8; font-style: italic; }
      .block__sub {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.85rem;
        padding-top: 0.85rem;
        border-top: 1px dashed #e2e8f0;
        font-size: 0.9rem;
        color: #64748b;
      }
      .block__sub strong { color: #0f172a; font-weight: 650; }
      .faded { color: #94a3b8 !important; font-style: italic; }

      .parts {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
      }
      .parts li {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        gap: 0.85rem;
        align-items: center;
        padding: 0.65rem 0.85rem;
        background: #f8fafc;
        border: 1px solid #edf2f7;
        border-radius: 8px;
        font-size: 0.92rem;
      }
      .parts strong { color: #0f172a; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .parts__ref {
        color: #475569;
        font-family: 'JetBrains Mono', 'Menlo', monospace;
        font-size: 0.85rem;
      }
      .parts__qty { color: #1d4ed8; font-weight: 700; }

      .badges {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.85rem;
        margin-bottom: 1.5rem;
      }
      .badge {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        padding: 1rem 1.05rem;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        background: #f8fafc;
      }
      .badge i { font-size: 1.4rem; color: #64748b; }
      .badge small { display: block; font-size: 0.78rem; color: #64748b; }
      .badge strong { display: block; font-size: 1rem; font-weight: 700; color: #0f172a; margin-top: 0.15rem; }
      .badge--yes { background: rgba(34, 197, 94, 0.1); border-color: rgba(34, 197, 94, 0.35); }
      .badge--yes i, .badge--yes strong { color: #15803d; }
      .badge--no { background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.3); }
      .badge--no i, .badge--no strong { color: #b91c1c; }
      .badge--undef strong { color: #94a3b8; font-style: italic; }

      .cta { display: flex; justify-content: flex-end; }
      .cta__btn {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.85rem 1.5rem;
        border-radius: 10px;
        border: 1px solid #15803d;
        background: #22c55e;
        color: #ffffff;
        font-size: 1rem;
        font-weight: 650;
        cursor: pointer;
        transition: background 120ms ease;
      }
      .cta__btn:hover:not(:disabled) { background: #16a34a; }
      .cta__btn:disabled { opacity: 0.45; cursor: not-allowed; }

      @media (max-width: 880px) {
        .grid, .badges { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class RepairSummaryStepComponent {
  @Input({ required: true }) di!: DiagnosticDiSummary;
  @Input() repairPlan: string = '';
  @Input() categoryLabel: string = '';
  @Input() parts: readonly RepairPartEntry[] = [];
  @Input() repairSuccess: RepairBadgeValue = 'Non défini';
  @Input() testsValidated: RepairBadgeValue = 'Non défini';
  @Input() primaryDisabled: boolean = true;

  @Output() finishRepair = new EventEmitter<void>();

  badgeClass(v: RepairBadgeValue): string {
    if (v === 'Oui') return 'badge--yes';
    if (v === 'Non') return 'badge--no';
    return 'badge--undef';
  }

  trackByName(_: number, p: RepairPartEntry): string {
    return p.nameComposant;
  }
}
