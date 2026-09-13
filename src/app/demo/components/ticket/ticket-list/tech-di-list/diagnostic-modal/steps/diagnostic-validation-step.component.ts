import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { DIAG_STEP_STYLES } from './diagnostic-step.styles';

/**
 * Step 4 · Validation — three decision toggles:
 *   - Pièce réparable ?       (isReparable)
 *   - Contient PDR ?          (isPdr)
 *   - Erreur Fixtronix ?      (isErrorFromFixtronix — only on retours)
 *
 * Each toggle binds straight to the parent's `diagFormTech`; the parent's
 * valueChanges subscription keeps recomputing the disabled-state booleans.
 */
@Component({
  selector: 'sav-diag-validation-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step" [formGroup]="form">
      <header class="step__head">
        <span class="step__num">{{ stepNumber }}</span>
        <div>
          <h3>Validation</h3>
          <p>Validez les décisions clés avant de soumettre le diagnostic.</p>
        </div>
      </header>

      <div class="decisions">
        <label class="decision">
          <div class="decision__copy">
            <strong>Cette pièce est réparable ?</strong>
            <span>Indique au magasin que la pièce peut être réparée plutôt que remplacée.</span>
          </div>
          <input type="checkbox" formControlName="isReparable" class="switch" />
        </label>

        <label class="decision">
          <div class="decision__copy">
            <strong>Le DI contient des PDR ?</strong>
            <span>Active l'étape Composants si vous prévoyez d'utiliser des pièces de rechange.</span>
          </div>
          <input type="checkbox" formControlName="isPdr" class="switch" />
        </label>

        <label class="decision" *ngIf="showErrorFromFixtronix">
          <div class="decision__copy">
            <strong>Erreur de Fixtronix ?</strong>
            <span>À cocher si l'incident provient d'une intervention précédente Fixtronix.</span>
          </div>
          <input type="checkbox" formControlName="isErrorFromFixtronix" class="switch" />
        </label>
      </div>
    </div>
  `,
  styles: [
    DIAG_STEP_STYLES,
    `

      .decisions { display: flex; flex-direction: column; gap: 0.6rem; }
      .decision {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.85rem 1rem;
        border: 1px solid var(--fx-border);
        border-radius: 8px;
        background: var(--fx-bg-card);
        cursor: pointer;
        transition: border-color 120ms ease, background 120ms ease;
      }
      .decision:hover { border-color: var(--fx-border-strong); }
      .decision__copy strong {
        display: block;
        font-size: 0.86rem;
        font-weight: 650;
        color: var(--fx-text);
      }
      .decision__copy span {
        display: block;
        margin-top: 0.18rem;
        font-size: 0.76rem;
        color: var(--fx-text-muted);
      }

      /* Pure-CSS toggle switch — no PrimeNG dep needed, OnPush-safe */
      .switch {
        appearance: none;
        -webkit-appearance: none;
        position: relative;
        width: 38px;
        height: 22px;
        background: var(--fx-border-strong);
        border-radius: 999px;
        cursor: pointer;
        transition: background 140ms ease;
        flex-shrink: 0;
      }
      .switch::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 18px;
        height: 18px;
        background: var(--fx-bg-card);
        border-radius: 50%;
        transition: transform 140ms ease;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.15);
      }
      .switch:checked { background: var(--fx-green); }
      .switch:checked::after { transform: translateX(16px); }
      /* Disabled (e.g. PDR when the DI is non-réparable) — greyed + locked. */
      .switch:disabled { opacity: 0.45; cursor: not-allowed; background: var(--fx-border-strong); }
      .switch:disabled::after { box-shadow: none; }
    `,
  ],
})
export class DiagnosticValidationStepComponent {
  @Input({ required: true }) form!: FormGroup;
  /** Numéro affiché — vient du MÊME tableau `steps` que le stepper de gauche. */
  @Input() stepNumber = 0;
  /** Only meaningful on retour cycles — parent toggles this based on ignoreCount. */
  @Input() showErrorFromFixtronix: boolean = false;
}
