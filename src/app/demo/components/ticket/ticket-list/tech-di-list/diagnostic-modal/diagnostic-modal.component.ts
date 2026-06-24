import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { DiagnosticHeaderComponent } from './components/diagnostic-header.component';
import { DiagnosticInfoStripComponent } from './components/diagnostic-info-strip.component';
import { DiagnosticStepperComponent } from './components/diagnostic-stepper.component';
import { DiagnosticSidebarComponent } from './components/diagnostic-sidebar.component';
import { DiagnosticInfoStepComponent } from './steps/diagnostic-info-step.component';
import { DiagnosticFailureStepComponent } from './steps/diagnostic-failure-step.component';
import { DiagnosticComponentsStepComponent } from './steps/diagnostic-components-step.component';
import { DiagnosticValidationStepComponent } from './steps/diagnostic-validation-step.component';
import { DiagnosticSummaryStepComponent } from './steps/diagnostic-summary-step.component';
import {
  AutosaveHint,
  DiagnosticContext,
  DiagnosticProgress,
  DiagnosticStep,
  DiagnosticStepKey,
} from './diagnostic-modal.types';

/**
 * Root orchestrator. Wraps a PrimeNG `<p-dialog>` and lays out:
 *
 *   ┌──────────────── Header (title · status · timer · pause · close) ────────────────┐
 *   │ ┌──────────── Info strip: 5 cards (Ticket · Client · Loc · Status · Tech) ────┐ │
 *   │ │ ┌─ Stepper ──┐ ┌─ Step body ──────────────────────┐ ┌─ Sidebar (summary) ─┐ │ │
 *   │ │ │            │ │ <ng-container *ngSwitch step>    │ │                     │ │ │
 *   │ │ │            │ │   step components by key         │ │                     │ │ │
 *   │ │ │            │ │ Previous / Next inline           │ │                     │ │ │
 *   │ │ └────────────┘ └──────────────────────────────────┘ └─────────────────────┘ │ │
 *   │ └─────────────────────────────────────────────────────────────────────────────┘ │
 *   │                       Footer · autosave hint · primary CTA                      │
 *   └─────────────────────────────────────────────────────────────────────────────────┘
 *
 * Everything here is pure UI plumbing — the parent `tech-di-list` keeps
 * ownership of the FormGroup, timer mutations, persistence and Apollo
 * subscriptions. Outputs declare intents; the parent decides what to do.
 */
@Component({
  selector: 'app-diagnostic-modal',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    DiagnosticHeaderComponent,
    DiagnosticInfoStripComponent,
    DiagnosticStepperComponent,
    DiagnosticSidebarComponent,
    DiagnosticInfoStepComponent,
    DiagnosticFailureStepComponent,
    DiagnosticComponentsStepComponent,
    DiagnosticValidationStepComponent,
    DiagnosticSummaryStepComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './diagnostic-modal.component.html',
  styleUrls: ['./diagnostic-modal.component.scss'],
})
export class DiagnosticModalComponent {
  @Input({ required: true }) visible: boolean = false;
  @Input({ required: true }) context!: DiagnosticContext;
  @Input({ required: true }) steps!: readonly DiagnosticStep[];
  @Input({ required: true }) activeStep!: DiagnosticStepKey;
  @Input({ required: true }) progress!: DiagnosticProgress;
  @Input({ required: true }) autosave!: AutosaveHint;
  @Input() clientLine: string = '';
  @Input() reparableLabel: string = 'Non défini';
  @Input() pdrLabel: string = 'Non défini';
  @Input() categoryLabel: string = '';
  @Input() headerStatusTone: 'running' | 'paused' | 'info' | 'neutral' = 'info';
  @Input() canMinimize: boolean = false;

  // intents — the parent maps these to existing mutations / persistence calls
  @Output() pauseClicked = new EventEmitter<void>();
  @Output() minimizeClicked = new EventEmitter<void>();
  @Output() stepChanged = new EventEmitter<DiagnosticStepKey>();
  @Output() addComposant = new EventEmitter<void>();
  @Output() removeComposant = new EventEmitter<string>();
  @Output() createComposant = new EventEmitter<void>();
  @Output() finishDiag = new EventEmitter<void>();
  @Output() finishRetour = new EventEmitter<void>();
  @Output() sendToFinishRetour = new EventEmitter<void>();
  /** Non-réparable shortcut → straight to FINISHED (skip composant/magasin). */
  @Output() finishDiagNotReparable = new EventEmitter<void>();

  /** Visible<->parent two-way support — keeps the existing [(visible)] pattern compatible. */
  @Output() visibleChange = new EventEmitter<boolean>();

  onVisibleChange(v: boolean): void {
    this.visible = v;
    this.visibleChange.emit(v);
  }

  goPrevious(): void {
    const idx = this.steps.findIndex((s) => s.key === this.activeStep);
    if (idx > 0) this.stepChanged.emit(this.steps[idx - 1].key);
  }
  goNext(): void {
    const idx = this.steps.findIndex((s) => s.key === this.activeStep);
    if (idx >= 0 && idx < this.steps.length - 1) {
      this.stepChanged.emit(this.steps[idx + 1].key);
    }
  }

  get isFirstStep(): boolean {
    return this.steps[0]?.key === this.activeStep;
  }
  get isLastStep(): boolean {
    return this.steps[this.steps.length - 1]?.key === this.activeStep;
  }
}
