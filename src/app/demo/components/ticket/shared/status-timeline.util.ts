/**
 * SOURCE UNIQUE du calcul de durées entre statuts (à partir de `statusHistory`).
 *
 * Extrait tel quel du modal Coordination (`coordinator-di-list`) pour être
 * RÉUTILISÉ — jamais réimplémenté — par le modal détail DI (`di-info-modal`).
 * Fonctions PURES : elles prennent l'historique en paramètre (aucun `this`), ce
 * qui permet de les appliquer soit à l'historique COMPLET (coordinateur), soit à
 * une TRANCHE par cycle de retour (dossier détaillé, option « dossier par cycle »).
 */

export interface StatusHistoryEntry {
  status: string;
  at: Date;
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
  { key: 'PRICING_DIAG', group: 'admin', label: 'Pricing', icon: 'pi pi-file', statuses: ['PRICING', 'PRICING_DIAG'] },
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
    .map((h) => ({ status: h.status as string, at: new Date(h.at) }))
    .filter((h) => !Number.isNaN(h.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
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
  const start = phaseEntryRawDate(history, phaseKey);
  if (!start) return null;
  if (state === 'current') {
    const ms = now - start.getTime();
    return { text: formatDuration(ms), ongoing: true, ms };
  }
  const order = BASE_PHASES.map((p) => p.key);
  for (let j = order.indexOf(phaseKey) + 1; j < order.length; j++) {
    const next = phaseEntryRawDate(history, order[j]);
    if (next && next.getTime() > start.getTime()) {
      const ms = next.getTime() - start.getTime();
      return { text: formatDuration(ms), ongoing: false, ms };
    }
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
 *  Coordination. Chaîne vide/absente/invalide → null. */
export function formatTimelineDate(at: any): string | null {
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Tunis',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
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
  for (const phase of BASE_PHASES) {
    const entry = phase.statuses.length
      ? historySlice.find((h) => phase.statuses.includes(h.status)) ?? null
      : null;
    if (!entry) continue; // étape non atteinte dans ce cycle → masquée
    const isCurrent =
      !!currentStatus && phase.statuses.includes(currentStatus);
    const state: PhaseState = isCurrent ? 'current' : 'done';
    const duration = computePhaseDuration(historySlice, phase.key, state, now);
    const anomalous =
      !!duration &&
      !duration.ongoing &&
      duration.ms != null &&
      duration.ms > anomalyThresholdMs;
    rows.push({
      key: phase.key,
      label: phase.label,
      rawStatus: entry.status,
      date: formatTimelineDate(entry.at),
      duration,
      state,
      anomalous,
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
    };
  });
}
