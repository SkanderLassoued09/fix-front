/**
 * Strict types for the diagnostic-modal component tree.
 *
 * The parent component (`tech-di-list`) keeps owning the FormGroup, timer
 * state, mutations, and Apollo subscriptions — those stay in the existing
 * 2,838-LOC service-rich component. This tree is the pure-UI shell: it
 * receives data via Inputs and emits user intent via Outputs.
 *
 * Nothing in the new tree imports `any` directly — legacy `any` only
 * surfaces at the `tech-di-list` boundary when the parent maps its
 * loosely-typed state into these strict shapes.
 */

import { FormGroup } from '@angular/forms';

/** Five-step wizard keys. Used for typed Output emissions + stepper state. */
export type DiagnosticStepKey =
  | 'info'
  | 'failure'
  | 'components'
  | 'validation'
  | 'summary';

/** Per-step display state — drives the left-sidebar marker (✓ / current / À faire). */
export type DiagnosticStepState = 'completed' | 'current' | 'pending';

export interface DiagnosticStep {
  readonly key: DiagnosticStepKey;
  readonly number: number;
  readonly label: string;
  readonly hint: string;
  readonly state: DiagnosticStepState;
}

/** Header timer chip data. */
export interface TimerDisplayState {
  readonly display: string; // formatted "HH:MM:SS"
  readonly isRunning: boolean;
}

/** Lightweight DI summary surfaced into the modal chrome (info strip + sidebar). */
export interface DiagnosticDiSummary {
  readonly _id: string;
  readonly _idnum: string;
  readonly title: string;
  readonly description: string;
  readonly status: string;
  readonly statusLabel: string;
  readonly clientName: string;
  readonly clientPhone: string;
  readonly companyName: string;
  readonly locationName: string;
  readonly technicianName: string;
  readonly remarqueManager: string;
}

export interface ComposantOption {
  readonly _id: string;
  readonly name: string;
}

export interface CategoryOption {
  readonly _id: string;
  readonly category: string;
}

export interface ComposantEntry {
  readonly nameComposant: string;
  readonly quantity: number;
}

/**
 * Composable context object passed through the tree. Snapshot-style — the
 * parent rebuilds this every time inputs change so the OnPush descendants
 * can rely on reference equality for cheap change detection.
 */
export interface DiagnosticContext {
  readonly di: DiagnosticDiSummary;
  readonly ignoreCount: number;
  readonly form: FormGroup;
  readonly timer: TimerDisplayState;
  readonly hasPdr: boolean;
  readonly isReperable: boolean;
  readonly isErrorFromFixtronix: boolean;
  readonly composantCombo: readonly ComposantEntry[];
  readonly composantOptions: readonly ComposantOption[];
  readonly categories: readonly CategoryOption[];
  readonly disabledFinish: boolean;
  readonly disabledRetour: boolean;
  readonly retourSendFinished: boolean;
}

/** Autosave hint shown in the footer — derived from form pristine/dirty + last persisted time. */
export interface AutosaveHint {
  readonly state: 'saved' | 'saving' | 'idle';
  readonly lastSavedAt: Date | null;
}

/** Aggregate progress used by the right sidebar progress ring. */
export interface DiagnosticProgress {
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly percent: number; // 0–100
}

/**
 * One row in the sidebar's bottom "Décisions / Clôture" block.
 * Shared by both the diagnostic and repair modals — diagnostic defaults to
 * the legacy { Pièce réparable, Contient PDR } pair when nothing is passed;
 * repair passes { Sous garantie ?, Temps passé }.
 */
export interface SidebarDecision {
  readonly icon: string;          // PrimeNG icon suffix (e.g. 'pi-wrench')
  readonly label: string;         // "Pièce réparable ?"
  readonly value: string;         // "Oui" / "Non" / "Non défini"
  readonly faded?: boolean;       // true when the value is unset/placeholder
}
