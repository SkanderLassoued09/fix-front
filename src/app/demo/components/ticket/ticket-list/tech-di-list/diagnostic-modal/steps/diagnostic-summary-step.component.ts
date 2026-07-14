import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ComposantEntry,
  DiagnosticDiSummary,
} from '../diagnostic-modal.types';

/**
 * Step 5 · Résumé — final review + the submit-now actions.
 * The parent decides which CTA shows (normal finish vs retour finish vs
 * retour-send-finish) based on `ignoreCount` + the disabled flags.
 */
@Component({
  selector: 'sav-diag-summary-step',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step">
      <header class="step__head">
        <span class="step__num">5</span>
        <div>
          <h3>Résumé</h3>
          <p>Vérifiez le diagnostic avant de le finaliser.</p>
        </div>
      </header>

      <section class="card">
        <div class="card__row">
          <div>
            <small>Ticket</small>
            <strong>{{ di._idnum || 'N/A' }}</strong>
          </div>
          <div>
            <small>Client</small>
            <strong>{{ di.clientName || 'N/A' }}</strong>
          </div>
          <div>
            <small>Statut</small>
            <strong>{{ di.statusLabel || di.status || 'N/A' }}</strong>
          </div>
        </div>

        <div class="card__row card__row--cols">
          <div>
            <small>Description</small>
            <p>{{ description || 'Aucune description ajoutée.' }}</p>
          </div>
          <div>
            <small>Catégorie</small>
            <p>{{ categoryLabel || 'N/A' }}</p>
          </div>
        </div>

        <div class="card__row card__row--cols">
          <div>
            <small>Pièce réparable</small>
            <p>
              <span class="pill" [ngClass]="reparableTone">{{ reparableLabel }}</span>
            </p>
          </div>
          <div>
            <small>Contient PDR</small>
            <p>
              <span class="pill" [ngClass]="pdrTone">{{ pdrLabel }}</span>
            </p>
          </div>
        </div>
      </section>

      <section class="card" *ngIf="composants.length">
        <header class="card__title">Composants ({{ composants.length }})</header>
        <ul class="comp-list">
          <li *ngFor="let c of composants; trackBy: trackByName">
            <span>{{ c.nameComposant }}</span>
            <strong>× {{ c.quantity }}</strong>
          </li>
        </ul>
      </section>

      <div class="actions">
        <button
          *ngIf="isRetour"
          type="button"
          class="btn btn--outline"
          [disabled]="retourSendDisabled"
          (click)="sendToFinishRetour.emit()"
        >
          Envoyer vers finir
        </button>
        <button
          *ngIf="isRetour"
          type="button"
          class="btn btn--primary"
          [disabled]="primaryDisabled"
          (click)="finishRetour.emit()"
        >
          <i class="pi pi-check"></i>
          Fin diagnostique retour
        </button>
        <button
          *ngIf="!isRetour && reparableLabel !== 'Non'"
          type="button"
          class="btn btn--primary"
          [disabled]="primaryDisabled || reparableLabel === 'Non'"
          (click)="finishDiag.emit()"
        >
          <i class="pi pi-check"></i>
          Finir le diagnostic
        </button>
        <!-- Non-réparable shortcut: when the tech marks the DI as not
             repairable in step 4, the standard "Finir" button is hidden and
             replaced by this action. It skips the Composants + Magasin steps
             and routes to tarification: the backend bills the diagnostic
             (DIAGNOSTIC → PENDING2) so the admin can price it and, if needed,
             use « Renvoyer au diagnostic ». (A non-repairable RETOUR closes
             directly to FINISHED instead — handled server-side.) -->
        <button
          *ngIf="!isRetour && reparableLabel === 'Non'"
          type="button"
          class="btn btn--danger"
          [disabled]="notReparableDisabled"
          (click)="finishDiagNotReparable.emit()"
        >
          <i class="pi pi-times-circle"></i>
          Terminer (non réparable)
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .step { padding: 1.25rem 1.5rem; }
      .step__head { display: flex; align-items: flex-start; gap: 0.7rem; margin-bottom: 1.1rem; }
      .step__num {
        display: inline-grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #e2e8f0;
        color: #64748b;
        font-weight: 700;
        font-size: 0.92rem;
        flex-shrink: 0;
      }
      .step__head h3 { margin: 0; font-size: 1rem; font-weight: 700; color: #0f172a; }
      .step__head p { margin: 0.15rem 0 0; font-size: 0.82rem; color: #64748b; }

      .card {
        margin-bottom: 0.9rem;
        padding: 1rem 1.1rem;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #ffffff;
      }
      .card__title {
        font-size: 0.8rem;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 0.5rem;
      }
      .card__row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
        padding-bottom: 0.75rem;
        margin-bottom: 0.75rem;
        border-bottom: 1px dashed #e2e8f0;
      }
      .card__row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
      .card__row--cols { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .card__row small {
        display: block;
        font-size: 0.66rem;
        font-weight: 650;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .card__row strong {
        display: block;
        margin-top: 0.18rem;
        font-size: 0.86rem;
        font-weight: 650;
        color: #0f172a;
      }
      .card__row p {
        margin: 0.18rem 0 0;
        font-size: 0.82rem;
        color: #334155;
        line-height: 1.45;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .pill.tone-yes { background: rgba(34, 197, 94, 0.14); color: #15803d; }
      .pill.tone-no { background: rgba(239, 68, 68, 0.12); color: #b91c1c; }
      .pill.tone-neutral { background: #f1f5f9; color: #64748b; }

      .comp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
      .comp-list li {
        display: flex;
        justify-content: space-between;
        padding: 0.45rem 0.6rem;
        border: 1px solid #f1f5f9;
        border-radius: 6px;
        font-size: 0.8rem;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }
      .btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.55rem 1rem;
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 650;
        cursor: pointer;
        border: 1px solid transparent;
      }
      .btn--primary { background: #3b82f6; color: #ffffff; border-color: #2563eb; }
      .btn--primary:hover:not(:disabled) { background: #2563eb; }
      .btn--outline {
        background: #ffffff;
        color: #0f172a;
        border-color: #e2e8f0;
      }
      .btn--outline:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; }
      .btn--danger {
        background: #dc2626;
        color: #ffffff;
        border-color: #dc2626;
      }
      .btn--danger:hover:not(:disabled) { background: #b91c1c; border-color: #b91c1c; }
      .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    `,
  ],
})
export class DiagnosticSummaryStepComponent {
  @Input({ required: true }) di!: DiagnosticDiSummary;
  @Input() description: string = '';
  @Input() categoryLabel: string = '';
  @Input() reparableLabel: string = 'Non défini';
  @Input() pdrLabel: string = 'Non défini';
  @Input() composants: readonly ComposantEntry[] = [];
  @Input() isRetour: boolean = false;
  @Input() primaryDisabled: boolean = false;
  @Input() retourSendDisabled: boolean = false;
  /** Disabled state for the "Terminer (non réparable)" CTA — usually mirrors
   *  the primaryDisabled but a host can choose to keep it always-enabled when
   *  the form is partially filled (no composant required on this path). */
  @Input() notReparableDisabled: boolean = false;

  @Output() finishDiag = new EventEmitter<void>();
  @Output() finishRetour = new EventEmitter<void>();
  @Output() sendToFinishRetour = new EventEmitter<void>();
  /** Non-réparable shortcut → parent invokes the cascade with a
   *  `changeFinishStatus` transition step (status goes straight to FINISHED). */
  @Output() finishDiagNotReparable = new EventEmitter<void>();

  trackByName(_: number, c: ComposantEntry): string {
    return c.nameComposant;
  }

  get reparableTone(): string {
    return this.toneFromLabel(this.reparableLabel);
  }
  get pdrTone(): string {
    return this.toneFromLabel(this.pdrLabel);
  }
  private toneFromLabel(label: string): string {
    if (label === 'Oui') return 'tone-yes';
    if (label === 'Non') return 'tone-no';
    return 'tone-neutral';
  }
}
