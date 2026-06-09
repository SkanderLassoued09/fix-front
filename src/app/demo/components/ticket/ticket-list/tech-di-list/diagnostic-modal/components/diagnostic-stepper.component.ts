import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  DiagnosticStep,
  DiagnosticStepKey,
} from '../diagnostic-modal.types';

/**
 * Left sidebar — 5-step list with per-step state marker (✓ / current / À faire).
 * Click navigation emitted via `stepSelected`; the parent component owns
 * which step is active and recomputes `steps` on every change.
 */
@Component({
  selector: 'sav-diag-stepper',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="sav-stepper">
      <header class="sav-stepper__head">
        <h3>Étapes du diagnostic</h3>
        <div class="sav-stepper__progress">
          <strong>{{ completedCount }} / {{ steps.length }}</strong>
          <span>complétées</span>
        </div>
        <div class="sav-stepper__bar">
          <span
            *ngFor="let s of steps; trackBy: trackByKey"
            [class.sav-stepper__bar-cell--done]="s.state === 'completed'"
            [class.sav-stepper__bar-cell--current]="s.state === 'current'"
          ></span>
        </div>
      </header>

      <ol class="sav-stepper__list">
        <li
          *ngFor="let s of steps; trackBy: trackByKey"
          [class.sav-stepper__item--current]="s.state === 'current'"
          [class.sav-stepper__item--done]="s.state === 'completed'"
        >
          <button type="button" class="sav-stepper__btn" (click)="stepSelected.emit(s.key)">
            <span class="sav-stepper__num">
              <ng-container *ngIf="s.state === 'completed'; else nbr">
                <i class="pi pi-check"></i>
              </ng-container>
              <ng-template #nbr>{{ s.number }}</ng-template>
            </span>
            <div class="sav-stepper__text">
              <strong>{{ s.label }}</strong>
              <em>{{ s.hint }}</em>
            </div>
            <i
              *ngIf="s.state === 'completed'"
              class="pi pi-check-circle sav-stepper__done-icon"
            ></i>
          </button>
        </li>
      </ol>

      <footer class="sav-stepper__foot">
        <i class="pi pi-question-circle"></i>
        <div>
          <strong>Besoin d'aide ?</strong>
          <small>Consultez la documentation</small>
        </div>
      </footer>
    </aside>
  `,
  styles: [
    `
      :host { display: block; height: 100%; }
      .sav-stepper {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 1.5rem 1.15rem;
        background: #f8fafc;
        border-right: 1px solid #e2e8f0;
      }
      .sav-stepper__head h3 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.01em;
      }
      .sav-stepper__progress {
        display: flex;
        align-items: baseline;
        gap: 0.4rem;
        margin-top: 0.55rem;
        font-size: 0.88rem;
        color: #64748b;
      }
      .sav-stepper__progress strong { color: #0f172a; font-weight: 700; font-size: 0.92rem; }
      .sav-stepper__bar {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 0.3rem;
        margin-top: 0.75rem;
      }
      .sav-stepper__bar span {
        display: block;
        height: 6px;
        border-radius: 999px;
        background: #e2e8f0;
      }
      .sav-stepper__bar-cell--done { background: #22c55e !important; }
      .sav-stepper__bar-cell--current { background: #3b82f6 !important; }

      .sav-stepper__list {
        list-style: none;
        margin: 1.4rem 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        flex: 1;
        overflow-y: auto;
      }
      .sav-stepper__btn {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        width: 100%;
        padding: 0.95rem 0.9rem;
        border-radius: 10px;
        border: 1px solid transparent;
        background: transparent;
        text-align: left;
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease;
      }
      .sav-stepper__btn:hover { background: rgba(15, 23, 42, 0.04); }
      .sav-stepper__item--current .sav-stepper__btn {
        background: rgba(59, 130, 246, 0.08);
        border-color: rgba(59, 130, 246, 0.28);
      }
      .sav-stepper__num {
        flex-shrink: 0;
        display: inline-grid;
        place-items: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #e2e8f0;
        color: #475569;
        font-size: 1rem;
        font-weight: 700;
      }
      .sav-stepper__item--current .sav-stepper__num {
        background: #3b82f6;
        color: #ffffff;
      }
      .sav-stepper__item--done .sav-stepper__num {
        background: #22c55e;
        color: #ffffff;
      }
      .sav-stepper__text { min-width: 0; flex: 1; }
      .sav-stepper__text strong {
        display: block;
        font-size: 0.98rem;
        font-weight: 650;
        color: #0f172a;
        line-height: 1.2;
      }
      .sav-stepper__item--current .sav-stepper__text strong { color: #1d4ed8; }
      .sav-stepper__text em {
        display: block;
        font-style: normal;
        margin-top: 0.22rem;
        font-size: 0.82rem;
        color: #64748b;
        line-height: 1.2;
      }
      .sav-stepper__done-icon { color: #22c55e; font-size: 1.1rem; }

      .sav-stepper__foot {
        margin-top: 1.25rem;
        display: flex;
        align-items: center;
        gap: 0.7rem;
        padding: 0.85rem 0.9rem;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
        background: #ffffff;
      }
      .sav-stepper__foot i { color: #64748b; font-size: 1.05rem; }
      .sav-stepper__foot strong {
        display: block;
        font-size: 0.9rem;
        font-weight: 650;
        color: #0f172a;
      }
      .sav-stepper__foot small {
        display: block;
        margin-top: 0.15rem;
        font-size: 0.8rem;
        color: #3b82f6;
        text-decoration: underline;
      }
    `,
  ],
})
export class DiagnosticStepperComponent {
  @Input({ required: true }) steps!: readonly DiagnosticStep[];

  @Output() stepSelected = new EventEmitter<DiagnosticStepKey>();

  get completedCount(): number {
    return this.steps.filter((s) => s.state === 'completed').length;
  }

  trackByKey(_: number, s: DiagnosticStep): string {
    return s.key;
  }
}
