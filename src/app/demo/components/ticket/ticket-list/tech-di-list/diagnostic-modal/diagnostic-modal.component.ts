import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { TreeNode } from 'primeng/api';
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
  /** Motif de blocage du bouton « Suivant » (null = pas de blocage). Calculé par
   *  le parent (qui détient le form + la liste de composants). Non-null → bouton
   *  désactivé + message affiché. Cas actuel : étape Validation, « contient des
   *  PDR » activé mais AUCUN composant sélectionné. */
  @Input() nextBlockedReason: string | null = null;
  /** Création de catégorie en vol (étape « Panne ») → spinner + bouton inerte. */
  @Input() categoryCreating: boolean = false;
  /** Bumpé par le parent après une création réussie → l'étape ferme son panneau. */
  @Input() categoryCreatedTick: number = 0;

  // intents — the parent maps these to existing mutations / persistence calls
  /** Raison du grisage des boutons de CLÔTURE (étape Résumé) — parallèle de
   *  `nextBlockedReason`, qui grise « Suivant ». `null` = rien ne bloque. */
  @Input() finishBlockedReason: string | null = null;
  /** Horodatage du brouillon navigateur restauré (bandeau), sinon null. */
  @Input() draftRestoredAt: number | null = null;

  @Output() pauseClicked = new EventEmitter<void>();
  @Output() minimizeClicked = new EventEmitter<void>();
  @Output() stepChanged = new EventEmitter<DiagnosticStepKey>();
  @Output() addComposant = new EventEmitter<void>();
  @Output() removeComposant = new EventEmitter<string>();
  /** Quantité corrigée sur une ligne déjà ajoutée (étape Composants). */
  @Output() composantQuantityChange = new EventEmitter<{
    nameComposant: string;
    quantity: number;
  }>();
  @Output() createComposant = new EventEmitter<void>();
  /** Libellé saisi dans le filtre du dropdown catégorie, à créer. */
  @Output() createCategory = new EventEmitter<string>();
  /** Ouverture d'une catégorie dans l'arbre → charger ses composants. */
  @Output() composantNodeExpand = new EventEmitter<TreeNode>();
  /** Terme saisi dans le filtre de l'arbre (débouncé par le parent). */
  @Output() composantSearch = new EventEmitter<string>();
  @Output() finishDiag = new EventEmitter<void>();
  @Output() finishRetour = new EventEmitter<void>();
  @Output() sendToFinishRetour = new EventEmitter<void>();
  /** Non-réparable shortcut → straight to FINISHED (skip composant/magasin). */
  @Output() finishDiagNotReparable = new EventEmitter<void>();
  /** « Ignorer le brouillon » : revenir aux valeurs enregistrées du dossier. */
  @Output() discardDraft = new EventEmitter<void>();

  /** Visible<->parent two-way support — keeps the existing [(visible)] pattern compatible. */
  @Output() visibleChange = new EventEmitter<boolean>();

  onVisibleChange(v: boolean): void {
    this.visible = v;
    this.visibleChange.emit(v);
  }

  /**
   * Numéro d'une étape, lu dans le MÊME tableau `steps` que le stepper de
   * gauche.
   *
   * Les pastilles étaient codées en dur dans chaque template
   * (info 1, panne 2, composants 3, validation 4, résumé 5) alors que l'ordre
   * réel est info 1, panne 2, validation 3, composants 4, résumé 5 : le corps
   * et le stepper affichaient donc des numéros CONTRADICTOIRES pour Validation
   * et Composants. Et quand « Contient PDR » vaut Non, l'étape Composants
   * disparaît — tout ce qui suit se décalait d'un cran côté stepper seulement.
   */
  numberOf(key: DiagnosticStepKey): number {
    return this.steps.find((s) => s.key === key)?.number ?? 0;
  }

  goPrevious(): void {
    const idx = this.steps.findIndex((s) => s.key === this.activeStep);
    if (idx > 0) this.stepChanged.emit(this.steps[idx - 1].key);
  }
  goNext(): void {
    // Garde UI : ne jamais avancer tant que « Suivant » est bloqué (défense en
    // profondeur — le bouton est déjà [disabled]).
    if (this.nextBlockedReason) return;
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
