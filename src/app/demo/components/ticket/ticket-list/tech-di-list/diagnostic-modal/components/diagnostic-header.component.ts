import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagnosticTimerComponent } from './diagnostic-timer.component';
import { TimerDisplayState } from '../diagnostic-modal.types';

/**
 * Header bar:  Diagnostic — DI42   [EN COURS]      ⏱ 00:00:18  [⏸ Pause]  [Réduire]
 *
 * Pure dumb component — emits intent only. The parent decides what "pause"
 * actually triggers (lapTimeForPauseAndGetBack mutation + persistence).
 */
@Component({
  selector: 'sav-diag-header',
  standalone: true,
  imports: [CommonModule, DiagnosticTimerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="sav-diag-header">
      <div class="sav-diag-header__title">
        <h2>
          {{ title }} <span class="sav-diag-header__sep">—</span>
          <span class="sav-diag-header__id">{{ diIdnum }}</span>
        </h2>
        <span
          class="sav-diag-header__status"
          [ngClass]="'sav-diag-header__status--' + statusTone"
        >
          <span class="sav-diag-header__status-dot"></span>
          {{ statusLabel }}
        </span>
      </div>

      <div class="sav-diag-header__actions">
        <sav-diag-timer [state]="timer"></sav-diag-timer>

        <button
          type="button"
          class="sav-diag-header__pause"
          [class.sav-diag-header__pause--running]="timer.isRunning"
          (click)="pause.emit()"
        >
          <i [class]="timer.isRunning ? 'pi pi-pause' : 'pi pi-play'"></i>
          {{ timer.isRunning ? 'Mettre en pause' : 'Reprendre' }}
        </button>

        <button
          type="button"
          class="sav-diag-header__minimize"
          [disabled]="!canMinimize"
          title="Disponible après la mise en pause"
          (click)="minimize.emit()"
        >
          <i class="pi pi-window-minimize"></i>
          Réduire
        </button>
      </div>
    </header>
  `,
  styles: [
    `
      :host { display: block; }
      .sav-diag-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.25rem;
        padding: 1.35rem 1.75rem;
        border-bottom: 1px solid #e2e8f0;
        background: #ffffff;
        border-top-left-radius: 14px;
        border-top-right-radius: 14px;
      }
      .sav-diag-header__title {
        display: flex;
        align-items: center;
        gap: 1rem;
        min-width: 0;
      }
      .sav-diag-header__title h2 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.015em;
        line-height: 1.2;
      }
      .sav-diag-header__sep { color: #94a3b8; font-weight: 400; margin: 0 0.25rem; }
      .sav-diag-header__id { color: #0f172a; }

      .sav-diag-header__status {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.38rem 0.85rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .sav-diag-header__status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: currentColor;
      }
      .sav-diag-header__status--running {
        background: rgba(34, 197, 94, 0.14);
        color: #15803d;
      }
      .sav-diag-header__status--paused {
        background: rgba(239, 68, 68, 0.12);
        color: #dc2626;
      }
      .sav-diag-header__status--info {
        background: rgba(59, 130, 246, 0.14);
        color: #1d4ed8;
      }
      .sav-diag-header__status--neutral {
        background: #f1f5f9;
        color: #475569;
      }

      .sav-diag-header__actions {
        display: flex;
        align-items: center;
        gap: 0.65rem;
      }

      .sav-diag-header__pause {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.65rem 1.1rem;
        border-radius: 9px;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        color: #0f172a;
        font-size: 0.92rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 120ms ease, border-color 120ms ease;
      }
      .sav-diag-header__pause:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }
      .sav-diag-header__pause i { font-size: 0.9rem; }
      .sav-diag-header__pause--running {
        background: rgba(59, 130, 246, 0.08);
        border-color: rgba(59, 130, 246, 0.25);
        color: #1d4ed8;
      }

      .sav-diag-header__minimize {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.65rem 1.1rem;
        border-radius: 9px;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        color: #475569;
        font-size: 0.92rem;
        font-weight: 600;
        cursor: pointer;
        transition: background 120ms ease, color 120ms ease;
      }
      .sav-diag-header__minimize:hover:not(:disabled) {
        background: #f8fafc;
        color: #0f172a;
        border-color: #cbd5e1;
      }
      .sav-diag-header__minimize i { font-size: 0.9rem; }
      .sav-diag-header__minimize:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
    `,
  ],
})
export class DiagnosticHeaderComponent {
  /**
   * Headline prefix — "Diagnostic" by default, "Réparation" when reused
   * from the repair modal. Renders as `{{ title }} — DI23`.
   */
  @Input() title: string = 'Diagnostic';
  @Input({ required: true }) diIdnum!: string;
  @Input({ required: true }) statusLabel!: string;
  /** Tone driver — passed by parent based on the underlying status code. */
  @Input() statusTone: 'running' | 'paused' | 'info' | 'neutral' = 'info';
  @Input({ required: true }) timer!: TimerDisplayState;
  @Input() canMinimize: boolean = false;

  @Output() pause = new EventEmitter<void>();
  @Output() minimize = new EventEmitter<void>();
}
