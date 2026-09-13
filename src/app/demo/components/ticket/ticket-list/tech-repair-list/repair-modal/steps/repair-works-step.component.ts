import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

/**
 * Step 4 · Travaux & tests — describes the work done and validates it
 * with two yes/no toggles ("Réparation réussie" + "Tests validés").
 * Layout mirrors the diagnostic failure step (single-column, 48px circle,
 * 0.98rem inputs) to keep parity with the diagnostic flow.
 */
@Component({
  selector: 'sav-repair-works-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="step" [formGroup]="form">
      <header class="step__head">
        <span class="step__num">1</span>
        <div>
          <h3>Travaux &amp; tests</h3>
          <p>Décrivez les travaux effectués et confirmez les tests de validation.</p>
        </div>
      </header>

      <div class="step__grid">
        <div class="field field--full">
          <label>
            Travaux effectués <span class="req">*</span>
          </label>
          <textarea
            class="sav-diag-textarea"
            rows="5"
            maxlength="1000"
            placeholder="Décrivez les opérations réalisées sur l'équipement…"
            formControlName="worksDone"
          ></textarea>
          <div class="counter">{{ (form.get('worksDone')?.value?.length ?? 0) }} / 1000</div>
        </div>

        <div class="field field--full">
          <label>
            Tests effectués <span class="req">*</span>
          </label>
          <textarea
            class="sav-diag-textarea"
            rows="4"
            maxlength="1000"
            placeholder="Listez les tests réalisés et leurs résultats…"
            formControlName="testsDone"
          ></textarea>
          <div class="counter">{{ (form.get('testsDone')?.value?.length ?? 0) }} / 1000</div>
        </div>

        <div class="toggles">
          <label class="toggle">
            <span class="toggle__label">
              <i class="pi pi-verified"></i>
              Réparation réussie ?
            </span>
            <span class="toggle__group" role="radiogroup" aria-label="Réparation réussie">
              <button
                type="button"
                class="toggle__btn"
                [class.toggle__btn--on]="form.get('repairSuccess')?.value === true"
                (click)="form.get('repairSuccess')?.setValue(true)"
              >Oui</button>
              <button
                type="button"
                class="toggle__btn"
                [class.toggle__btn--off]="form.get('repairSuccess')?.value === false"
                (click)="form.get('repairSuccess')?.setValue(false)"
              >Non</button>
            </span>
          </label>

          <label class="toggle">
            <span class="toggle__label">
              <i class="pi pi-check-circle"></i>
              Tests validés ?
            </span>
            <span class="toggle__group" role="radiogroup" aria-label="Tests validés">
              <button
                type="button"
                class="toggle__btn"
                [class.toggle__btn--on]="form.get('testsValidated')?.value === true"
                (click)="form.get('testsValidated')?.setValue(true)"
              >Oui</button>
              <button
                type="button"
                class="toggle__btn"
                [class.toggle__btn--off]="form.get('testsValidated')?.value === false"
                (click)="form.get('testsValidated')?.setValue(false)"
              >Non</button>
            </span>
          </label>
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

      .step__grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1.35rem;
      }
      .field { display: flex; flex-direction: column; }
      .field--full { grid-column: 1 / -1; }
      .field label {
        font-size: 0.95rem;
        font-weight: 650;
        color: var(--fx-text-strong);
        margin-bottom: 0.5rem;
      }
      .req { color: var(--fx-red-text); margin-left: 0.15rem; }
      .sav-diag-textarea {
        width: 100%;
        padding: 0.95rem 1.05rem;
        border: 1px solid var(--fx-border);
        border-radius: 9px;
        font-size: 0.98rem;
        font-family: inherit;
        resize: vertical;
        color: var(--fx-text);
        background: var(--fx-bg-card);
        line-height: 1.5;
        transition: border-color 120ms ease, box-shadow 120ms ease;
      }
      .sav-diag-textarea:focus {
        outline: none;
        border-color: var(--fx-blue);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
      }
      .counter {
        align-self: flex-end;
        margin-top: 0.35rem;
        font-size: 0.82rem;
        color: var(--fx-text-subtle);
      }

      .toggles {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      .toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 1rem 1.1rem;
        border: 1px solid var(--fx-border);
        border-radius: 10px;
        background: var(--fx-bg-surface);
      }
      .toggle__label {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        font-size: 0.95rem;
        font-weight: 650;
        color: var(--fx-text);
      }
      .toggle__label i { color: var(--fx-text-muted); font-size: 1rem; }
      .toggle__group {
        display: inline-flex;
        gap: 0.4rem;
      }
      .toggle__btn {
        min-width: 60px;
        padding: 0.55rem 0.9rem;
        border-radius: 7px;
        border: 1px solid var(--fx-border);
        background: var(--fx-bg-card);
        font-size: 0.9rem;
        font-weight: 650;
        color: var(--fx-text-muted);
        cursor: pointer;
        transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
      }
      .toggle__btn:hover { background: var(--fx-bg-surface-2); }
      .toggle__btn--on {
        background: rgba(34, 197, 94, 0.12);
        border-color: rgba(34, 197, 94, 0.45);
        color: var(--fx-green-soft-fg);
      }
      .toggle__btn--off {
        background: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.4);
        color: var(--fx-red-soft-fg);
      }

      .tip {
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
        padding: 1rem 1.1rem;
        background: rgba(59, 130, 246, 0.08);
        border: 1px solid rgba(59, 130, 246, 0.2);
        border-radius: 10px;
        color: var(--fx-blue-soft-fg);
      }
      .tip i { font-size: 1.2rem; margin-top: 0.1rem; }
      .tip strong { display: block; font-size: 0.98rem; font-weight: 700; }
      .tip span {
        display: block;
        margin-top: 0.25rem;
        font-size: 0.9rem;
        color: var(--fx-text-strong);
        line-height: 1.5;
      }

      @media (max-width: 720px) {
        .step { padding: 1.25rem; }
        .toggles { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class RepairWorksStepComponent {
  @Input({ required: true }) form!: FormGroup;
}
