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
        <span class="step__num">2</span>
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

      <section class="block block--inline">
        <span class="block__label block__label--inline">Catégorie</span>
        <strong [class.faded]="!categoryLabel">{{ categoryLabel || 'Non définie' }}</strong>
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
        <!-- Le bouton se grisait sans rien dire : la raison évite au technicien
             de chercher quel champ manque. -->
        <span *ngIf="blockedReason" class="cta__hint">
          <i class="pi pi-exclamation-triangle"></i>{{ blockedReason }}
        </span>
        <button
          type="button"
          class="cta__btn"
          [disabled]="primaryDisabled"
          [attr.title]="blockedReason"
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
        background: var(--fx-bg-surface-2);
        color: var(--fx-text-muted);
        font-weight: 700;
        font-size: 1.2rem;
        flex-shrink: 0;
      }
      .step__head h3 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 700;
        color: var(--fx-text);
        letter-spacing: -0.015em;
        line-height: 1.2;
      }
      .step__head p {
        margin: 0.3rem 0 0;
        font-size: 0.95rem;
        color: var(--fx-text-muted);
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
        border: 1px solid var(--fx-border);
        border-radius: 10px;
        background: var(--fx-bg-surface);
        min-width: 0;
      }
      .card__label {
        font-size: 0.7rem;
        font-weight: 700;
        color: var(--fx-text-muted);
        letter-spacing: 0.08em;
      }
      .card strong {
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--fx-text);
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .card span {
        font-size: 0.88rem;
        color: var(--fx-text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .card--ticket strong { color: var(--fx-blue-soft-fg); }
      .card--status strong { color: var(--fx-orange-text); }

      .block {
        padding: 1.1rem 1.15rem;
        border: 1px solid var(--fx-border);
        border-radius: 10px;
        background: var(--fx-bg-card);
        margin-bottom: 1.25rem;
      }
      .block__label {
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--fx-text-muted);
        letter-spacing: 0.08em;
        margin-bottom: 0.65rem;
      }
      .block__body {
        margin: 0;
        font-size: 0.95rem;
        color: var(--fx-text);
        line-height: 1.5;
        white-space: pre-wrap;
      }
      .block__body--faded { color: var(--fx-text-subtle); font-style: italic; }
      .block__sub {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 0.85rem;
        padding-top: 0.85rem;
        border-top: 1px dashed var(--fx-border);
        font-size: 0.9rem;
        color: var(--fx-text-muted);
      }
      .block__sub strong { color: var(--fx-text); font-weight: 650; }
      .block--inline {
        display: flex;
        align-items: center;
        gap: 0.65rem;
      }
      .block__label--inline { margin-bottom: 0; }
      .block--inline strong { font-size: 0.95rem; color: var(--fx-text); font-weight: 650; }
      .faded { color: var(--fx-text-subtle) !important; font-style: italic; }

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
        background: var(--fx-bg-surface);
        border: 1px solid var(--fx-border);
        border-radius: 8px;
        font-size: 0.92rem;
      }
      .parts strong { color: var(--fx-text); font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .parts__ref {
        color: var(--fx-text-muted);
        font-family: 'JetBrains Mono', 'Menlo', monospace;
        font-size: 0.85rem;
      }
      .parts__qty { color: var(--fx-blue-soft-fg); font-weight: 700; }

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
        border: 1px solid var(--fx-border);
        border-radius: 10px;
        background: var(--fx-bg-surface);
      }
      .badge i { font-size: 1.4rem; color: var(--fx-text-muted); }
      .badge small { display: block; font-size: 0.78rem; color: var(--fx-text-muted); }
      .badge strong { display: block; font-size: 1rem; font-weight: 700; color: var(--fx-text); margin-top: 0.15rem; }
      .badge--yes { background: rgba(34, 197, 94, 0.1); border-color: rgba(34, 197, 94, 0.35); }
      .badge--yes i, .badge--yes strong { color: var(--fx-green-soft-fg); }
      .badge--no { background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.3); }
      .badge--no i, .badge--no strong { color: var(--fx-red-soft-fg); }
      .badge--undef strong { color: var(--fx-text-subtle); font-style: italic; }

      .cta {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.85rem;
        flex-wrap: wrap;
      }
      .cta__hint {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.85rem;
        color: var(--fx-amber-text);
      }
      .cta__btn {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        padding: 0.85rem 1.5rem;
        border-radius: 10px;
        border: 1px solid var(--fx-green);
        background: var(--fx-green);
        color: var(--fx-text-on-accent);
        font-size: 1rem;
        font-weight: 650;
        cursor: pointer;
        transition: background 120ms ease;
      }
      .cta__btn:hover:not(:disabled) { background: var(--fx-green); }
      .cta__btn:disabled { opacity: 0.45; cursor: not-allowed; }

      @media (max-width: 880px) {
        .grid, .badges { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class RepairSummaryStepComponent {
  @Input({ required: true }) di!: DiagnosticDiSummary;
  @Input() categoryLabel: string = '';
  /** Première condition manquante pour clôturer, ou null si tout est réuni. */
  @Input() blockedReason: string | null = null;
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
