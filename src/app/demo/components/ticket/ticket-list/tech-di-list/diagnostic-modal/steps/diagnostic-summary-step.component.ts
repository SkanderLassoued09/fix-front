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
import { DIAG_STEP_STYLES } from './diagnostic-step.styles';

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
        <span class="step__num">{{ stepNumber }}</span>
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

      <!-- Pourquoi les boutons sont gris. Indispensable ici : le stepper
           autorise la navigation libre, on peut donc arriver au Résumé sans
           avoir rempli l'étape Panne. Un tooltip sur bouton désactivé ne
           s'affiche pas de façon fiable (cf. le même choix dans la barre de
           navigation du modal). -->
      <p class="notice" *ngIf="blockedReason">
        <i class="pi pi-exclamation-triangle"></i>
        {{ blockedReason }}
      </p>

      <div class="actions">
        <button
          *ngIf="isRetour && showSendToFinishRetour"
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
    DIAG_STEP_STYLES,
    `
      /* Condition à lever avant de clôturer — même idiome ambre que l'étape
         Composants, dont la classe .notice est locale et ne vit donc pas dans
         le gabarit partagé. */
      .notice {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        margin: 0 0 0.9rem;
        padding: 0.5rem 0.7rem;
        border-radius: 7px;
        background: var(--fx-amber-soft-bg);
        color: var(--fx-amber-text);
        font-size: 0.78rem;
        font-weight: 600;
        line-height: 1.35;
      }
      .notice .pi { font-size: 0.8rem; flex-shrink: 0; }

      .card {
        margin-bottom: 0.9rem;
        padding: 1rem 1.1rem;
        border: 1px solid var(--fx-border);
        border-radius: 8px;
        background: var(--fx-bg-card);
      }
      .card__title {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--fx-text);
        margin-bottom: 0.5rem;
      }
      .card__row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
        padding-bottom: 0.75rem;
        margin-bottom: 0.75rem;
        border-bottom: 1px dashed var(--fx-border);
      }
      .card__row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
      .card__row--cols { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .card__row small {
        display: block;
        font-size: 0.66rem;
        font-weight: 650;
        color: var(--fx-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .card__row strong {
        display: block;
        margin-top: 0.18rem;
        font-size: 0.86rem;
        font-weight: 650;
        color: var(--fx-text);
      }
      .card__row p {
        margin: 0.18rem 0 0;
        font-size: 0.82rem;
        color: var(--fx-text-strong);
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
      .pill.tone-yes { background: rgba(34, 197, 94, 0.14); color: var(--fx-green-soft-fg); }
      .pill.tone-no { background: rgba(239, 68, 68, 0.12); color: var(--fx-red-soft-fg); }
      .pill.tone-neutral { background: var(--fx-bg-surface-2); color: var(--fx-text-muted); }

      .comp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
      .comp-list li {
        display: flex;
        justify-content: space-between;
        padding: 0.45rem 0.6rem;
        border: 1px solid var(--fx-border);
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
      .btn--primary { background: var(--fx-blue); color: var(--fx-text-on-accent); border-color: var(--fx-blue-strong); }
      .btn--primary:hover:not(:disabled) { background: var(--fx-blue-strong); }
      .btn--outline {
        background: var(--fx-bg-card);
        color: var(--fx-text);
        border-color: var(--fx-border);
      }
      .btn--outline:hover:not(:disabled) { background: var(--fx-bg-surface); border-color: var(--fx-border-strong); }
      .btn--danger {
        background: var(--fx-red);
        color: var(--fx-text-on-accent);
        border-color: var(--fx-red);
      }
      .btn--danger:hover:not(:disabled) { background: var(--fx-red-strong); border-color: var(--fx-red); }
      .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    `,
  ],
})
export class DiagnosticSummaryStepComponent {
  @Input({ required: true }) di!: DiagnosticDiSummary;
  /** Numéro affiché — vient du MÊME tableau `steps` que le stepper de gauche. */
  @Input() stepNumber = 0;
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
  /** Raison du grisage des boutons de clôture (`null` = rien ne bloque). */
  @Input() blockedReason: string | null = null;

  @Output() finishDiag = new EventEmitter<void>();
  @Output() finishRetour = new EventEmitter<void>();
  @Output() sendToFinishRetour = new EventEmitter<void>();

  /**
   * « Envoyer vers finir » MASQUÉ à la demande de l'utilisateur (2026-09-15).
   * Rien n'est bloqué : « Fin diagnostique retour » route aussi un retour NON
   * réparable vers IRREPARABLE (backstop serveur de `changeStatusPending2`).
   * Repasser à `true` pour le réafficher — la sortie et le handler hôte restent.
   */
  readonly showSendToFinishRetour = false;
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
