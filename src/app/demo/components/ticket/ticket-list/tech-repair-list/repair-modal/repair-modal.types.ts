/**
 * Strict types for the repair-modal component tree.
 *
 * Mirrors the diagnostic-modal types so that the shared shell components
 * (header, info-strip, stepper, sidebar, timer) can be reused as-is —
 * we just feed them the repair-specific labels and payload.
 *
 * The repair parent (`tech-repair-list`) owns the FormGroup, timer state,
 * and Apollo mutations; this tree is the pure-UI shell.
 */

import { FormGroup } from '@angular/forms';
import {
  CategoryOption,
  DiagnosticDiSummary,
  TimerDisplayState,
} from '../../tech-di-list/diagnostic-modal/diagnostic-modal.types';

/** Five-step wizard keys for the repair flow. */
export type RepairStepKey =
  | 'info'        // Informations générales
  | 'plan'        // Plan d'intervention
  | 'parts'       // Pièces utilisées
  | 'works'       // Travaux & tests
  | 'summary';    // Résumé

/** Per-step display state — drives the left-sidebar marker (✓ / current / À faire). */
export type RepairStepState = 'completed' | 'current' | 'pending';

export interface RepairStep {
  readonly key: RepairStepKey;
  readonly number: number;
  readonly label: string;
  readonly hint: string;
  readonly state: RepairStepState;
}

/** A single part line used in step 3 (Pièces utilisées). */
export interface RepairPartOption {
  readonly _id: string;
  readonly name: string;
  readonly reference: string;
}

export interface RepairPartEntry {
  readonly nameComposant: string;
  readonly reference: string;
  readonly quantity: number;
}

/**
 * Composable context object passed through the tree. Snapshot-style — the
 * parent rebuilds this every time inputs change so the OnPush descendants
 * can rely on reference equality for cheap change detection.
 */
export interface RepairContext {
  readonly di: DiagnosticDiSummary;
  readonly form: FormGroup;
  readonly timer: TimerDisplayState;
  readonly partOptions: readonly RepairPartOption[];
  readonly parts: readonly RepairPartEntry[];
  readonly categories: readonly CategoryOption[];
  readonly disabledFinish: boolean;
}

/** Aggregate progress used by the right sidebar progress ring. */
export interface RepairProgress {
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly percent: number; // 0–100
}

/** Three-state badge value used in the summary step (Oui / Non / Non défini). */
export type RepairBadgeValue = 'Oui' | 'Non' | 'Non défini';
