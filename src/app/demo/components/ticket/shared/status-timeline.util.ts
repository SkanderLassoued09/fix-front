/**
 * SOURCE UNIQUE du calcul de durées entre statuts (à partir de `statusHistory`).
 *
 * Extrait tel quel du modal Coordination (`coordinator-di-list`) pour être
 * RÉUTILISÉ — jamais réimplémenté — par le modal détail DI (`di-info-modal`).
 * Fonctions PURES : elles prennent l'historique en paramètre (aucun `this`), ce
 * qui permet de les appliquer soit à l'historique COMPLET (coordinateur), soit à
 * une TRANCHE par cycle de retour (dossier détaillé, option « dossier par cycle »).
 */

import {
  DateInput,
  fmtDateTime,
  fmtDurationPrecise,
  hhmmssToMs,
  toDateTime,
  toEpochMs,
} from '../../../../shared/date-time.util';

export interface StatusHistoryEntry {
  status: string;
  at: Date;
  /** Entrée reconstruite par le backfill (migration 011), pas observée. */
  reconstructed?: boolean;
}

export interface PhaseDuration {
  text: string;
  ongoing: boolean;
  /** Delta en millisecondes — permet au consommateur de tester un seuil
   *  (ex. durée anormale > 48 h). `null`/absent quand la durée n'est pas bornée. */
  ms: number | null;
}

export type PhaseState = 'done' | 'current' | 'pending' | 'skipped';

/** Ordre canonique des statuts — décide si une phase est « derrière » le curseur
 *  (done/sautée) vs « devant » (en attente). Legacy inclus, ordonnés pour que le
 *  DERNIER sous-statut d'une phase porte l'index le plus élevé. */
export const ALL_STATUS_ORDER: string[] = [
  'CREATED',
  'PENDING1',
  'DIAGNOSTIC',
  'DIAGNOSTIC_Pause',
  'INDIAGNOSTIC',
  'MagasinEstimation',
  'PROCESSING',
  'CONFIRMATION',
  'CONFIRMATION_COMPOSANTS',
  'ATTENTE_CONFIRMATION_COORDINATION',
  'MAGASIN_FINALISATION',
  'PENDING2',
  'PRICING',
  'PRICING_DIAG',
  'NEGOTIATION1',
  'ATTENTE_BC_DEVIS',
  'WAITING_DEVIS',
  'WAITING_BC',
  'NEGOTIATION2',
  'PENDING3',
  'REPARATION',
  'REPARATION_Pause',
  'INREPARATION',
  'ATTENTE_BL_FACTURE',
  'CLOSING',
  'WAITING_BL',
  'WAITING_FACTURE',
  'FINISHED',
  'IRREPARABLE',
  'RETOUR1',
  'RETOUR2',
  'RETOUR3',
];

export interface PhaseDef {
  key: string;
  group: string;
  label: string;
  icon: string;
  statuses: string[];
}

/** UN statut par étape (ordre du flux). Retour 1/2/3 ajoutés dynamiquement par
 *  le consommateur. `statuses` = jeu d'appariement (legacy + variantes `_Pause`),
 *  ORDONNÉ pour que le DERNIER élément ait l'index le plus élevé dans
 *  ALL_STATUS_ORDER (ancre du seuil done/pending). */
export const BASE_PHASES: PhaseDef[] = [
  { key: 'CREATED', group: 'created', label: 'Créé', icon: 'pi pi-plus-circle', statuses: ['CREATED'] },
  { key: 'PENDING1', group: 'diagnostic', label: 'En attente diagnostic', icon: 'pi pi-clipboard', statuses: ['PENDING1'] },
  { key: 'DIAGNOSTIC', group: 'diagnostic', label: 'Diagnostic assigné', icon: 'pi pi-clipboard', statuses: ['DIAGNOSTIC'] },
  { key: 'DIAGNOSTIC_Pause', group: 'diagnostic', label: 'Diagnostic en pause', icon: 'pi pi-pause-circle', statuses: ['DIAGNOSTIC_Pause'] },
  { key: 'INDIAGNOSTIC', group: 'diagnostic', label: 'En diagnostic', icon: 'pi pi-clipboard', statuses: ['INDIAGNOSTIC'] },
  { key: 'MagasinEstimation', group: 'magasin', label: 'Estimation magasin', icon: 'pi pi-box', statuses: ['MagasinEstimation'] },
  { key: 'CONFIRMATION', group: 'magasin', label: 'CONFIRMATION', icon: 'pi pi-box', statuses: ['PROCESSING', 'CONFIRMATION'] },
  { key: 'ATTENTE_CONFIRMATION_COORDINATION', group: 'magasin', label: 'En attente confirmation Coordination', icon: 'pi pi-box', statuses: ['CONFIRMATION_COMPOSANTS', 'ATTENTE_CONFIRMATION_COORDINATION'] },
  { key: 'MAGASIN_FINALISATION', group: 'magasin', label: 'Finalisation magasin', icon: 'pi pi-box', statuses: ['MAGASIN_FINALISATION'] },
  { key: 'PENDING2', group: 'admin', label: 'En attente prix', icon: 'pi pi-file', statuses: ['PENDING2'] },
  { key: 'PRICING_DIAG', group: 'admin', label: 'PRICING', icon: 'pi pi-file', statuses: ['PRICING', 'PRICING_DIAG'] },
  { key: 'WAITING_DEVIS', group: 'admin', label: 'Approval (devis/BC)', icon: 'pi pi-file', statuses: ['NEGOTIATION1', 'ATTENTE_BC_DEVIS', 'WAITING_DEVIS', 'WAITING_BC'] },
  { key: 'NEGOTIATION2', group: 'admin', label: 'Négociation 2', icon: 'pi pi-file', statuses: ['NEGOTIATION2'] },
  { key: 'PENDING3', group: 'repair', label: 'En attente réparation', icon: 'pi pi-wrench', statuses: ['PENDING3'] },
  { key: 'REPARATION', group: 'repair', label: 'Réparation assignée', icon: 'pi pi-wrench', statuses: ['REPARATION'] },
  { key: 'REPARATION_Pause', group: 'repair', label: 'Réparation en pause', icon: 'pi pi-pause-circle', statuses: ['REPARATION_Pause'] },
  { key: 'INREPARATION', group: 'repair', label: 'En réparation', icon: 'pi pi-wrench', statuses: ['INREPARATION'] },
  { key: 'WAITING_BL', group: 'closed', label: 'Clôture (BL/facture)', icon: 'pi pi-check-circle', statuses: ['ATTENTE_BL_FACTURE', 'CLOSING', 'WAITING_BL', 'WAITING_FACTURE'] },
  { key: 'FINISHED', group: 'closed', label: 'Terminé', icon: 'pi pi-check-circle', statuses: ['FINISHED'] },
  { key: 'IRREPARABLE', group: 'closed', label: 'Irréparable', icon: 'pi pi-ban', statuses: ['IRREPARABLE'] },
];

/** `statusHistory` nettoyé + trié chronologiquement. Ignore les entrées
 *  malformées (statut non-string, date absente/invalide) pour ne jamais planter. */
