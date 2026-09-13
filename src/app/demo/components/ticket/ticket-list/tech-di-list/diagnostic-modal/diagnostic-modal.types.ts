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
import { TreeNode } from 'primeng/api';

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

/** Per-service contact (Achat / Technique / Financier) on a company. */
export interface CompanyServiceContact {
  readonly name?: string;
  readonly email?: string;
  readonly phone?: string;
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
  /** Retour cycle # (0 / undefined = original flow). Drives the retour badge. */
  readonly ignoreCount?: number;
  /** 'company' when `company_id` is the resolvable entity, 'client' when
   *  `client_id` is, null when neither — drives which contact block the
   *  sidebar renders (3 service contacts vs. a single phone). */
  readonly entityType?: 'company' | 'client' | null;
  /** Company-side contacts — only populated when entityType === 'company'. */
  readonly serviceAchat?: CompanyServiceContact;
  readonly serviceTechnique?: CompanyServiceContact;
  readonly serviceFinancier?: CompanyServiceContact;
  /** Previous-cycle remarks — pre-fill the diagnostic remark fields on a
   *  retour so the tech sees what the previous tech/coordinator wrote. */
  readonly remarqueTechDiagnostic?: string;
  readonly remarqueTechReparation?: string;
  /** Creation photo. `imageUrl` = the backend proxy that streams the Drive file
   *  (embeddable in <img>); empty when the DI has no image. `imageViewUrl` = the
   *  Drive viewer link (fallback "open in new tab" if the proxy can't serve). */
  readonly imageUrl?: string;
  readonly imageViewUrl?: string;
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
 * Diagnostic d'un cycle ANTÉRIEUR, affiché en lecture seule sur un retour.
 *
 * Lu sur la ligne `logsdis` de CE cycle, sans repli sur la DI : la DI est le
 * miroir du cycle courant, remis à zéro à l'entrée du retour. Une valeur
 * absente vaut `null` et s'affiche « Non renseigné ».
 */
export interface DiagnosticPreviousCycle {
  /** 0 = flux original, 1..3 = retour n. */
  readonly cycle: number;
  readonly label: string;
  /** Id BRUT de la catégorie du cycle. Le libellé est résolu à l'affichage :
   *  les catégories arrivent en asynchrone, souvent APRÈS ce calcul. */
  readonly categoryId: string | null;
  readonly reparable: boolean | null;
  readonly pdr: boolean | null;
  /** Question posée aux seuls cycles retour — toujours `null` au cycle 0. */
  readonly errorFromFixtronix: boolean | null;
  readonly composants: readonly ComposantEntry[];
  readonly remarqueDiagnostic: string;
  readonly remarqueReparation: string;
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
  /**
   * Arbre « Catégorie → Composant » du picker (étape 3).
   *
   * ⚠️ À ne pas confondre avec `categories` juste en dessous, qui est la
   * catégorie de la DI (`di_category_id`, étape 2) — deux référentiels
   * DIFFÉRENTS qui portaient jusqu'ici des noms trop proches.
   */
  readonly composantNodes: readonly TreeNode[];
  /** Chargement de l'arbre / d'une branche en cours. */
  readonly composantTreeLoading: boolean;
  /** Recherche serveur en vol (≥ 2 caractères saisis). */
  readonly composantSearching: boolean;
  /** Catégories de DI — étape « Panne », PAS le picker de composants. */
  readonly categories: readonly CategoryOption[];
  readonly disabledFinish: boolean;
  readonly disabledRetour: boolean;
  readonly retourSendFinished: boolean;
  /** Diagnostics des cycles antérieurs, du plus récent au plus ancien. Vide
   *  hors retour. Lecture seule : rien n'en est repris dans le formulaire. */
  readonly previousCycles: readonly DiagnosticPreviousCycle[];
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
