import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogModule } from 'primeng/dialog';

// Shared shells from the diagnostic-modal tree — identical visuals.
import { DiagnosticHeaderComponent } from '../../tech-di-list/diagnostic-modal/components/diagnostic-header.component';
import { DiagnosticInfoStripComponent } from '../../tech-di-list/diagnostic-modal/components/diagnostic-info-strip.component';
import { DiagnosticStepperComponent } from '../../tech-di-list/diagnostic-modal/components/diagnostic-stepper.component';
import { DiagnosticSidebarComponent } from '../../tech-di-list/diagnostic-modal/components/diagnostic-sidebar.component';
import {
  DiagnosticStep,
  DiagnosticStepKey,
  SidebarDecision,
} from '../../tech-di-list/diagnostic-modal/diagnostic-modal.types';

// Repair-specific step components.
import { RepairInfoStepComponent } from './steps/repair-info-step.component';
import { RepairPlanStepComponent } from './steps/repair-plan-step.component';
import { RepairPartsStepComponent } from './steps/repair-parts-step.component';
import { RepairWorksStepComponent } from './steps/repair-works-step.component';
import { RepairSummaryStepComponent } from './steps/repair-summary-step.component';

import {
  RepairBadgeValue,
  RepairContext,
  RepairProgress,
  RepairStepKey,
} from './repair-modal.types';

/**
 * Repair-modal root orchestrator — same chrome as the diagnostic modal,
 * with the five repair-specific step components in the center.
 *
 * The shared dumb shells (header, info-strip, stepper, sidebar) are reused
 * directly; they accept the repair labels via Inputs whose defaults match
 * the diagnostic behavior. The legacy diagnostic modal is therefore
 * untouched.
 */
@Component({
  selector: 'app-repair-modal',
  standalone: true,
  imports: [
    CommonModule,
    DialogModule,
    DiagnosticHeaderComponent,
    DiagnosticInfoStripComponent,
    DiagnosticStepperComponent,
    DiagnosticSidebarComponent,
    RepairInfoStepComponent,
    RepairPlanStepComponent,
    RepairPartsStepComponent,
    RepairWorksStepComponent,
    RepairSummaryStepComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './repair-modal.component.html',
  styleUrls: ['./repair-modal.component.scss'],
})
export class RepairModalComponent {
  @Input({ required: true }) visible: boolean = false;
  @Input({ required: true }) context!: RepairContext;
  /**
   * The stepper component is shared with the diagnostic modal and is typed
   * against `DiagnosticStep` / `DiagnosticStepKey`. Repair steps map onto
   * that type 1-to-1 — only the `key` strings differ. The parent passes
   * the casted view-model.
   */
  @Input({ required: true }) steps!: readonly DiagnosticStep[];
  @Input({ required: true }) activeStep!: RepairStepKey;
  @Input({ required: true }) progress!: RepairProgress;
  @Input() clientLine: string = '';
  @Input() categoryLabel: string = '';
  @Input() repairPlan: string = '';
  @Input() repairSuccess: RepairBadgeValue = 'Non défini';
  @Input() testsValidated: RepairBadgeValue = 'Non défini';
  @Input() warrantyLabel: string = 'Non défini';
  @Input() elapsedLabel: string = '—';
  @Input() headerStatusTone: 'running' | 'paused' | 'info' | 'neutral' = 'info';
  @Input() canMinimize: boolean = false;

  @Output() pauseClicked = new EventEmitter<void>();
  @Output() minimizeClicked = new EventEmitter<void>();
  @Output() stepChanged = new EventEmitter<RepairStepKey>();
  @Output() addPart = new EventEmitter<void>();
  @Output() removePart = new EventEmitter<string>();
  @Output() finishRepair = new EventEmitter<void>();
  @Output() visibleChange = new EventEmitter<boolean>();

  /** "Clôture (à venir)" rows fed to the shared sidebar component. */
  get closureDecisions(): readonly SidebarDecision[] {
    return [
      {
        icon: 'pi-shield',
        label: 'Sous garantie ?',
        value: this.warrantyLabel,
        faded: this.warrantyLabel === 'Non défini',
      },
      {
        icon: 'pi-clock',
        label: 'Temps passé',
        value: this.elapsedLabel,
        faded: this.elapsedLabel === '—',
      },
    ];
  }

  onVisibleChange(v: boolean): void {
    this.visible = v;
    this.visibleChange.emit(v);
  }

  goPrevious(): void {
    const idx = this.steps.findIndex((s) => s.key === this.activeStep);
    if (idx > 0) this.stepChanged.emit(this.steps[idx - 1].key as RepairStepKey);
  }
  goNext(): void {
    const idx = this.steps.findIndex((s) => s.key === this.activeStep);
    if (idx >= 0 && idx < this.steps.length - 1) {
      this.stepChanged.emit(this.steps[idx + 1].key as RepairStepKey);
    }
  }

  onStepperSelected(key: DiagnosticStepKey): void {
    this.stepChanged.emit(key as unknown as RepairStepKey);
  }

  get isFirstStep(): boolean {
    return this.steps[0]?.key === this.activeStep;
  }
  get isLastStep(): boolean {
    return this.steps[this.steps.length - 1]?.key === this.activeStep;
  }
}
