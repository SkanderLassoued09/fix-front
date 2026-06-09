import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerDisplayState } from '../diagnostic-modal.types';

/**
 * Pure display chip. No state owned here — the parent component owns
 * accumulated/run-leg state and just emits a `display` string + isRunning
 * flag. Keeps the UI piece reusable for the repair side later.
 */
@Component({
  selector: 'sav-diag-timer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="sav-diag-timer" [class.sav-diag-timer--running]="state.isRunning">
      <i class="pi pi-clock"></i>
      <strong class="sav-diag-timer__value">{{ state.display }}</strong>
    </span>
  `,
  styles: [
    `
      :host { display: inline-flex; }
      .sav-diag-timer {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.32rem 0.65rem;
        border-radius: 8px;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        color: #475569;
        font-size: 0.78rem;
      }
      .sav-diag-timer--running {
        background: rgba(34, 197, 94, 0.1);
        border-color: rgba(34, 197, 94, 0.35);
        color: #15803d;
      }
      .sav-diag-timer__value {
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.02em;
        font-weight: 700;
        color: inherit;
      }
      i { font-size: 0.78rem; }
    `,
  ],
})
export class DiagnosticTimerComponent {
  @Input({ required: true }) state!: TimerDisplayState;
}