export function sanitizeHistory(raw: any): StatusHistoryEntry[] {
  const arr: any[] = Array.isArray(raw) ? raw : [];
  return arr
    .filter((h) => h && typeof h.status === 'string' && h.at != null)
    .map((h) => ({
      status: h.status as string,
      at: new Date(h.at),
      reconstructed: h.reconstructed === true,
    }))
    .filter((h) => !Number.isNaN(h.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Phase à laquelle appartient un statut brut (null si inconnu). */
export function phaseOfStatus(status: string): PhaseDef | null {
  return BASE_PHASES.find((p) => p.statuses.includes(status)) ?? null;
}

/** 1re entrée d'historique dont le statut appartient à la phase. Source COMMUNE
 *  de la date ET de la valeur brute (la MÊME entrée stockée — aucun recalcul). */
export function phaseEntry(
  history: StatusHistoryEntry[],
  phaseKey: string,
): StatusHistoryEntry | null {
  const phase = BASE_PHASES.find((p) => p.key === phaseKey);
  if (!phase) return null;
  return history.find((h) => phase.statuses.includes(h.status)) ?? null;
}

export function phaseEntryRawDate(
  history: StatusHistoryEntry[],
  phaseKey: string,
): Date | null {
  return phaseEntry(history, phaseKey)?.at ?? null;
}

/** Le DERNIER statut de l'étape est-il AVANT le statut courant dans l'ordre
 *  canonique (étape « derrière » le curseur) ? */
export function isPhaseBehindCurrent(
  phase: { statuses: string[] },
  status: string,
): boolean {
  const lastIdx = ALL_STATUS_ORDER.indexOf(
    phase.statuses[phase.statuses.length - 1],
  );
  const currentIdx = ALL_STATUS_ORDER.indexOf(status);
  return currentIdx > lastIdx;
}

/** État d'une phase : current / done / skipped / pending. `isActive=false` pour
 *  un segment d'historique (pas d'entrée par phase → ordre seul, best-effort). */
export function computePhaseState(
  history: StatusHistoryEntry[],
  phase: { key: string; statuses: string[] },
  status: string,
  isActive = true,
): PhaseState {
  if (!status) return 'pending';
  if (phase.statuses.includes(status)) return 'current';
  const behind = isPhaseBehindCurrent(phase, status);
  if (isActive) {
    if (phaseEntry(history, phase.key)) return 'done';
    return behind ? 'skipped' : 'pending';
  }
  return behind ? 'done' : 'pending';
}

/** Durée passée dans une phase, dérivée des `at` de `statusHistory`.
 *  - `done`    → jusqu'à l'entrée de la 1re phase suivante atteinte (figé) ;
 *  - `current` → depuis l'entrée jusqu'à `now` (« en cours ») ;
 *  - `pending`/`skipped`/entrée absente/pas de borne → null (affiché « — »). */
export function computePhaseDuration(
  history: StatusHistoryEntry[],
  phaseKey: string,
  state: PhaseState,
  now: number = Date.now(),
): PhaseDuration | null {
  if (state === 'pending' || state === 'skipped') return null;
  const entry = phaseEntry(history, phaseKey);
  if (!entry) return null;
  const start = entry.at;
  if (state === 'current') {
    const ms = now - start.getTime();
    return { text: formatDuration(ms), ongoing: true, ms };
  }
  // Borne de fin = la prochaine entrée DANS LE TEMPS appartenant à une AUTRE
  // phase.
  //
  // Auparavant on parcourait l'ordre CANONIQUE `BASE_PHASES` avec un `>` strict.
  // Or l'ordre réel n'est pas l'ordre canonique : le flux est
  // `DIAGNOSTIC → INDIAGNOSTIC → DIAGNOSTIC_Pause`, alors que la liste place la
  // pause AVANT `INDIAGNOSTIC`. La borne était donc sautée et on tombait sur la
  // phase d'après — le MÊME intervalle était attribué à DEUX lignes (« 2 h 2 min »
  // affiché deux fois sur T1455). Deux entrées au même instant produisaient le
  // même double comptage, le `>` strict les écartant aussi.
  const startIdx = history.indexOf(entry);
  for (let j = startIdx + 1; j < history.length; j++) {
    // Même phase (ex. doublon `PRICING_DIAG` poussé deux fois par le middleware)
    // → ce n'est pas une sortie de phase, on continue.
    if (phaseOfStatus(history[j].status)?.key === phaseKey) continue;
    const ms = Math.max(0, history[j].at.getTime() - entry.at.getTime());
    return { text: formatDuration(ms), ongoing: false, ms };
  }
  return null;
}

/** Millisecondes → durée humaine FR compacte : « 2 j 4 h », « 3 h 15 min »,
 *  « 12 min », « moins d'1 min ». DELTA → indépendant du fuseau. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 1) return "moins d'1 min";
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return hours > 0 ? `${days} j ${hours} h` : `${days} j`;
  if (hours > 0) return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
  return `${mins} min`;
}

/** Date FR courte (Africa/Tunis) « dd/MM/yyyy HH:mm » — même rendu que le modal
 *  Coordination. Chaîne vide/absente/invalide → null. Passe par Luxon : même
 *  sortie qu'avant pour toute date déjà lisible, et les chaînes de pause
 *  héritées (`yyyy/MM/dd:HH:mm:ss`) ne sont plus lues au mauvais jour. */
export function formatTimelineDate(at: any): string | null {
  if (!at) return null;
  const dt = toDateTime(at);
  return dt ? dt.toFormat('dd/MM/yyyy HH:mm') : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers spécifiques au dossier détaillé (di-info-modal) — construits SUR les
// fonctions pures ci-dessus, donc cohérents avec le modal Coordination.
// ─────────────────────────────────────────────────────────────────────────────

export interface TimelineRow {
  key: string;
  label: string;
  rawStatus: string;
  date: string | null;
  duration: PhaseDuration | null;
  state: PhaseState;
  /** Durée anormale (dépasse le seuil) — rendu en rouge. */
  anomalous: boolean;
  /** L'entrée d'origine est une reconstruction, pas une transition observée. */
  reconstructed?: boolean;
}

/**
 * Découpe l'historique COMPLET en TRANCHES par cycle de retour, en coupant à
 * chaque transition `RETOUR1/2/3`. Index 0 = flux original ; index N = cycle
 * après le N-ième retour (la transition RETOUR{N} OUVRE le cycle N). Retourne au
 * moins `[ [] ]`. Les cycles sans entrée restent des tableaux vides.
 */
export function sliceHistoryByCycle(raw: any): StatusHistoryEntry[][] {
  const hist = sanitizeHistory(raw);
  const segments: StatusHistoryEntry[][] = [[]];
  let idx = 0;
  for (const e of hist) {
    const m = /^RETOUR([123])$/.exec(e.status);
    if (m) idx = Number(m[1]);
    if (!segments[idx]) segments[idx] = [];
    segments[idx].push(e);
  }
  return segments;
}

/**
 * Construit la liste « Écart entre statuts » d'un cycle : une ligne par étape
 * RÉELLEMENT atteinte (entrée présente dans la tranche), avec statut brut, date
 * et durée jusqu'à l'étape suivante. Réutilise `computePhaseDuration` (donc le
 * même calcul que le modal Coordination). `currentStatus` = statut vivant de la
 * DI pour le cycle ACTIF (sinon `null` → cycle clos, tout figé). Une durée
 * dépassant `anomalyThresholdMs` (borné, non « en cours ») est marquée anormale.
 */
export function buildCycleTimeline(
  historySlice: StatusHistoryEntry[],
  currentStatus: string | null,
  anomalyThresholdMs: number,
  now: number = Date.now(),
): TimelineRow[] {
  const rows: TimelineRow[] = [];

  // On parcourt l'HISTORIQUE, pas la liste canonique des phases.
  //
  // Émettre dans l'ordre de `BASE_PHASES` affichait une chronologie FAUSSE — la
  // pause apparaissait au-dessus de `INDIAGNOSTIC` alors qu'elle a eu lieu
  // après — et ne gardait qu'UNE ligne par phase, rendant invisibles les
  // allers-retours pause/reprise pourtant bien enregistrés.
  for (let i = 0; i < historySlice.length; i++) {
    const entry = historySlice[i];
    const phase = phaseOfStatus(entry.status);
    if (!phase) continue; // statut hors nomenclature → ignoré

    // Doublon consécutif de la même phase (le middleware Mongoose pousse une
    // entrée dès que `status` est PRÉSENT dans l'update, pas seulement quand il
    // CHANGE) : on garde la première et on prolonge jusqu'à la sortie réelle.
    if (i > 0 && phaseOfStatus(historySlice[i - 1].status)?.key === phase.key) {
      continue;
    }

    // Sortie de phase = prochaine entrée d'une AUTRE phase.
    let exitAt: Date | null = null;
    for (let j = i + 1; j < historySlice.length; j++) {
      if (phaseOfStatus(historySlice[j].status)?.key !== phase.key) {
        exitAt = historySlice[j].at;
        break;
      }
    }

    // « En cours » = on n'est jamais ressorti de cette phase ET c'est bien le
    // statut vivant de la DI.
    const isCurrent =
      exitAt === null &&
      !!currentStatus &&
      phase.statuses.includes(currentStatus);
    const state: PhaseState = isCurrent ? 'current' : 'done';

    const ms = isCurrent
      ? now - entry.at.getTime()
      : exitAt
        ? Math.max(0, exitAt.getTime() - entry.at.getTime())
        : null;
    const duration =
      ms === null
        ? null
        : { text: formatDuration(ms), ongoing: isCurrent, ms };

    rows.push({
      key: phase.key,
      label: phase.label,
      rawStatus: entry.status,
      date: formatTimelineDate(entry.at),
      duration,
      state,
      anomalous:
        !!duration && !duration.ongoing && duration.ms > anomalyThresholdMs,
      reconstructed: entry.reconstructed === true,
    });
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Journal BRUT des transitions — complément de `buildCycleTimeline`
// ─────────────────────────────────────────────────────────────────────────────

/** Une transition telle qu'elle a été ENREGISTRÉE, sans regroupement. */
export interface RawTimelineRow {
  /** Rang chronologique dans l'historique complet (stable, sert de clé). */
  index: number;
  rawStatus: string;
  /** Libellé de la phase correspondante, ou le statut brut si inconnu. */
  label: string;
  at: Date;
  date: string | null;
  /** Cycle de retour auquel appartient la transition (0 = flux original). */
  cycle: number;
  /** Durée jusqu'à la transition SUIVANTE (ou jusqu'à maintenant si dernière). */
  duration: PhaseDuration | null;
  anomalous: boolean;
  /** L'entrée est une reconstruction (backfill), pas une observation. */
  reconstructed?: boolean;
}

/** Libellé lisible d'un statut brut (repli : le statut lui-même). */
export function labelForStatus(status: string): string {
  const phase = BASE_PHASES.find((p) => p.statuses.includes(status));
  if (phase) return phase.label;
  const m = /^RETOUR([123])$/.exec(status);
  if (m) return `Retour ${m[1]}`;
  if (status === 'ANNULER') return 'Annulée';
  return status;
}

/**
 * Journal CHRONOLOGIQUE et EXHAUSTIF de `statusHistory`.
 *
 * `buildCycleTimeline` répond à « combien de temps a duré chaque ÉTAPE » : il
 * ne garde donc qu'UNE ligne par phase (la première occurrence). Les
 * allers-retours — pause/reprise de diagnostic, repassages en réparation — y
 * sont invisibles alors qu'ils sont bel et bien enregistrés.
 *
 * Cette fonction répond à l'autre question, « que s'est-il passé, dans
 * l'ordre » : une ligne PAR transition, chacune datée, rattachée à son cycle de
 * retour, avec la durée jusqu'à la suivante. Les deux vues sont
 * complémentaires — celle-ci n'en remplace aucune.
 */
export function buildRawTimeline(
  raw: any,
  anomalyThresholdMs: number,
  now: number = Date.now(),
): RawTimelineRow[] {
  const hist = sanitizeHistory(raw);
  let cycle = 0;
  return hist.map((entry, i) => {
    const m = /^RETOUR([123])$/.exec(entry.status);
    // La transition RETOUR{N} OUVRE le cycle N — même convention que
    // `sliceHistoryByCycle`, pour que les deux vues concordent.
    if (m) cycle = Number(m[1]);
    const next = hist[i + 1];
    const ms = (next ? next.at.getTime() : now) - entry.at.getTime();
    const ongoing = !next;
    const duration: PhaseDuration | null =
      Number.isFinite(ms) && ms >= 0
        ? { text: formatDuration(ms), ongoing, ms }
        : null;
    return {
      index: i,
      rawStatus: entry.status,
      label: labelForStatus(entry.status),
      at: entry.at,
      date: formatTimelineDate(entry.at),
      cycle,
      duration,
      anomalous: !ongoing && ms > anomalyThresholdMs,
      reconstructed: entry.reconstructed === true,
    };
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Parcours des statuts + chrono de travail (onglet « Temps & chrono »)
//
// Toutes les durées sont EXACTES à la milliseconde et dérivées d'horodatages
// SERVEUR (`statusHistory.at`, `Stat.diagSegments`). Aucune durée envoyée par un
// navigateur n'entre dans ces calculs, sauf le repli explicitement marqué
// « approximatif » des pauses héritées (`buildLegacyPauseRows`).
// ═════════════════════════════════════════════════════════════════════════════

export type StatusGroup =
  | 'created'
  | 'diagnostic'
  | 'magasin'
  | 'admin'
  | 'repair'
  | 'closed'
  | 'retour'
  | 'cancelled'
  | 'other';

export const GROUP_LABELS: Record<StatusGroup, string> = {
  created: 'Création',
  diagnostic: 'Diagnostic',
  magasin: 'Magasin',
  admin: 'Administration / devis',
  repair: 'Réparation',
  closed: 'Clôture',
  retour: 'Retour',
  cancelled: 'Annulation',
  other: 'Autre',
};

/** Statuts après lesquels il ne se passe plus rien : la dernière étape n'a pas
 *  de durée qui « court » (sinon un dossier terminé grossirait indéfiniment). */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  'FINISHED',
  'IRREPARABLE',
  'ANNULER',
]);

export const PAUSE_STATUSES: ReadonlySet<string> = new Set([
  'DIAGNOSTIC_Pause',
  'REPARATION_Pause',
]);

export function statusGroupOf(status: string): StatusGroup {
  const g = phaseOfStatus(status)?.group;
  if (g) return g as StatusGroup;
  if (/^RETOUR[123]$/.test(status)) return 'retour';
  if (status === 'ANNULER') return 'cancelled';
  // Valeur héritée de la phase magasin (avant le handshake v2), absente de
  // BASE_PHASES : sans elle, le parcours affichait un bloc « Autre ».
  if (status === 'INMAGASIN') return 'magasin';
  return 'other';
}

/** Même état métier : valeur identique, ou même phase (PRICING hérité ≡
 *  PRICING_DIAG, renommage sans backfill). */
function sameState(a: string, b: string): boolean {
  if (a === b) return true;
  const pa = phaseOfStatus(a)?.key;
  return !!pa && pa === phaseOfStatus(b)?.key;
}

const pct1 = (p: number) => p.toFixed(1).replace('.', ',');

// ── Découpage par cycle, tolérant aux historiques incomplets ────────────────

export interface CycleHistorySlice {
  entries: StatusHistoryEntry[];
  /** Ouverture du cycle SUIVANT : borne de fin d'un cycle clos. */
  boundaryAt: Date | null;
  /** Début déduit de la ligne `logsdis` du cycle, faute d'entrée RETOUR{n}. */
  inferredStart: boolean;
  /** Aucun moyen de dater le début de ce cycle. */
  unknownStart: boolean;
}

/**
 * Tranche d'historique d'UN cycle.
 *
 * `sliceHistoryByCycle` coupe sur les entrées `RETOUR{n}` — or près de la
 * moitié des DI en retour n'en ont PAS (historique antérieur au hook, ou retour
 * posé sans passer par le statut RETOUR{n}) : tout tombait alors dans le cycle
 * 0 et le retour affiché, ouvert par défaut, paraissait vide. Faute d'entrée, on
 * coupe à `cycleStartHints[n]` (ouverture de la ligne `logsdis` du cycle) et on
 * le SIGNALE (`inferredStart`). Avec toutes les entrées RETOUR présentes, le
 * résultat est identique à `sliceHistoryByCycle`.
 */
export function sliceHistoryForCycle(
  raw: any,
  cycle: number,
  cycleCount: number,
  cycleStartHints: ReadonlyArray<DateInput> = [],
): CycleHistorySlice {
  const hist = sanitizeHistory(raw);
  const count = Math.max(0, cycleCount, cycle);
  type Start = { idx: number; at: number | null; inferred: boolean };
  // Les entrées RETOUR{n} OBSERVÉES priment : une date déduite ne peut pas
  // les contredire.
  const real: Array<number | null> = [0];
  for (let n = 1; n <= count; n++) {
    const i = hist.findIndex((e) => e.status === `RETOUR${n}`);
    real[n] = i >= 0 ? i : null;
  }
  const starts: Array<Start | null> = [{ idx: 0, at: null, inferred: false }];
  let lastIdx = 0;
  for (let n = 1; n <= count; n++) {
    let start: Start | null = null;
    const i = real[n];
    if (i !== null) {
      // Une entrée hors d'ordre (RETOUR2 avant RETOUR1) est incohérente.
      if (i >= lastIdx) start = { idx: i, at: hist[i].at.getTime(), inferred: false };
    } else {
      const hint = toEpochMs(cycleStartHints[n]);
      if (hint !== null) {
        const found = hist.findIndex((e) => e.at.getTime() >= hint);
        const j = found < 0 ? hist.length : found;
        let upper = hist.length;
        for (let m = n + 1; m <= count; m++) {
          if (real[m] !== null) {
            upper = real[m] as number;
            break;
          }
        }
        if (j >= lastIdx && j <= upper) start = { idx: j, at: hint, inferred: true };
      }
    }
    if (start) lastIdx = start.idx;
    starts[n] = start;
  }

  const cur = starts[Math.max(0, cycle)];
  if (!cur) {
    return { entries: [], boundaryAt: null, inferredStart: false, unknownStart: true };
  }
  let next: Start | null = null;
  for (let m = cycle + 1; m <= count; m++) {
    if (starts[m]) {
      next = starts[m];
      break;
    }
  }
  const end = next ? next.idx : hist.length;
  return {
    entries: hist.slice(cur.idx, Math.max(cur.idx, end)),
    boundaryAt: next && next.at !== null ? new Date(next.at) : null,
    inferredStart: cur.inferred,
    unknownStart: false,
  };
}

// ── Parcours des statuts ────────────────────────────────────────────────────

export type FlowEndKind = 'next' | 'boundary' | 'ongoing' | 'terminal' | 'unknown';

export interface StatusFlowStep {
  index: number;
  status: string;
  label: string;
  group: StatusGroup;
  isPause: boolean;
  enteredAt: Date;
  /** Instant de sortie (entrée suivante, ou ouverture du cycle suivant). */
  leftAt: Date | null;
  /** Temps passé dans l'étape ; `null` quand il n'est pas borné. */
  ms: number | null;
  endKind: FlowEndKind;
  ongoing: boolean;
  reconstructed: boolean;
  /** Nombre d'entrées identiques consécutives fusionnées (middleware). */
  dupCount: number;
  /** Écart clos au-delà du seuil d'anomalie. */
  long: boolean;
}

export interface StatusFlow {
  steps: StatusFlowStep[];
  startAt: Date | null;
  endAt: Date | null;
  /** Amplitude = somme exacte des écarts bornés. */
  spanMs: number;
  ongoing: boolean;
  /** Le statut vivant n'a pas d'entrée d'historique correspondante. */
  currentMismatch: boolean;
}

/**
 * Parcours d'un cycle, étape par étape, avec l'écart EXACT jusqu'à l'étape
 * suivante. Contrairement à `buildCycleTimeline` (une ligne par PHASE), chaque
 * changement réel est gardé — pause/reprise comprises ; seuls les doublons
 * STRICTS consécutifs (même valeur réécrite) sont fusionnés.
 *
 * Fin de la dernière étape : ouverture du cycle suivant (`boundaryAt`, cycle
 * clos) → statut final → « en cours » si c'est bien le statut vivant → sinon
 * inconnue. Invariant : Σ ms = spanMs.
 */
export function buildStatusFlow(
  entries: StatusHistoryEntry[],
  currentStatus: string | null,
  boundaryAt: Date | null,
  now: number = Date.now(),
  longMs: number = Number.POSITIVE_INFINITY,
): StatusFlow {
  const hist = (Array.isArray(entries) ? entries : [])
    .filter(
      (e) =>
        e &&
        typeof e.status === 'string' &&
        e.at instanceof Date &&
        !Number.isNaN(e.at.getTime()),
    )
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const merged: Array<{
    status: string;
    at: Date;
    reconstructed: boolean;
    dupCount: number;
  }> = [];
  for (const e of hist) {
    const last = merged[merged.length - 1];
    if (last && last.status === e.status) {
      last.dupCount++;
      last.reconstructed = last.reconstructed || e.reconstructed === true;
      continue;
    }
    merged.push({
      status: e.status,
      at: e.at,
      reconstructed: e.reconstructed === true,
      dupCount: 1,
    });
  }

  let currentMismatch = false;
  const steps: StatusFlowStep[] = merged.map((m, i) => {
    const next = merged[i + 1];
    let leftAt: Date | null = null;
    let ms: number | null = null;
    let endKind: FlowEndKind = 'unknown';
    let ongoing = false;
    if (next) {
      leftAt = next.at;
      ms = Math.max(0, next.at.getTime() - m.at.getTime());
      endKind = 'next';
    } else if (boundaryAt && !Number.isNaN(boundaryAt.getTime())) {
      leftAt = boundaryAt;
      ms = Math.max(0, boundaryAt.getTime() - m.at.getTime());
      endKind = 'boundary';
    } else if (TERMINAL_STATUSES.has(m.status)) {
      endKind = 'terminal';
    } else if (currentStatus && sameState(m.status, currentStatus)) {
      ongoing = true;
      ms = Math.max(0, now - m.at.getTime());
      endKind = 'ongoing';
    } else if (currentStatus) {
      currentMismatch = true;
    }
    return {
      index: i,
      status: m.status,
      label: labelForStatus(m.status),
      group: statusGroupOf(m.status),
      isPause: PAUSE_STATUSES.has(m.status),
      enteredAt: m.at,
      leftAt,
      ms,
      endKind,
      ongoing,
      reconstructed: m.reconstructed,
      dupCount: m.dupCount,
      long: !ongoing && ms !== null && ms > longMs,
    };
  });

  const first = steps[0];
  const last = steps[steps.length - 1];
  const ongoing = !!last?.ongoing;
  const startAt = first ? first.enteredAt : null;
  const endAt = last
    ? ongoing
      ? new Date(now)
      : last.leftAt ?? last.enteredAt
    : null;
  return {
    steps,
    startAt,
    endAt,
    spanMs: startAt && endAt ? Math.max(0, endAt.getTime() - startAt.getTime()) : 0,
    ongoing,
    currentMismatch,
  };
}

// ── Barre proportionnelle ───────────────────────────────────────────────────

export interface StatusBarBlock {
  key: string;
  kind: 'step' | 'cluster';
  group: StatusGroup | 'mixed';
  isPause: boolean;
  ongoing: boolean;
  ms: number;
  /** Part de l'amplitude, en %. */
  pct: number;
  count: number;
  title: string;
}

function stepTitle(s: StatusFlowStep, pct: number): string {
  const end = s.ongoing ? 'maintenant' : fmtDateTime(s.leftAt, { seconds: true });
  return `${s.label} · ${fmtDateTime(s.enteredAt, { seconds: true })} → ${end} · ${fmtDurationPrecise(s.ms)} (${pct1(pct)} %)`;
}

/**
 * Blocs de la barre « répartition du temps par statut ». Une suite d'étapes
 * minuscules (< `tinyRatio` de l'amplitude) est regroupée en un seul bloc :
 * 20 transitions de quelques secondes à côté d'une pause de 26 jours seraient
 * sinon autant de traits illisibles.
 */
export function buildStatusBar(flow: StatusFlow, tinyRatio = 0.004): StatusBarBlock[] {
  const steps = flow.steps.filter((s) => s.ms !== null);
  if (!steps.length) return [];
  const span = steps.reduce((a, s) => a + (s.ms as number), 0);
  if (span <= 0) {
    return steps.map((s) => ({
      key: `s${s.index}`,
      kind: 'step' as const,
      group: s.group,
      isPause: s.isPause,
      ongoing: s.ongoing,
      ms: 0,
      pct: 100 / steps.length,
      count: 1,
      title: stepTitle(s, 100 / steps.length),
    }));
  }

  const out: StatusBarBlock[] = [];
  let run: StatusFlowStep[] = [];
  const pushStep = (s: StatusFlowStep) => {
    const pct = ((s.ms as number) / span) * 100;
    out.push({
      key: `s${s.index}`,
      kind: 'step',
      group: s.group,
      isPause: s.isPause,
      ongoing: s.ongoing,
      ms: s.ms as number,
      pct,
      count: 1,
      title: stepTitle(s, pct),
    });
  };
  const flush = () => {
    if (run.length === 1) pushStep(run[0]);
    else if (run.length > 1) {
      const ms = run.reduce((a, s) => a + (s.ms as number), 0);
      const pct = (ms / span) * 100;
      const groups = new Set(run.map((s) => s.group));
      const a = run[0];
      const z = run[run.length - 1];
      const labels = run.map((s) => s.label);
      const shown = labels.length > 6 ? [...labels.slice(0, 6), '…'] : labels;
      out.push({
        key: `c${a.index}-${z.index}`,
        kind: 'cluster',
        group: groups.size === 1 ? a.group : 'mixed',
        isPause: false,
        ongoing: z.ongoing,
        ms,
        pct,
        count: run.length,
        title: `${run.length} étapes rapprochées (${shown.join(' → ')}) · ${fmtDurationPrecise(ms)} (${pct1(pct)} %) · du ${fmtDateTime(a.enteredAt, { seconds: true })} au ${z.ongoing ? 'maintenant' : fmtDateTime(z.leftAt, { seconds: true })}`,
      });
    }
    run = [];
  };
  for (const s of steps) {
    if ((s.ms as number) / span < tinyRatio) run.push(s);
    else {
      flush();
      pushStep(s);
    }
  }
  flush();
  return out;
}

export interface FlowGroupTotal {
  group: StatusGroup;
  label: string;
  ms: number;
  pct: number;
  /** Part de ce temps passée EN PAUSE. */
  pauseMs: number;
}

/** Temps total par grande phase, dans l'ordre de première apparition. */
export function summarizeFlowByGroup(flow: StatusFlow): FlowGroupTotal[] {
  const totals = new Map<StatusGroup, { ms: number; pauseMs: number }>();
  let all = 0;
  for (const s of flow.steps) {
    if (s.ms === null) continue;
    const t = totals.get(s.group) ?? { ms: 0, pauseMs: 0 };
    t.ms += s.ms;
    if (s.isPause) t.pauseMs += s.ms;
    totals.set(s.group, t);
    all += s.ms;
  }
  return [...totals.entries()].map(([group, t]) => ({
    group,
    label: GROUP_LABELS[group],
    ms: t.ms,
    pct: all > 0 ? (t.ms / all) * 100 : 0,
    pauseMs: t.pauseMs,
  }));
}

// ── Parcours simplifié (vue « utilisateur ») ────────────────────────────────
//
// Le même `StatusFlow`, lu par GRANDE PHASE : où en est le dossier, et où le
// temps est passé. Les pauses/reprises à la seconde restent consultables dans
// le détail technique ; ici elles sont fondues dans leur phase.

/** Libellés courants de la vue simplifiée (`GROUP_LABELS` reste celui du PDF). */
export const PLAIN_GROUP_LABELS: Record<StatusGroup, string> = {
  created: 'Création',
  diagnostic: 'Diagnostic',
  magasin: 'Magasin',
  admin: 'Devis & accord client',
  repair: 'Réparation',
  closed: 'Clôture',
  retour: 'Retour',
  cancelled: 'Annulation',
  other: 'Autre',
};

/** Ordre FIXE des phases : une ligne et sa couleur suivent la phase, jamais
 *  son rang dans le dossier. */
export const GROUP_ORDER: ReadonlyArray<StatusGroup> = [
  'retour',
  'created',
  'diagnostic',
  'magasin',
  'admin',
  'repair',
  'closed',
  'cancelled',
  'other',
];

export interface PhasePassage {
  key: string;
  group: StatusGroup;
  label: string;
  startAt: Date;
  /** Sortie de la phase ; `null` si elle court encore ou n'est pas bornée. */
  endAt: Date | null;
  /** Temps passé dans la phase (Σ des écarts bornés, statut final exclu). */
  ms: number;
  /** Au moins une étape du passage a une durée bornée. */
  timed: boolean;
  pauseMs: number;
  pauseCount: number;
  /** Changements de statut fondus dans ce passage. */
  changeCount: number;
  ongoing: boolean;
  /** Passage clos au-delà du seuil d'anomalie. */
  long: boolean;
  /** Statut final atteint dans ce passage (« Terminé », « Irréparable »…). */
  terminalLabel: string | null;
  terminalAt: Date | null;
}

/** Dernière étape sur un statut final : le temps qui la suit (jusqu'à
 *  l'ouverture du retour suivant) n'appartient à aucune phase du dossier —
 *  sans cette règle, « Clôture » durerait des mois. */
function isFinalStep(flow: StatusFlow, s: StatusFlowStep): boolean {
  return (
    s.index === flow.steps.length - 1 &&
    TERMINAL_STATUSES.has(s.status) &&
    (s.endKind === 'terminal' || s.endKind === 'boundary')
  );
}

/**
 * Passages successifs par grande phase : les étapes CONSÉCUTIVES d'une même
 * phase (allers-retours pause/reprise compris) forment un seul passage ; une
 * phase quittée puis reprise (Magasin → Devis → Magasin) en donne deux.
 *
 * Invariant : Σ ms + (`afterEndMs` de l'aperçu) = `flow.spanMs`.
 */
export function buildPhasePassages(
  flow: StatusFlow,
  longMs: number = Number.POSITIVE_INFINITY,
): PhasePassage[] {
  const out: PhasePassage[] = [];
  for (const s of flow.steps) {
    let p = out[out.length - 1];
    if (!p || p.group !== s.group) {
      p = {
        key: `p${s.index}`,
        group: s.group,
        label: PLAIN_GROUP_LABELS[s.group],
        startAt: s.enteredAt,
        endAt: null,
        ms: 0,
        timed: false,
        pauseMs: 0,
        pauseCount: 0,
        changeCount: 0,
        ongoing: false,
        long: false,
        terminalLabel: null,
        terminalAt: null,
      };
      out.push(p);
    }
    p.changeCount += 1;
    if (s.isPause) p.pauseCount += 1;
    if (isFinalStep(flow, s)) {
      p.terminalLabel = s.label;
      p.terminalAt = s.enteredAt;
      p.endAt = s.enteredAt;
      continue;
    }
    if (s.ms !== null) {
      p.ms += s.ms;
      p.timed = true;
      if (s.isPause) p.pauseMs += s.ms;
    }
    p.ongoing = s.ongoing;
    p.endAt = s.ongoing ? null : s.leftAt;
  }
  for (const p of out) p.long = !p.ongoing && p.ms > longMs;
  return out;
}

export type FlowState = 'empty' | 'finished' | 'cancelled' | 'ongoing' | 'stopped';

export interface PhaseBar {
  group: StatusGroup;
  label: string;
  ms: number;
  pauseMs: number;
  /** Longueur, en % de la phase la PLUS LONGUE (qui occupe toute la piste). */
  widthPct: number;
  /** Part de la barre passée en pause, en %. */
  pausePct: number;
  /** Part du temps total, en %. */
  sharePct: number;
  /** Part arrondie à l'unité : « 92 % », « < 1 % ». */
  shareLabel: string;
}

export interface FlowOverview {
  state: FlowState;
  /** Dernier statut brut (IRREPARABLE, FINISHED…) — pour la teinte. */
  lastStatus: string | null;
  /** Dernier statut, en clair (« Terminé », « En diagnostic »…). */
  lastLabel: string | null;
  /** Phase du dernier statut, en clair. */
  lastPhase: string | null;
  lastAt: Date | null;
  /** Durée du statut en cours (`ongoing`). */
  sinceMs: number | null;
  /** Temps passé dans le dossier, statut final exclu. */
  totalMs: number;
  /** Temps entre le statut final et l'ouverture du cycle suivant. */
  afterEndMs: number | null;
  /** Phase la plus longue — seulement s'il y en a au moins deux. */
  longest: PhaseBar | null;
  /** Une barre par phase chronométrée, dans l'ordre FIXE `GROUP_ORDER`. */
  bars: PhaseBar[];
}

/** Espaces INSÉCABLES : « 44 % » ne se coupe jamais en fin de ligne. */
function shareLabel(pct: number): string {
  if (pct <= 0) return '0 %';
  const r = Math.round(pct);
  if (r < 1) return '< 1 %';
  if (r >= 100 && pct < 100) return '> 99 %';
  return `${r} %`;
}

/** Résumé d'un cycle : état, durée totale, phase la plus longue, et le temps
 *  passé par phase (barres). */
export function buildFlowOverview(
  flow: StatusFlow,
  passages: PhasePassage[] = buildPhasePassages(flow),
): FlowOverview {
  const totals = new Map<StatusGroup, { ms: number; pauseMs: number }>();
  let totalMs = 0;
  for (const p of passages) {
    if (!p.timed) continue;
    const t = totals.get(p.group) ?? { ms: 0, pauseMs: 0 };
    t.ms += p.ms;
    t.pauseMs += p.pauseMs;
    totals.set(p.group, t);
    totalMs += p.ms;
  }
  let maxMs = 0;
  totals.forEach((t) => (maxMs = Math.max(maxMs, t.ms)));

  const bars: PhaseBar[] = [];
  for (const group of GROUP_ORDER) {
    const t = totals.get(group);
    if (!t || t.ms <= 0) continue;
    const sharePct = totalMs > 0 ? (t.ms / totalMs) * 100 : 0;
    bars.push({
      group,
      label: PLAIN_GROUP_LABELS[group],
      ms: t.ms,
      pauseMs: t.pauseMs,
      widthPct: maxMs > 0 ? (t.ms / maxMs) * 100 : 0,
      pausePct: (t.pauseMs / t.ms) * 100,
      sharePct,
      shareLabel: shareLabel(sharePct),
    });
  }
  const longest =
    bars.length >= 2 ? bars.reduce((a, b) => (b.ms > a.ms ? b : a)) : null;

  const last: StatusFlowStep | undefined = flow.steps[flow.steps.length - 1];
  let state: FlowState = 'empty';
  if (last) {
    if (isFinalStep(flow, last)) {
      state = last.status === 'ANNULER' ? 'cancelled' : 'finished';
    } else if (last.ongoing) {
      state = 'ongoing';
    } else {
      state = 'stopped';
    }
  }
  // « En cours depuis » = depuis l'ENTRÉE dans la phase (PENDING2 → PRICING →
  // WAITING_DEVIS reste « Devis » d'un bout à l'autre), comme le passage.
  const lastPassage = passages[passages.length - 1];
  return {
    state,
    lastStatus: last ? last.status : null,
    lastLabel: last ? last.label : null,
    lastPhase: last ? PLAIN_GROUP_LABELS[last.group] : null,
    lastAt: last ? last.enteredAt : null,
    sinceMs: last?.ongoing && lastPassage ? lastPassage.ms : null,
    totalMs,
    afterEndMs:
      last && isFinalStep(flow, last) && last.endKind === 'boundary'
        ? last.ms
        : null,
    longest,
    bars,
  };
}

// ── Tableau descriptif « Temps passé par étape » ─────────────────────────────

/** Ce que couvre chaque grande phase, en clair (statuts de `BASE_PHASES`). */
export const PHASE_DESCRIPTIONS: Record<StatusGroup, string> = {
  created: 'Dossier créé, avant l’attente de diagnostic.',
  diagnostic: 'Attente d’affectation puis diagnostic du technicien, pauses comprises.',
  magasin: 'Estimation des composants par le magasin et confirmation avec la coordination.',
  admin: 'Tarification, devis, bon de commande et accord du client.',
  repair: 'Attente de réparation puis réparation du technicien, pauses comprises.',
  closed: 'Bon de livraison et facture, jusqu’à la clôture.',
  retour: 'Réouverture du dossier après un retour client.',
  cancelled: 'Annulation du dossier.',
  other: 'Statuts hors des phases connues.',
};

/** Une pause d'une phase : entrée `*_Pause` → statut suivant (horloge serveur). */
export interface PhasePause {
  /** Rang dans la phase, chronologique : 1, 2… */
  index: number;
  startAt: Date;
  /** Reprise (statut suivant) ; `null` si la pause court encore ou n'est pas bornée. */
  endAt: Date | null;
  /** Durée ; `null` si la pause n'est pas bornée (historique incomplet). */
  ms: number | null;
  ongoing: boolean;
  /** Statut qui a suivi la pause, en clair ; `null` s'il n'y en a pas. */
  nextLabel: string | null;
  /** Pause close au-delà du seuil d'anomalie. */
  long: boolean;
}

export interface PhaseTableRow {
  group: StatusGroup;
  label: string;
  description: string;
  /** Chaque pause de la phase, dans l'ordre (vide sans `flow`). */
  pauses: PhasePause[];
  /** Plus longue pause bornée ; `null` s'il n'y en a aucune. */
  longestPauseMs: number | null;
  /** Durée moyenne des pauses TERMINÉES ; `null` s'il n'y en a aucune. */
  avgPauseMs: number | null;
  /** Part de l'étape passée en pause, en % (0 sans pause). */
  pauseSharePct: number;
  /** Même part, arrondie : « 41 % », « < 1 % ». */
  pauseShareLabel: string;
  /** Première entrée dans la phase. */
  startAt: Date;
  /** Dernière sortie de la phase ; `null` si elle court encore. */
  endAt: Date | null;
  ongoing: boolean;
  /** Passages distincts : une phase quittée puis reprise en compte deux. */
  passageCount: number;
  pauseCount: number;
  ms: number;
  pauseMs: number;
  /** Temps hors pauses. */
  workMs: number;
  sharePct: number;
  shareLabel: string;
  /** Un passage de la phase a dépassé le seuil d'anomalie. */
  long: boolean;
}

/** Compteur de pauses d'un cycle (bandeau au-dessus du tableau). */
export interface PauseSummary {
  /** Nombre de pauses, pause en cours comprise. */
  count: number;
  /** Temps total en pause (une pause en cours compte jusqu'à maintenant). */
  totalMs: number;
  /** Plus longue pause bornée ; `null` sans détail. */
  longestMs: number | null;
  /** Moyenne des pauses TERMINÉES ; `null` s'il n'y en a aucune. */
  avgMs: number | null;
  /** Pause qui court encore ; `null` sinon. */
  ongoing: PhasePause | null;
  /** Une entrée par étape ayant des pauses, dans l'ordre du tableau. */
  byPhase: Array<{
    group: StatusGroup;
    label: string;
    count: number;
    ms: number;
    shareLabel: string;
  }>;
}

export interface PhaseTable {
  rows: PhaseTableRow[];
  totalMs: number;
  totalPauseMs: number;
  totalWorkMs: number;
  totalPauseCount: number;
  pauseSummary: PauseSummary;
  /** Première entrée / dernière sortie, toutes phases ; `endAt` null si en cours. */
  startAt: Date | null;
  endAt: Date | null;
  ongoing: boolean;
}

/**
 * Une ligne par phase chronométrée — mêmes phases, même ordre et mêmes parts que
 * les barres de `buildFlowOverview` — enrichie de la période, des passages et,
 * avec `flow`, du détail de CHAQUE pause. Invariants : Σ `rows.ms` = `totalMs` =
 * `overview.totalMs` ; Σ `pauses.ms` bornées = `pauseMs` de la ligne.
 */
export function buildPhaseTable(
  passages: PhasePassage[],
  overview: FlowOverview,
  flow?: StatusFlow,
): PhaseTable {
  const rows: PhaseTableRow[] = [];
  for (const bar of overview.bars) {
    const mine = passages.filter((p) => p.group === bar.group && p.timed);
    if (!mine.length) continue;
    const last = mine[mine.length - 1];

    const pauses: PhasePause[] = [];
    for (const s of flow?.steps ?? []) {
      if (s.group !== bar.group || !s.isPause || isFinalStep(flow!, s)) continue;
      const next = flow!.steps[s.index + 1];
      pauses.push({
        index: pauses.length + 1,
        startAt: s.enteredAt,
        endAt: s.ongoing ? null : s.leftAt,
        ms: s.ms,
        ongoing: s.ongoing,
        nextLabel: next ? next.label : null,
        long: s.long,
      });
    }
    const timedPauses = pauses
      .map((p) => p.ms)
      .filter((ms): ms is number => ms !== null);
    // Moyenne sur les pauses TERMINÉES : une pause en cours la fausserait.
    const closedPauses = pauses
      .filter((p) => !p.ongoing && p.ms !== null)
      .map((p) => p.ms as number);
    const pauseSharePct = bar.ms > 0 ? (bar.pauseMs / bar.ms) * 100 : 0;

    rows.push({
      group: bar.group,
      label: bar.label,
      description: PHASE_DESCRIPTIONS[bar.group],
      pauses,
      longestPauseMs: timedPauses.length ? Math.max(...timedPauses) : null,
      avgPauseMs: closedPauses.length
        ? Math.round(closedPauses.reduce((a, ms) => a + ms, 0) / closedPauses.length)
        : null,
      pauseSharePct,
      pauseShareLabel: shareLabel(pauseSharePct),
      startAt: mine[0].startAt,
      endAt: last.ongoing ? null : last.endAt,
      ongoing: last.ongoing,
      passageCount: mine.length,
      pauseCount: flow ? pauses.length : mine.reduce((a, p) => a + p.pauseCount, 0),
      ms: bar.ms,
      pauseMs: bar.pauseMs,
      workMs: bar.ms - bar.pauseMs,
      sharePct: bar.sharePct,
      shareLabel: bar.shareLabel,
      long: mine.some((p) => p.long),
    });
  }

  const totalPauseMs = rows.reduce((a, r) => a + r.pauseMs, 0);
  const totalPauseCount = rows.reduce((a, r) => a + r.pauseCount, 0);
  const allPauses: PhasePause[] = [];
  for (const r of rows) allPauses.push(...r.pauses);
  const boundedPauses = allPauses
    .map((p) => p.ms)
    .filter((ms): ms is number => ms !== null);
  const closedAll = allPauses
    .filter((p) => !p.ongoing && p.ms !== null)
    .map((p) => p.ms as number);
  const pauseSummary: PauseSummary = {
    count: totalPauseCount,
    totalMs: totalPauseMs,
    longestMs: boundedPauses.length ? Math.max(...boundedPauses) : null,
    avgMs: closedAll.length
      ? Math.round(closedAll.reduce((a, ms) => a + ms, 0) / closedAll.length)
      : null,
    ongoing: allPauses.find((p) => p.ongoing) ?? null,
    byPhase: rows
      .filter((r) => r.pauseCount > 0)
      .map((r) => ({
        group: r.group,
        label: r.label,
        count: r.pauseCount,
        ms: r.pauseMs,
        shareLabel: r.pauseShareLabel,
      })),
  };
  const ongoing = rows.some((r) => r.ongoing);
  const starts = rows.map((r) => r.startAt.getTime());
  const ends = rows
    .map((r) => r.endAt?.getTime())
    .filter((t): t is number => t !== undefined);
  return {
    rows,
    totalMs: overview.totalMs,
    totalPauseMs,
    totalWorkMs: overview.totalMs - totalPauseMs,
    totalPauseCount,
    pauseSummary,
    startAt: starts.length ? new Date(Math.min(...starts)) : null,
    endAt: !ongoing && ends.length ? new Date(Math.max(...ends)) : null,
    ongoing,
  };
}

export type MilestoneState = 'done' | 'current' | 'skipped' | 'pending';

export interface PhaseMilestone {
  group: StatusGroup;
  label: string;
  state: MilestoneState;
  /** Temps passé dans la phase ; `null` sans durée bornée. */
  ms: number | null;
  /** Ligne sous le libellé : durée, « en cours · … », statut final, « sautée »… */
  caption: string;
}

export interface PhaseStepper {
  milestones: PhaseMilestone[];
  /** Dossier annulé : les phases non atteintes ne viendront pas. */
  cancelled: boolean;
}

const MILESTONES: ReadonlyArray<[StatusGroup, string]> = [
  ['diagnostic', 'Diagnostic'],
  ['magasin', 'Magasin'],
  ['admin', 'Devis & accord'],
  ['repair', 'Réparation'],
  ['closed', 'Clôture'],
];

/**
 * Les 5 grandes étapes d'un dossier et leur état. « Sautée » = non traversée
 * alors qu'une étape postérieure l'a été (pas de pièces, retour sans devis…) ;
 * « non réalisée » = jamais atteinte d'un dossier terminé ou annulé.
 */
export function buildPhaseStepper(
  flow: StatusFlow,
  passages: PhasePassage[] = buildPhasePassages(flow),
): PhaseStepper {
  const last = flow.steps[flow.steps.length - 1];
  const finished = !!last && isFinalStep(flow, last);
  const cancelled = passages.some((p) => p.group === 'cancelled');
  const present = new Set(passages.map((p) => p.group));
  let reached = -1;
  MILESTONES.forEach(([g], i) => {
    if (present.has(g)) reached = i;
  });

  const milestones = MILESTONES.map(([group, label], i): PhaseMilestone => {
    const mine = passages.filter((p) => p.group === group);
    const ms = mine.some((p) => p.timed)
      ? mine.reduce((a, p) => a + p.ms, 0)
      : null;
    const terminal = mine.find((p) => p.terminalLabel)?.terminalLabel ?? null;
    let state: MilestoneState;
    let caption: string;
    if (last?.ongoing && last.group === group) {
      // Depuis l'entrée dans la phase, comme l'état affiché en tête.
      state = 'current';
      caption = `en cours · ${formatDuration(passages[passages.length - 1].ms)}`;
    } else if (present.has(group)) {
      state = 'done';
      caption =
        terminal && !ms
          ? terminal
          : ms !== null
            ? formatDuration(ms)
            : 'durée inconnue';
    } else if (i < reached) {
      state = 'skipped';
      caption = 'sautée';
    } else if (finished || cancelled) {
      state = 'skipped';
      caption = 'non réalisée';
    } else {
      state = 'pending';
      caption = 'à venir';
    }
    return { group, label, state, ms, caption };
  });
  return { milestones, cancelled };
}

/**
 * Largeurs d'une barre dessinée (PDF) : proportionnelles aux poids, avec une
 * largeur minimale garantie — l'excédent est repris sur les blocs plus larges
 * (remplissage « water-filling »). Somme = `total`.
 */
export function layoutBar(weights: number[], total: number, min: number): number[] {
  const n = weights.length;
  if (!n) return [];
  const w = weights.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum <= 0 || n * min >= total) return w.map(() => total / n);
  const pinned = new Array<boolean>(n).fill(false);
  const free = () => {
    let fw = 0;
    let pc = 0;
    for (let i = 0; i < n; i++) {
      if (pinned[i]) pc++;
      else fw += w[i];
    }
    return { fw, ft: total - pc * min };
  };
  for (let pass = 0; pass < n; pass++) {
    const { fw, ft } = free();
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (pinned[i]) continue;
      if (fw <= 0 || (w[i] / fw) * ft < min) {
        pinned[i] = true;
        changed = true;
      }
    }
    if (!changed) break;
  }
  const { fw, ft } = free();
  return w.map((v, i) => (pinned[i] || fw <= 0 ? min : (v / fw) * ft));
}

// ── Chrono de travail (segments serveur + pauses de l'historique) ───────────

export type WorkKind = 'diag' | 'rep';
export type WorkRowKind = 'work' | 'running' | 'pause' | 'untracked';

/** Au-delà, un segment est anormalement long (session restée ouverte) : c'est
 *  le même seuil que la règle serveur `MAX_PLAUSIBLE_LEG_MS`. */
export const LONG_LEG_MS = 12 * 3600 * 1000;

export interface WorkJournalRow {
  kind: WorkRowKind;
  start: Date;
  end: Date | null;
  ms: number | null;
  ongoing: boolean;
  /** Ce qui a OUVERT l'intervalle (clic, changement de statut…). */
  startCause: string;
  /** Ce qui l'a FERMÉ ; `null` tant qu'il court. */
  endCause: string | null;
  long: boolean;
  note?: string;
}

export interface WorkJournal {
  kind: WorkKind;
  rows: WorkJournalRow[];
  hasData: boolean;
  workCount: number;
  /** Σ des segments CLOS (pièce justificative du cumul). */
  workMs: number;
  runningMs: number | null;
  longCount: number;
  pauseCount: number;
  pauseMs: number;
  pauseOngoingMs: number | null;
  untrackedCount: number;
  untrackedMs: number;
  /** Cumul persisté (`diag_time` / `rep_time`). */
  storedMs: number | null;
  /** Σ segments − cumul persisté. */
  deltaMs: number | null;
  matchesStored: boolean | null;
  droppedSegments: number;
}

export interface WorkJournalInput {
  kind: WorkKind;
  segments?: any[] | null;
  /** Historique COMPLET assaini — sert à nommer les causes. */
  history: StatusHistoryEntry[];
  /** Parcours DU CYCLE — sert aux pauses et aux intervalles sans segment. */
  flow: StatusFlow;
  assignments?: any[] | null;
  openAnchor?: DateInput;
  storedCumul?: string | null;
  now?: number;
  toleranceMs?: number;
  longLegMs?: number;
}

const WORK_KINDS: Record<
  WorkKind,
  {
    run: string[];
    active: string;
    pause: string;
    assigned: string;
    exitVerb: string;
    isExit: (status: string) => boolean;
  }
> = {
  diag: {
    run: ['DIAGNOSTIC', 'INDIAGNOSTIC'],
    active: 'INDIAGNOSTIC',
    pause: 'DIAGNOSTIC_Pause',
    assigned: 'DIAGNOSTIC',
    exitVerb: 'Fin du diagnostic',
    isExit: (s) => {
      const g = statusGroupOf(s);
      return g !== 'diagnostic' && g !== 'retour' && g !== 'cancelled';
    },
  },
  rep: {
    run: ['REPARATION', 'INREPARATION'],
    active: 'INREPARATION',
    pause: 'REPARATION_Pause',
    assigned: 'REPARATION',
    exitVerb: 'Fin de la réparation',
    isExit: (s) => statusGroupOf(s) === 'closed',
  },
};

const NAME_SENTINELS = new Set(['n/a', 'na', '-', '—', 'unknown', 'null', 'undefined']);

function readableName(v: any): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  if (!t || NAME_SENTINELS.has(t.toLowerCase())) return null;
  if (/^[0-9a-fA-F]{24}$/.test(t)) return null;
  return t;
}

/** Entrée d'historique la plus proche de `t` (± `tol`) satisfaisant `pred`. À
 *  égalité, on préfère l'entrée ANTÉRIEURE : le serveur écrit le statut PUIS
 *  ouvre/ferme le segment, quelques millisecondes plus tard. */
function nearestEntry(
  history: StatusHistoryEntry[],
  t: number,
  tol: number,
  pred: (status: string) => boolean,
): { entry: StatusHistoryEntry; idx: number } | null {
  let best: { entry: StatusHistoryEntry; idx: number } | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < history.length; i++) {
    const e = history[i];
    if (!pred(e.status)) continue;
    const at = e.at.getTime();
    const d = Math.abs(at - t);
    if (d > tol) continue;
    if (d < bestD || (d === bestD && at <= t)) {
      best = { entry: e, idx: i };
      bestD = d;
    }
  }
  return best;
}

/**
 * Chrono de travail d'une phase (diagnostic ou réparation), dans l'ordre :
 *  - `work`      : un segment SERVEUR — de l'ouverture (clic « Démarrer » /
 *                  « Reprendre ») à sa fermeture (pause, fin de phase, abandon,
 *                  tout changement de statut qui quitte la phase) ;
 *  - `running`   : le segment encore ouvert (ancre sans fermeture) ;
 *  - `pause`     : d'une entrée `*_Pause` à l'entrée suivante de l'historique
 *                  (même horloge serveur que les segments) ;
 *  - `untracked` : passage en « En diagnostic »/« En réparation » qu'aucun
 *                  segment ne couvre (temps antérieur au journal des segments).
 * Les causes sont nommées en rapprochant chaque borne de l'entrée d'historique
 * écrite au même instant (± `toleranceMs`).
 */
export function buildWorkJournal(input: WorkJournalInput): WorkJournal {
  const cfg = WORK_KINDS[input.kind];
  const now = input.now ?? Date.now();
  const tol = input.toleranceMs ?? 2000;
  const longLeg = input.longLegMs ?? LONG_LEG_MS;
  const history = Array.isArray(input.history) ? input.history : [];
  const flow = input.flow;

  // 1. Segments valides, dédoublonnés, triés.
  let droppedSegments = 0;
  const seen = new Set<string>();
  const segs: Array<{ start: number; end: number }> = [];
  for (const g of Array.isArray(input.segments) ? input.segments : []) {
    const start = toEpochMs(g?.startedAt);
    const end = toEpochMs(g?.stoppedAt);
    if (start === null || end === null || end < start) {
      droppedSegments++;
      continue;
    }
    const key = `${start}-${end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    segs.push({ start, end });
  }
  segs.sort((a, b) => a.start - b.start);

  const startCauseAt = (t: number): string => {
    const hit = nearestEntry(history, t, tol, (s) => s === cfg.active);
    if (!hit) return 'Ouverture (non tracée dans l’historique)';
    let prev: StatusHistoryEntry | null = null;
    for (let i = hit.idx - 1; i >= 0; i--) {
      if (history[i].status !== cfg.active) {
        prev = history[i];
        break;
      }
    }
    if (!prev || prev.status === cfg.assigned) return 'Démarrage';
    if (prev.status === cfg.pause) return 'Reprise';
    return `Démarrage depuis « ${labelForStatus(prev.status)} »`;
  };

  const assignments = Array.isArray(input.assignments) ? input.assignments : [];
  const endCauseAt = (t: number): string => {
    if (input.kind === 'diag') {
      const ab = assignments.find((a) => {
        const at = toEpochMs(a?.abandonedAt);
        return at !== null && Math.abs(at - t) <= tol;
      });
      if (ab) {
        const who = readableName(ab.tech) ?? 'technicien';
        const motif = String(ab?.motif ?? '').trim();
        return `Abandon — ${who}${motif ? ` (${motif})` : ''}`;
      }
    }
    const out = nearestEntry(history, t, tol, (s) => !cfg.run.includes(s));
    if (out) {
      if (out.entry.status === cfg.pause) return 'Mise en pause';
      const label = labelForStatus(out.entry.status);
      return cfg.isExit(out.entry.status)
        ? `${cfg.exitVerb} → ${label}`
        : `Changement de statut → ${label}`;
    }
    const inPhase = nearestEntry(history, t, tol, (s) => cfg.run.includes(s));
    if (inPhase) {
      return `Changement de statut → ${labelForStatus(inPhase.entry.status)}`;
    }
    return 'Fermeture (non tracée dans l’historique)';
  };

  const rows: WorkJournalRow[] = [];
  const covered: Array<{ start: number; end: number }> = [];

  // 2. Travail — un segment serveur par ligne.
  for (const s of segs) {
    const ms = s.end - s.start;
    rows.push({
      kind: 'work',
      start: new Date(s.start),
      end: new Date(s.end),
      ms,
      ongoing: false,
      startCause: startCauseAt(s.start),
      endCause: endCauseAt(s.end),
      long: ms > longLeg,
    });
    covered.push(s);
  }

  // 3. Segment encore ouvert.
  const anchor = toEpochMs(input.openAnchor);
  let runningMs: number | null = null;
  if (anchor !== null) {
    runningMs = Math.max(0, now - anchor);
    rows.push({
      kind: 'running',
      start: new Date(anchor),
      end: null,
      ms: runningMs,
      ongoing: true,
      startCause: startCauseAt(anchor),
      endCause: null,
      long: runningMs > longLeg,
      note: flow?.ongoing ? undefined : 'Chrono resté ouvert sur un cycle clos',
    });
    covered.push({ start: anchor, end: now });
  }

  // 4. Pauses — d'après l'historique DU CYCLE (horloge serveur).
  const steps = flow?.steps ?? [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.status !== cfg.pause) continue;
    const next = steps[i + 1];
    const endCause = next
      ? next.status === cfg.active
        ? 'Reprise'
        : `Changement de statut → ${next.label}`
      : s.endKind === 'boundary'
        ? 'Ouverture du cycle suivant'
        : s.ongoing
          ? null
          : 'Fin non enregistrée';
    rows.push({
      kind: 'pause',
      start: s.enteredAt,
      end: s.leftAt,
      ms: s.ms,
      ongoing: s.ongoing,
      startCause: 'Mise en pause',
      endCause,
      long: false,
    });
  }

  // 5. Passages « en cours de travail » qu'aucun segment ne couvre.
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.status !== cfg.active || s.ms === null) continue;
    const from = s.enteredAt.getTime();
    const to = s.ongoing ? now : (s.leftAt?.getTime() ?? from);
    const isCovered = covered.some(
      (c) => c.start <= to + tol && c.end >= from - tol,
    );
    if (isCovered) continue;
    const next = steps[i + 1];
    rows.push({
      kind: 'untracked',
      start: s.enteredAt,
      end: s.leftAt,
      ms: s.ms,
      ongoing: s.ongoing,
      startCause: `Passage en « ${s.label} »`,
      endCause: next ? `Changement de statut → ${next.label}` : null,
      long: false,
      note: 'Aucun segment serveur pour cet intervalle',
    });
  }

  const order: Record<WorkRowKind, number> = { work: 0, running: 1, pause: 2, untracked: 3 };
  rows.sort((a, b) => a.start.getTime() - b.start.getTime() || order[a.kind] - order[b.kind]);

  const work = rows.filter((r) => r.kind === 'work');
  const pauses = rows.filter((r) => r.kind === 'pause');
  const untracked = rows.filter((r) => r.kind === 'untracked');
  const workMs = work.reduce((a, r) => a + (r.ms ?? 0), 0);
  const ongoingPause = pauses.find((r) => r.ongoing);
  const storedMs = hhmmssToMs(input.storedCumul ?? null);
  const deltaMs = storedMs === null ? null : workMs - storedMs;

  return {
    kind: input.kind,
    rows,
    hasData: rows.length > 0 || (storedMs ?? 0) > 0,
    workCount: work.length,
    workMs,
    runningMs,
    longCount: rows.filter((r) => (r.kind === 'work' || r.kind === 'running') && r.long).length,
    pauseCount: pauses.length,
    pauseMs: pauses.filter((r) => !r.ongoing).reduce((a, r) => a + (r.ms ?? 0), 0),
    pauseOngoingMs: ongoingPause ? ongoingPause.ms : null,
    untrackedCount: untracked.length,
    untrackedMs: untracked.reduce((a, r) => a + (r.ms ?? 0), 0),
    storedMs,
    deltaMs,
    // Le serveur tronque le cumul à la seconde à CHAQUE fermeture : jusqu'à
    // 1 s d'écart par segment est attendu.
    matchesStored: deltaMs === null ? null : Math.abs(deltaMs) <= work.length * 1000 + 1000,
    droppedSegments,
  };
}

// ── Pauses héritées (journal navigateur) — repli « approximatif » ───────────

export interface LegacyPauseRow {
  start: Date;
  end: Date | null;
  ms: number | null;
  state: 'closed' | 'ongoing' | 'open' | 'inconsistent';
}

/**
 * Pauses du journal navigateur (`Stat.pauseLogs`) pour les cycles SANS pause
 * dans l'historique serveur. Chaînes lues avec Luxon (heure de Tunis) ; doublons
 * écartés (plusieurs pauses ouvertes à la même seconde par des clics répétés).
 * Une pause sans fin n'est « en cours » que si c'est la dernière ET que la DI
 * est effectivement en pause — sinon sa fin n'a jamais été enregistrée.
 */
export function buildLegacyPauseRows(
  pauseLogs: any[] | null | undefined,
  kind: WorkKind,
  currentStatus: string | null,
  now: number = Date.now(),
): LegacyPauseRow[] {
  const cfg = WORK_KINDS[kind];
  const parsed = (Array.isArray(pauseLogs) ? pauseLogs : [])
    .filter((p) => (p?.pauseType === 'rep') === (kind === 'rep'))
    .map((p) => ({ start: toEpochMs(p?.pauseStart), end: toEpochMs(p?.pauseEnd) }))
    .filter((p): p is { start: number; end: number | null } => p.start !== null)
    .sort((a, b) => a.start - b.start);

  const kept: Array<{ start: number; end: number | null }> = [];
  for (const p of parsed) {
    if (kept.some((q) => q.start === p.start && q.end === p.end)) continue;
    if (p.end === null) {
      const near = (q: { start: number }) => Math.abs(q.start - p.start) <= 2000;
      if (parsed.some((q) => q !== p && q.end !== null && near(q))) continue;
      if (kept.some((q) => q.end === null && near(q))) continue;
    }
    kept.push(p);
  }

  return kept.map((p, i) => {
    const start = new Date(p.start);
    if (p.end !== null && p.end < p.start) {
      return { start, end: null, ms: null, state: 'inconsistent' as const };
    }
    if (p.end !== null) {
      return { start, end: new Date(p.end), ms: p.end - p.start, state: 'closed' as const };
    }
    if (i === kept.length - 1 && currentStatus === cfg.pause) {
      return { start, end: null, ms: Math.max(0, now - p.start), state: 'ongoing' as const };
    }
    return { start, end: null, ms: null, state: 'open' as const };
  });
}

/** Source des pauses affichées : historique serveur d'abord, journal
 *  navigateur seulement à défaut. */
export function pauseSourceFor(
  kind: WorkKind,
  flow: StatusFlow,
  legacy: LegacyPauseRow[],
): 'history' | 'legacy' | 'none' {
  const cfg = WORK_KINDS[kind];
  if (flow.steps.some((s) => s.status === cfg.pause)) return 'history';
  return legacy.length ? 'legacy' : 'none';
}

// ── Affectations diagnostic ─────────────────────────────────────────────────

export interface AssignmentRow {
  tech: string;
  assignedAt: Date | null;
  abandonedAt: Date | null;
  motif: string | null;
  abandonedBy: string | null;
  /** Temps de diagnostic DÉJÀ cumulé sur le cycle quand ce technicien a été
   *  affecté (travail des techniciens précédents). */
  alreadyMs: number | null;
  /** Temps que CE technicien a ajouté au cumul. */
  workedMs: number | null;
  workedSource: 'stored' | 'computed' | 'unknown';
  /** Son chrono tourne en ce moment. */
  running: boolean;
  anomaly: string | null;
}

export interface AssignmentSummary {
  rows: AssignmentRow[];
  totalWorkedMs: number | null;
  storedMs: number | null;
  runningMs: number | null;
}

/**
 * Affectations diagnostic du cycle, rendues vérifiables :
 *  - abandon → temps travaillé FIGÉ par le serveur à l'abandon (`diagTime`) ;
 *  - dernier affecté sans abandon → cumul du cycle − déjà cumulé à son
 *    affectation (+ segment en cours s'il y en a un) ;
 *  - plusieurs affectations ouvertes → écart entre deux affectations, signalé.
 * Σ temps travaillés = cumul du cycle (+ segment en cours).
 */
export function buildAssignmentRows(
  assignments: any[] | null | undefined,
  diagTime: string | null | undefined,
  openAnchor: DateInput,
  now: number = Date.now(),
): AssignmentSummary {
  const list = (Array.isArray(assignments) ? assignments : [])
    .map((a, i) => ({ a, i, at: toEpochMs(a?.assignedAt) }))
    .sort(
      (x, y) =>
        (x.at ?? Number.POSITIVE_INFINITY) - (y.at ?? Number.POSITIVE_INFINITY) ||
        x.i - y.i,
    );
  const storedMs = hhmmssToMs(diagTime ?? null);
  const anchor = toEpochMs(openAnchor);
  const runningMs = anchor !== null ? Math.max(0, now - anchor) : null;
  let lastOpen = -1;
  list.forEach((x, k) => {
    if (toEpochMs(x.a?.abandonedAt) === null) lastOpen = k;
  });

  const rows: AssignmentRow[] = list.map(({ a, at }, k) => {
    const alreadyMs = hhmmssToMs(a?.diagTimeStart ?? null);
    const nextAlready =
      k + 1 < list.length ? hhmmssToMs(list[k + 1].a?.diagTimeStart ?? null) : null;
    const abandonedAt = toEpochMs(a?.abandonedAt);
    const base = {
      tech: readableName(a?.tech) ?? '—',
      assignedAt: at !== null ? new Date(at) : null,
      abandonedAt: abandonedAt !== null ? new Date(abandonedAt) : null,
      motif: readableName(a?.motif),
      abandonedBy: readableName(a?.abandonedBy),
      alreadyMs,
    };
    const between =
      alreadyMs !== null && nextAlready !== null ? Math.max(0, nextAlready - alreadyMs) : null;

    if (abandonedAt !== null) {
      const worked = hhmmssToMs(a?.diagTime ?? null) ?? between;
      return {
        ...base,
        workedMs: worked,
        workedSource: worked === null ? 'unknown' : 'stored',
        running: false,
        anomaly: null,
      };
    }
    if (k === lastOpen) {
      const worked =
        storedMs !== null && alreadyMs !== null
          ? Math.max(0, storedMs - alreadyMs) + (runningMs ?? 0)
          : null;
      return {
        ...base,
        workedMs: worked,
        workedSource: worked === null ? 'unknown' : 'computed',
        running: runningMs !== null,
        anomaly: null,
      };
    }
    return {
      ...base,
      workedMs: between,
      workedSource: between === null ? 'unknown' : 'computed',
      running: false,
      anomaly: 'Affectation restée ouverte alors qu’un autre technicien a été affecté',
    };
  });

  const totalWorkedMs = rows.every((r) => r.workedMs !== null)
    ? rows.reduce((acc, r) => acc + (r.workedMs as number), 0)
    : null;
  return { rows, totalWorkedMs: rows.length ? totalWorkedMs : null, storedMs, runningMs };
}
