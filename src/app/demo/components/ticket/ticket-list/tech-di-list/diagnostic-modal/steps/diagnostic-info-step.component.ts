import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CategoryOption,
  DiagnosticDiSummary,
  DiagnosticPreviousCycle,
} from '../diagnostic-modal.types';
import { DiImageComponent } from 'src/app/demo/components/ticket/shared/di-image/di-image.component';
import { DIAG_STEP_STYLES } from './diagnostic-step.styles';

/**
 * Step 1 · Informations générales — read-only DI context.
 * Tech reviews what they're about to diagnose before filling the form.
 */
@Component({
  selector: 'sav-diag-info-step',
  standalone: true,
  imports: [CommonModule, DiImageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step">
      <header class="step__head">
        <span class="step__num">{{ stepNumber }}</span>
        <div>
          <h3>Informations générales</h3>
          <p>Revoyez le contexte du ticket avant de démarrer le diagnostic.</p>
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
      </div>

      <!-- Diagnostics des cycles ANTÉRIEURS — retour uniquement, en LECTURE
           SEULE. Remplace les deux blocs « (précédente) » qui lisaient le
           miroir de la DI : vide sur un retour (remis à zéro à l'entrée), et
           au cycle 0 il présentait la remarque EN COURS comme « précédente ».
           Aucun champ de saisie ici : rien n'est repris dans le formulaire. -->
      <section class="prev-cycles" *ngIf="previousCycles.length">
        <h4 class="prev-cycles__title">Diagnostics précédents</h4>
        <p class="prev-cycles__hint">
          Pour information : ce retour démarre un diagnostic vierge.
        </p>

        <article
          class="prev-cycle"
          *ngFor="let p of previousCycles; trackBy: trackByCycle"
        >
          <span class="prev-cycle__chip">
            <i class="pi" [ngClass]="p.cycle ? 'pi-replay' : 'pi-flag'"></i>
            {{ p.label }}
          </span>

          <dl class="prev-cycle__facts">
            <div>
              <dt>Catégorie</dt>
              <dd>{{ categoryLabel(p.categoryId) }}</dd>
            </div>
            <div>
              <dt>Réparable</dt>
              <dd>{{ yesNo(p.reparable) }}</dd>
            </div>
            <div>
              <dt>PDR</dt>
              <dd>{{ yesNo(p.pdr) }}</dd>
            </div>
            <div *ngIf="p.cycle > 0">
              <dt>Erreur Fixtronix</dt>
              <dd>{{ yesNo(p.errorFromFixtronix) }}</dd>
            </div>
          </dl>

          <table class="prev-cycle__table" *ngIf="p.composants.length; else noParts">
            <thead>
              <tr>
                <th>Composant</th>
                <th class="qty">Quantité</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of p.composants">
                <td>{{ c.nameComposant }}</td>
                <td class="qty">{{ c.quantity }}</td>
              </tr>
            </tbody>
          </table>
          <ng-template #noParts>
            <p class="prev-cycle__empty">Aucun composant</p>
          </ng-template>

          <div class="field" *ngIf="p.remarqueDiagnostic">
            <label>Remarque diagnostic</label>
            <div class="field__value field__value--multi">{{ p.remarqueDiagnostic }}</div>
          </div>
          <div class="field" *ngIf="p.remarqueReparation">
            <label>Remarque réparation</label>
            <div class="field__value field__value--multi">{{ p.remarqueReparation }}</div>
          </div>
        </article>
      </section>
    </div>
  `,
  styles: [
    DIAG_STEP_STYLES,
    `
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
        color: var(--fx-text-muted);
        margin-bottom: 0.25rem;
      }
      .field__value {
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--fx-border);
        border-radius: 8px;
        background: var(--fx-bg-surface);
        font-size: 0.85rem;
        color: var(--fx-text);
      }
      .field__value--multi { line-height: 1.5; white-space: pre-wrap; }

      /* Historique en LECTURE SEULE : séparé du contexte par un filet, cartes
         bordées sans fond — rien ne doit ressembler à un champ à remplir. */
      .prev-cycles {
        margin-top: 1.4rem;
        padding-top: 1rem;
        border-top: 1px solid var(--fx-border);
      }
      .prev-cycles__title {
        margin: 0;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--fx-text-muted-strong);
      }
      .prev-cycles__hint {
        margin: 0.25rem 0 0.85rem;
        font-size: 0.78rem;
        color: var(--fx-text-subtle);
      }
      .prev-cycle {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0.85rem 1rem;
        border: 1px solid var(--fx-border);
        border-radius: 10px;
      }
      .prev-cycle + .prev-cycle { margin-top: 0.75rem; }
      .prev-cycle__chip {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        border: 1px solid var(--fx-blue-soft-bd);
        background: var(--fx-blue-soft-bg);
        color: var(--fx-blue-text);
        font-size: 0.72rem;
        font-weight: 700;
      }
      .prev-cycle__chip .pi { font-size: 0.7rem; }
      .prev-cycle__facts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 0.6rem 1rem;
        margin: 0;
      }
      .prev-cycle__facts dt {
        font-size: 0.68rem;
        font-weight: 650;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--fx-text-subtle);
      }
      .prev-cycle__facts dd {
        margin: 0.15rem 0 0;
        font-size: 0.85rem;
        color: var(--fx-text);
      }
      .prev-cycle__table { width: 100%; border-collapse: collapse; }
      .prev-cycle__table th,
      .prev-cycle__table td {
        padding: 0.4rem 0.5rem;
        font-size: 0.8rem;
        text-align: left;
        border-bottom: 1px solid var(--fx-border);
      }
      .prev-cycle__table th {
        color: var(--fx-text-subtle);
        font-weight: 650;
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .prev-cycle__table td { color: var(--fx-text); }
      .prev-cycle__table tbody tr:last-child td { border-bottom: none; }
      .prev-cycle__table .qty {
        width: 90px;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .prev-cycle__empty {
        margin: 0;
        font-size: 0.8rem;
        color: var(--fx-text-subtle);
      }
    `,
  ],
})
export class DiagnosticInfoStepComponent {
  @Input({ required: true }) di!: DiagnosticDiSummary;
  /** Numéro affiché — vient du MÊME tableau `steps` que le stepper de gauche. */
  @Input() stepNumber = 0;
  /** Diagnostics des cycles antérieurs (retour uniquement), plus récent d'abord. */
  @Input() previousCycles: readonly DiagnosticPreviousCycle[] = [];
  /** Catégories de DI — sert UNIQUEMENT à libeller `categoryId` ci-dessus. */
  @Input() categories: readonly CategoryOption[] = [];

  readonly notSet = 'Non renseigné';

  /** Un id sans correspondance (`'true'`, catégorie supprimée…) n'est pas
   *  affiché brut : il vaut « Non renseigné ». */
  categoryLabel(id: string | null): string {
    return (
      (id && this.categories.find((c) => c._id === id)?.category) ||
      this.notSet
    );
  }

  yesNo(value: boolean | null): string {
    if (value === true) return 'Oui';
    if (value === false) return 'Non';
    return this.notSet;
  }

  trackByCycle(_: number, p: DiagnosticPreviousCycle): number {
    return p.cycle;
  }
}
