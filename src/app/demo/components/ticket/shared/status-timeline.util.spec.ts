import {
  buildAssignmentRows,
  buildCycleTimeline,
  buildFlowOverview,
  buildLegacyPauseRows,
  buildPhasePassages,
  buildPhaseStepper,
  buildPhaseTable,
  buildStatusBar,
  buildStatusFlow,
  buildWorkJournal,
  formatTimelineDate,
  labelForStatus,
  layoutBar,
  pauseSourceFor,
  sanitizeHistory,
  sliceHistoryByCycle,
  sliceHistoryForCycle,
  statusGroupOf,
  StatusFlow,
} from './status-timeline.util';

/**
 * Frise « Écart entre statuts » — non-régression du double comptage.
 *
 * Signalé sur T1455 : `DIAGNOSTIC_Pause` et `INDIAGNOSTIC` affichaient TOUS DEUX
 * « 2 h 2 min », le même intervalle étant attribué à deux lignes. La borne de fin
 * était cherchée dans l'ordre CANONIQUE `BASE_PHASES` — qui place la pause AVANT
 * `INDIAGNOSTIC` — alors que le flux réel est l'inverse : la borne était sautée
 * et on tombait sur la phase d'après.
 */
const ANOMALY = 48 * 3600 * 1000;

const run = (h: any[], current: string | null, now: number) =>
  buildCycleTimeline(sanitizeHistory(h), current, ANOMALY, now);

/** Somme des durées CLOSES — doit égaler l'amplitude de l'historique. */
const sumClosed = (rows: any[]) =>
  rows
    .filter((r) => r.duration && !r.duration.ongoing)
    .reduce((a, r) => a + r.duration.ms, 0);

const span = (h: any[]) =>
  new Date(h[h.length - 1].at).getTime() - new Date(h[0].at).getTime();

describe('buildCycleTimeline', () => {
  const T1455 = [
    { status: 'CREATED', at: '2026-09-08T08:16:00.000Z' },
    { status: 'PENDING1', at: '2026-09-09T12:42:00.000Z' },
    { status: 'DIAGNOSTIC', at: '2026-09-09T12:42:30.000Z' },
    { status: 'INDIAGNOSTIC', at: '2026-09-09T12:54:05.000Z' },
    { status: 'DIAGNOSTIC_Pause', at: '2026-09-09T12:54:50.000Z' },
    { status: 'MagasinEstimation', at: '2026-09-09T14:56:00.000Z' },
  ];
  const NOW = new Date('2026-09-10T14:37:00.000Z').getTime();

  it('affiche les lignes dans l’ordre du TEMPS, pas dans l’ordre canonique', () => {
    const rows = run(T1455, 'MagasinEstimation', NOW);
    expect(rows.map((r) => r.rawStatus)).toEqual([
      'CREATED',
      'PENDING1',
      'DIAGNOSTIC',
      'INDIAGNOSTIC',
      'DIAGNOSTIC_Pause',
      'MagasinEstimation',
    ]);
  });

  it('n’attribue JAMAIS le même intervalle à deux lignes', () => {
    const rows = run(T1455, 'MagasinEstimation', NOW);
    // L'invariant décisif : avant correctif, la somme DÉPASSAIT l'amplitude de
    // 7 315 000 ms — exactement l'intervalle compté deux fois.
    expect(sumClosed(rows)).toBe(span(T1455));
  });

  it('mesure INDIAGNOSTIC jusqu’à la pause (45 s), pas jusqu’au magasin', () => {
    const rows = run(T1455, 'MagasinEstimation', NOW);
    const indiag = rows.find((r) => r.rawStatus === 'INDIAGNOSTIC');
    expect(indiag?.duration?.ms).toBe(45_000);
  });

  it('rend visible CHAQUE aller-retour pause/reprise', () => {
    // 30 min de travail → pause 2 h → 10 min → pause (en cours).
    const h = [
      { status: 'INDIAGNOSTIC', at: '2026-09-09T08:00:00Z' },
      { status: 'DIAGNOSTIC_Pause', at: '2026-09-09T08:30:00Z' },
      { status: 'INDIAGNOSTIC', at: '2026-09-09T10:30:00Z' },
      { status: 'DIAGNOSTIC_Pause', at: '2026-09-09T10:40:00Z' },
    ];
    const rows = run(h, 'DIAGNOSTIC_Pause', new Date('2026-09-09T11:00:00Z').getTime());
    // Avant : une seule ligne par phase → 2 lignes, les retours invisibles.
    expect(rows.length).toBe(4);
    const pauses = rows.filter((r) => r.rawStatus.endsWith('_Pause'));
    expect(pauses.length).toBe(2);
    expect(pauses[0].duration?.ms).toBe(2 * 3600 * 1000);
    expect(pauses[1].duration?.ongoing).toBe(true);
  });

  it('deux entrées au même instant ⇒ durée nulle, pas la phase suivante', () => {
    const h = [
      { status: 'CREATED', at: '2026-09-09T08:00:00Z' },
      { status: 'PENDING1', at: '2026-09-09T08:00:00Z' },
      { status: 'DIAGNOSTIC', at: '2026-09-09T09:00:00Z' },
    ];
    const rows = run(h, null, Date.now());
    expect(rows.find((r) => r.rawStatus === 'CREATED')?.duration?.ms).toBe(0);
    expect(sumClosed(rows)).toBe(span(h));
  });

  it('fusionne un doublon consécutif et court jusqu’à la SORTIE réelle', () => {
    // Cas réel en base : le middleware pousse une entrée dès que `status` est
    // PRÉSENT dans l'update, pas seulement quand il CHANGE.
    const h = [
      { status: 'PENDING2', at: '2026-08-24T12:09:27Z' },
      { status: 'PRICING_DIAG', at: '2026-08-24T12:09:39Z' },
      { status: 'PRICING_DIAG', at: '2026-08-24T12:09:46Z' },
      { status: 'WAITING_DEVIS', at: '2026-08-24T12:09:56Z' },
    ];
    const rows = run(h, 'WAITING_DEVIS', new Date('2026-08-24T13:00:00Z').getTime());
    const pricing = rows.filter((r) => r.rawStatus === 'PRICING_DIAG');
    expect(pricing.length).toBe(1);
    expect(pricing[0].duration?.ms).toBe(17_000);
    expect(sumClosed(rows)).toBe(span(h));
  });
});


describe('labelForStatus', () => {
  // Le renommage PRICING → PRICING_DIAG est « forward-only » : les deux valeurs
  // coexistent en base. Elles doivent rendre le MÊME libellé, sinon la colonne
  // « Statut » montre deux mots différents pour un seul et même état.
  it('rend « PRICING » pour la valeur courante ET pour la legacy', () => {
    expect(labelForStatus('PRICING_DIAG')).toBe('PRICING');
    expect(labelForStatus('PRICING')).toBe('PRICING');
  });

  it("n'a pas d'autre libellé en casse mixte pour la tarification", () => {
    expect(labelForStatus('PRICING_DIAG')).not.toBe('Pricing');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Parcours des statuts + chrono — fixture RÉELLE T1270 (DI_fmN7, fixtronixproddb)
// Retour 1 SANS entrée RETOUR1 dans l'historique ; 7 segments serveur dont un de
// 44 h ; `diag_time` = 44:06:55 ; cycle 0 : pauses du journal navigateur seules.
// ═════════════════════════════════════════════════════════════════════════════

const T1270_HISTORY = [
  ['INDIAGNOSTIC', '2026-07-29T10:45:20.218Z'],
  ['DIAGNOSTIC_Pause', '2026-07-29T10:45:24.596Z'],
  ['INDIAGNOSTIC', '2026-07-29T10:45:28.004Z'],
  ['DIAGNOSTIC_Pause', '2026-07-29T10:45:37.161Z'],
  ['INDIAGNOSTIC', '2026-08-24T12:37:38.418Z'],
  ['DIAGNOSTIC_Pause', '2026-08-24T12:37:40.756Z'],
  ['INDIAGNOSTIC', '2026-08-24T12:37:43.021Z'],
  ['INDIAGNOSTIC', '2026-08-26T08:40:33.601Z'],
  ['DIAGNOSTIC_Pause', '2026-08-26T08:40:50.407Z'],
  ['INDIAGNOSTIC', '2026-08-26T08:40:51.333Z'],
  ['DIAGNOSTIC_Pause', '2026-08-26T08:40:52.819Z'],
  ['INDIAGNOSTIC', '2026-08-26T08:40:54.617Z'],
  ['DIAGNOSTIC_Pause', '2026-08-26T08:40:57.538Z'],
  ['INDIAGNOSTIC', '2026-08-26T08:42:27.982Z'],
  ['DIAGNOSTIC_Pause', '2026-08-26T08:42:28.952Z'],
  ['INDIAGNOSTIC', '2026-08-26T08:42:51.178Z'],
  ['DIAGNOSTIC_Pause', '2026-08-26T08:42:52.229Z'],
  ['INDIAGNOSTIC', '2026-08-26T08:42:55.486Z'],
  ['PENDING2', '2026-08-26T08:46:29.076Z'],
  ['PRICING_DIAG', '2026-08-26T10:15:45.452Z'],
  ['PRICING_DIAG', '2026-08-26T10:16:56.071Z'],
  ['WAITING_DEVIS', '2026-08-26T10:17:05.114Z'],
  ['PENDING3', '2026-08-26T15:37:47.654Z'],
  ['REPARATION', '2026-08-26T15:38:22.124Z'],
  ['WAITING_BL', '2026-08-26T15:38:22.447Z'],
  ['FINISHED', '2026-08-26T15:39:32.382Z'],
].map(([status, at]) => ({ status, at }));

const T1270_SEGMENTS_C1 = [
  ['2026-08-24T12:37:38.422Z', '2026-08-24T12:37:40.768Z'],
  ['2026-08-24T12:37:43.025Z', '2026-08-26T08:40:50.426Z'],
  ['2026-08-26T08:40:51.340Z', '2026-08-26T08:40:52.833Z'],
  ['2026-08-26T08:40:54.621Z', '2026-08-26T08:40:57.548Z'],
  ['2026-08-26T08:42:27.988Z', '2026-08-26T08:42:28.958Z'],
  ['2026-08-26T08:42:51.182Z', '2026-08-26T08:42:52.237Z'],
  ['2026-08-26T08:42:55.491Z', '2026-08-26T08:46:29.079Z'],
].map(([startedAt, stoppedAt]) => ({ startedAt, stoppedAt }));

/** `logsdis{idIgnore: 1}.createdAt` — seule datation du retour 1. */
const T1270_HINTS = [null, '2026-03-12T12:16:07.521Z'];

const T1270_PAUSELOGS_C0 = [
  { pauseType: 'diag', pauseStart: '2026/02/10:11:01:17', pauseEnd: '2026/02/10:11:01:54' },
  { pauseType: 'diag', pauseStart: '2026/02/10:11:01:56', pauseEnd: '2026/02/10:14:12:45' },
];

const LATER = Date.parse('2026-09-14T12:00:00Z');
const ANOM = 48 * 3600 * 1000;
const at = (s: string) => new Date(s);
const H = (rows: Array<[string, string, boolean?]>) =>
  sanitizeHistory(rows.map(([status, a, reconstructed]) => ({ status, at: a, reconstructed })));

function t1270Flow(cycle: number): StatusFlow {
  const slice = sliceHistoryForCycle(T1270_HISTORY, cycle, 1, T1270_HINTS);
  return buildStatusFlow(
    slice.entries,
    cycle === 1 ? 'FINISHED' : null,
    slice.boundaryAt,
    LATER,
    ANOM,
  );
}

describe('formatTimelineDate (Luxon)', () => {
  it('rend EXACTEMENT la sortie de l’ancien formateur Intl', () => {
    const intl = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Tunis',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    for (const x of [
      '2026-08-26T08:46:29.079Z',
      '2026-03-01T23:00:00.000Z',
      '2026-12-31T23:30:00.000Z',
      '2026-01-01T00:00:00.000Z',
      '2026-07-15T11:59:59.999Z',
      '2025-10-26T01:30:00.000Z',
    ]) {
      expect(formatTimelineDate(x)).withContext(x).toBe(intl.format(new Date(x)));
    }
  });

  it('lit la chaîne de pause héritée au bon jour et à la bonne heure', () => {
    expect(formatTimelineDate('2026/09/14:10:05:33')).toBe('14/09/2026 10:05');
  });
});

describe('sliceHistoryForCycle', () => {
  const H2 = [
    { status: 'CREATED', at: '2026-01-01T08:00:00Z' },
    { status: 'FINISHED', at: '2026-01-02T08:00:00Z' },
    { status: 'RETOUR1', at: '2026-01-05T08:00:00Z' },
    { status: 'PENDING1', at: '2026-01-05T09:00:00Z' },
    { status: 'FINISHED', at: '2026-01-06T08:00:00Z' },
    { status: 'RETOUR2', at: '2026-01-10T08:00:00Z' },
    { status: 'PENDING1', at: '2026-01-10T08:30:00Z' },
  ];

  it('égale `sliceHistoryByCycle` quand toutes les entrées RETOUR existent', () => {
    const legacy = sliceHistoryByCycle(H2);
    for (const c of [0, 1, 2]) {
      const s = sliceHistoryForCycle(H2, c, 2);
      expect(s.entries).withContext(`cycle ${c}`).toEqual(legacy[c]);
      expect(s.inferredStart).toBeFalse();
    }
    expect(sliceHistoryForCycle(H2, 0, 2).boundaryAt?.toISOString()).toBe(
      '2026-01-05T08:00:00.000Z',
    );
    expect(sliceHistoryForCycle(H2, 2, 2).boundaryAt).toBeNull();
  });

  it('T1270 : sans RETOUR1, le retour démarre à l’ouverture de sa ligne logsdis', () => {
    const c1 = sliceHistoryForCycle(T1270_HISTORY, 1, 1, T1270_HINTS);
    expect(c1.entries.length).toBe(26);
    expect(c1.inferredStart).toBeTrue();
    const c0 = sliceHistoryForCycle(T1270_HISTORY, 0, 1, T1270_HINTS);
    expect(c0.entries.length).toBe(0);
    expect(c0.boundaryAt?.toISOString()).toBe('2026-03-12T12:16:07.521Z');
  });

  it('sans entrée ni date d’ouverture, le début du cycle est INCONNU (pas le cycle 0)', () => {
    const s = sliceHistoryForCycle(T1270_HISTORY, 1, 1, []);
    expect(s.unknownStart).toBeTrue();
    expect(s.entries).toEqual([]);
  });

  it('une date déduite ne contredit jamais une entrée RETOUR observée', () => {
    const noR1 = H2.filter((e) => e.status !== 'RETOUR1');
    // Indice du retour 1 postérieur au RETOUR2 observé → ignoré.
    const bad = sliceHistoryForCycle(noR1, 1, 2, [null, '2026-01-20T00:00:00Z']);
    expect(bad.unknownStart).toBeTrue();
    const c2 = sliceHistoryForCycle(noR1, 2, 2, [null, '2026-01-20T00:00:00Z']);
    expect(c2.entries.map((e) => e.status)).toEqual(['RETOUR2', 'PENDING1']);
  });
});

describe('buildStatusFlow', () => {
  it('T1270 retour 1 : 24 étapes, statut final, Σ écarts = amplitude', () => {
    const flow = t1270Flow(1);
    expect(flow.steps.length).toBe(24);
    expect(flow.spanMs).toBe(2_436_852_164);
    expect(flow.steps.reduce((a, s) => a + (s.ms ?? 0), 0)).toBe(flow.spanMs);
    const last = flow.steps[flow.steps.length - 1];
    expect(last.status).toBe('FINISHED');
    expect(last.endKind).toBe('terminal');
    expect(last.ms).toBeNull();
    // Réouverture sans changement (INDIAGNOSTIC réécrit) → fusionnée.
    const reopened = flow.steps.find(
      (s) => s.enteredAt.toISOString() === '2026-08-24T12:37:43.021Z',
    );
    expect(reopened?.dupCount).toBe(2);
    // La pause de 26 jours est signalée anormale (> 48 h).
    expect(flow.steps[3].status).toBe('DIAGNOSTIC_Pause');
    expect(flow.steps[3].long).toBeTrue();
  });

  it('fusionne un doublon STRICT et garde l’écart jusqu’à la sortie réelle', () => {
    const flow = buildStatusFlow(
      H([
        ['PENDING2', '2026-08-24T12:09:27Z'],
        ['PRICING_DIAG', '2026-08-24T12:09:39Z'],
        ['PRICING_DIAG', '2026-08-24T12:09:46Z', true],
        ['WAITING_DEVIS', '2026-08-24T12:09:56Z'],
      ]),
      'WAITING_DEVIS',
      null,
      Date.parse('2026-08-24T13:00:00Z'),
    );
    const pricing = flow.steps.find((s) => s.status === 'PRICING_DIAG');
    expect(pricing?.dupCount).toBe(2);
    expect(pricing?.ms).toBe(17_000);
    expect(pricing?.reconstructed).toBeTrue();
  });

  it('garde CHAQUE aller-retour pause/reprise', () => {
    const flow = buildStatusFlow(
      H([
        ['INDIAGNOSTIC', '2026-09-09T08:00:00Z'],
        ['DIAGNOSTIC_Pause', '2026-09-09T08:30:00Z'],
        ['INDIAGNOSTIC', '2026-09-09T10:30:00Z'],
      ]),
      'INDIAGNOSTIC',
      null,
      Date.parse('2026-09-09T11:00:00Z'),
    );
    expect(flow.steps.map((s) => s.status)).toEqual([
      'INDIAGNOSTIC',
      'DIAGNOSTIC_Pause',
      'INDIAGNOSTIC',
    ]);
    expect(flow.steps[1].isPause).toBeTrue();
  });

  it('cycle clos : la dernière étape court jusqu’à l’ouverture du cycle suivant', () => {
    const flow = buildStatusFlow(
      H([
        ['CREATED', '2026-01-01T08:00:00Z'],
        ['PENDING1', '2026-01-01T09:00:00Z'],
      ]),
      null,
      at('2026-01-01T10:00:00Z'),
    );
    expect(flow.steps[1].endKind).toBe('boundary');
    expect(flow.steps[1].ms).toBe(3_600_000);
    expect(flow.spanMs).toBe(7_200_000);
  });

  it('cycle clos sans borne connue : dernière durée inconnue, pas inventée', () => {
    const flow = buildStatusFlow(H([['PENDING1', '2026-01-01T09:00:00Z']]), null, null);
    expect(flow.steps[0].endKind).toBe('unknown');
    expect(flow.steps[0].ms).toBeNull();
    expect(flow.spanMs).toBe(0);
  });

  it('cycle actif : la dernière étape est « en cours » jusqu’à maintenant', () => {
    const flow = buildStatusFlow(
      H([
        ['PENDING1', '2026-01-01T08:00:00Z'],
        ['DIAGNOSTIC', '2026-01-01T09:00:00Z'],
      ]),
      'DIAGNOSTIC',
      null,
      Date.parse('2026-01-01T09:30:00Z'),
    );
    expect(flow.ongoing).toBeTrue();
    expect(flow.steps[1].ms).toBe(1_800_000);
    expect(flow.spanMs).toBe(5_400_000);
  });

  it('PRICING hérité ≡ PRICING_DIAG : pas de fausse incohérence', () => {
    const flow = buildStatusFlow(H([['PRICING', '2026-01-01T08:00:00Z']]), 'PRICING_DIAG', null, Date.parse('2026-01-01T09:00:00Z'));
    expect(flow.currentMismatch).toBeFalse();
    expect(flow.steps[0].endKind).toBe('ongoing');
  });

  it('statut vivant absent de l’historique : signalé, durée inconnue', () => {
    const flow = buildStatusFlow(H([['PENDING1', '2026-01-01T08:00:00Z']]), 'PENDING2', null, Date.parse('2026-01-02T08:00:00Z'));
    expect(flow.currentMismatch).toBeTrue();
    expect(flow.steps[0].ms).toBeNull();
  });

  it('deux entrées au même instant : écart nul, invariant respecté', () => {
    const flow = buildStatusFlow(
      H([
        ['CREATED', '2026-09-09T08:00:00Z'],
        ['PENDING1', '2026-09-09T08:00:00Z'],
        ['DIAGNOSTIC', '2026-09-09T09:00:00Z'],
      ]),
      null,
      at('2026-09-09T10:00:00Z'),
    );
    expect(flow.steps[0].ms).toBe(0);
    expect(flow.steps.reduce((a, s) => a + (s.ms ?? 0), 0)).toBe(flow.spanMs);
  });

  it('historique vide : aucun pas, aucune amplitude', () => {
    const flow = buildStatusFlow([], 'PENDING1', null);
    expect(flow.steps).toEqual([]);
    expect(flow.spanMs).toBe(0);
  });
});

describe('barre du parcours', () => {
  it('layoutBar : somme exacte, minimum garanti, proportions préservées', () => {
    const w = layoutBar([1, 1000, 1, 50], 500, 1.5);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(500, 6);
    expect(Math.min(...w)).toBeGreaterThanOrEqual(1.5);
    expect(w[1] / w[3]).toBeCloseTo(1000 / 50, 6);
    expect(layoutBar([5, 5, 5], 3, 2)).toEqual([1, 1, 1]);
    expect(layoutBar([0, 0], 10, 1)).toEqual([5, 5]);
  });

  it('T1270 : les étapes minuscules sont regroupées, la pause de 26 j domine', () => {
    const bar = buildStatusBar(t1270Flow(1));
    const clusters = bar.filter((b) => b.kind === 'cluster');
    expect(clusters.length).toBeGreaterThan(0);
    expect(clusters.every((c) => c.count >= 2)).toBeTrue();
    const pause = bar.find((b) => b.isPause && b.pct > 90);
    expect(pause).toBeDefined();
    expect(bar.reduce((a, b) => a + b.pct, 0)).toBeCloseTo(100, 6);
  });

  it('une étape minuscule ISOLÉE reste une étape', () => {
    const flow = buildStatusFlow(
      H([
        ['PENDING1', '2026-01-01T00:00:00Z'],
        ['DIAGNOSTIC', '2026-01-10T00:00:00Z'],
        ['INDIAGNOSTIC', '2026-01-10T00:00:01Z'],
      ]),
      null,
      at('2026-01-20T00:00:00Z'),
    );
    const bar = buildStatusBar(flow);
    expect(bar.map((b) => b.kind)).toEqual(['step', 'step', 'step']);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Parcours simplifié (vue utilisateur) — historiques RÉELS (fixtronixproddb)
// T1421 (DI_HCZi) : terminé, `INMAGASIN` hérité APRÈS le devis.
// T1450 (DI_RhxS) : en attente du devis (statut vivant WAITING_DEVIS).
// ═════════════════════════════════════════════════════════════════════════════

const T1421_HISTORY = [
  ['CREATED', '2026-07-20T12:31:19.040Z'],
  ['PENDING1', '2026-07-21T08:44:34.473Z'],
  ['DIAGNOSTIC', '2026-07-21T08:45:03.982Z'],
  ['INDIAGNOSTIC', '2026-07-21T08:46:19.889Z'],
  ['DIAGNOSTIC_Pause', '2026-07-21T09:11:17.676Z'],
  ['INDIAGNOSTIC', '2026-07-21T09:12:55.438Z'],
  ['DIAGNOSTIC_Pause', '2026-07-21T09:27:56.568Z'],
  ['INDIAGNOSTIC', '2026-07-21T09:57:23.083Z'],
  ['DIAGNOSTIC_Pause', '2026-07-21T10:02:44.407Z'],
  ['INDIAGNOSTIC', '2026-07-21T10:03:09.983Z'],
  ['DIAGNOSTIC_Pause', '2026-07-21T10:05:58.041Z'],
  ['INDIAGNOSTIC', '2026-07-21T10:06:27.530Z'],
  ['DIAGNOSTIC_Pause', '2026-07-21T10:06:55.371Z'],
  ['INDIAGNOSTIC', '2026-07-21T10:07:07.142Z'],
  ['DIAGNOSTIC_Pause', '2026-07-21T10:07:24.926Z'],
  ['INDIAGNOSTIC', '2026-07-21T10:07:28.660Z'],
  ['DIAGNOSTIC_Pause', '2026-07-21T10:07:29.814Z'],
  ['INDIAGNOSTIC', '2026-07-21T10:08:22.955Z'],
  ['DIAGNOSTIC_Pause', '2026-07-21T10:08:32.801Z'],
  ['INDIAGNOSTIC', '2026-07-21T10:08:39.808Z'],
  ['DIAGNOSTIC_Pause', '2026-07-21T10:08:41.014Z'],
  ['INDIAGNOSTIC', '2026-07-21T10:10:29.375Z'],
  ['MagasinEstimation', '2026-07-21T10:11:07.512Z'],
  ['PENDING2', '2026-07-22T08:00:53.684Z'],
  ['PRICING', '2026-07-22T11:58:57.332Z'],
  ['PRICING', '2026-07-22T13:32:18.987Z'],
  ['PRICING', '2026-07-23T09:31:39.613Z'],
  ['NEGOTIATION1', '2026-07-23T09:31:48.604Z'],
  ['INMAGASIN', '2026-08-13T07:55:26.422Z'],
  ['PENDING3', '2026-08-13T09:49:43.125Z'],
  ['REPARATION', '2026-08-13T10:58:08.151Z'],
  ['INREPARATION', '2026-08-13T10:59:56.332Z'],
  ['FINISHED', '2026-08-13T11:21:56.759Z'],
].map(([status, at]) => ({ status, at }));

const T1450_HISTORY = [
  ['CREATED', '2026-08-31T12:15:29.397Z'],
  ['PENDING1', '2026-08-31T12:15:34.686Z'],
  ['DIAGNOSTIC', '2026-08-31T12:19:58.737Z'],
  ['INDIAGNOSTIC', '2026-08-31T12:20:47.677Z'],
  ['DIAGNOSTIC_Pause', '2026-08-31T13:57:31.800Z'],
  ['INDIAGNOSTIC', '2026-09-01T07:09:17.060Z'],
  ['DIAGNOSTIC_Pause', '2026-09-01T08:21:24.788Z'],
  ['INDIAGNOSTIC', '2026-09-01T08:38:12.984Z'],
  ['DIAGNOSTIC_Pause', '2026-09-01T11:00:53.034Z'],
  ['INDIAGNOSTIC', '2026-09-01T12:23:32.183Z'],
  ['DIAGNOSTIC_Pause', '2026-09-01T13:47:05.745Z'],
  ['INDIAGNOSTIC', '2026-09-01T13:50:47.533Z'],
  ['DIAGNOSTIC_Pause', '2026-09-01T15:04:35.101Z'],
  ['INDIAGNOSTIC', '2026-09-01T15:04:35.455Z'],
  ['DIAGNOSTIC_Pause', '2026-09-01T15:04:36.095Z'],
  ['INDIAGNOSTIC', '2026-09-01T15:04:36.745Z'],
  ['DIAGNOSTIC_Pause', '2026-09-01T15:04:37.196Z'],
  ['INDIAGNOSTIC', '2026-09-01T15:04:41.436Z'],
  ['DIAGNOSTIC_Pause', '2026-09-01T15:32:31.345Z'],
  ['INDIAGNOSTIC', '2026-09-02T08:27:19.287Z'],
  ['DIAGNOSTIC_Pause', '2026-09-02T08:57:50.634Z'],
  ['MagasinEstimation', '2026-09-02T11:15:32.827Z'],
  ['PENDING2', '2026-09-08T11:41:48.616Z'],
  ['PRICING_DIAG', '2026-09-08T14:00:57.731Z'],
  ['PRICING_DIAG', '2026-09-08T14:01:26.548Z'],
  ['PRICING_DIAG', '2026-09-08T14:03:33.791Z'],
  ['WAITING_DEVIS', '2026-09-08T14:04:21.689Z'],
].map(([status, at]) => ({ status, at }));

const liveFlow = (rows: Array<{ status: string; at: string }>, current: string | null) =>
  buildStatusFlow(sanitizeHistory(rows), current, null, LATER, ANOM);

describe('parcours simplifié', () => {
  it('INMAGASIN hérité appartient au Magasin, plus jamais à « Autre »', () => {
    expect(statusGroupOf('INMAGASIN')).toBe('magasin');
  });

  it('T1270 retour 1 : pauses fondues, 4 passages, Σ = amplitude', () => {
    const flow = t1270Flow(1);
    const passages = buildPhasePassages(flow, ANOM);
    expect(passages.map((p) => p.group)).toEqual(['diagnostic', 'admin', 'repair', 'closed']);
    expect(passages[0].changeCount).toBe(17);
    expect(passages[0].pauseCount).toBe(8);
    expect(passages[0].long).toBeTrue();
    expect(passages[3].terminalLabel).toBe('Terminé');
    expect(passages.reduce((a, p) => a + p.changeCount, 0)).toBe(flow.steps.length);
    expect(passages.reduce((a, p) => a + p.ms, 0)).toBe(flow.spanMs);

    // Pas de magasin sur ce retour, alors que le devis a suivi : étape sautée.
    const stepper = buildPhaseStepper(flow, passages);
    expect(stepper.milestones.map((m) => m.state)).toEqual([
      'done',
      'skipped',
      'done',
      'done',
      'done',
    ]);
    expect(stepper.milestones[1].caption).toBe('sautée');
  });

  it('T1421 : le devis domine, le Magasin repris après le devis reste UNE barre', () => {
    const flow = liveFlow(T1421_HISTORY, 'FINISHED');
    const passages = buildPhasePassages(flow, ANOM);
    expect(passages.map((p) => p.group)).toEqual([
      'created',
      'diagnostic',
      'magasin',
      'admin',
      'magasin',
      'repair',
      'closed',
    ]);
    expect(passages[1].pauseCount).toBe(9);
    expect(passages[1].pauseMs).toBe(2_103_356);

    const ov = buildFlowOverview(flow, passages);
    expect(ov.state).toBe('finished');
    expect(ov.lastLabel).toBe('Terminé');
    expect(ov.totalMs).toBe(flow.spanMs);
    expect(ov.afterEndMs).toBeNull();
    expect(ov.bars.map((b) => b.group)).toEqual(['created', 'diagnostic', 'magasin', 'admin', 'repair']);
    expect(ov.longest?.group).toBe('admin');
    expect(ov.longest?.widthPct).toBe(100);
    expect(ov.longest?.shareLabel).toBe('92 %');
    expect(ov.bars.find((b) => b.group === 'repair')?.shareLabel).toBe('< 1 %');
    expect(ov.bars.reduce((a, b) => a + b.sharePct, 0)).toBeCloseTo(100, 6);

    const stepper = buildPhaseStepper(flow, passages);
    expect(stepper.milestones.every((m) => m.state === 'done')).toBeTrue();
    expect(stepper.milestones[4].caption).toBe('Terminé');
  });

  it('T1450 : en cours dans le devis, mesuré depuis l’ENTRÉE dans la phase', () => {
    const flow = liveFlow(T1450_HISTORY, 'WAITING_DEVIS');
    const ov = buildFlowOverview(flow);
    expect(ov.state).toBe('ongoing');
    expect(ov.lastPhase).toBe('Devis & accord client');
    expect(ov.sinceMs).toBe(LATER - Date.parse('2026-09-08T11:41:48.616Z'));

    const stepper = buildPhaseStepper(flow);
    expect(stepper.milestones.map((m) => m.state)).toEqual([
      'done',
      'done',
      'current',
      'pending',
      'pending',
    ]);
    expect(stepper.milestones[2].caption).toMatch(/^en cours · /);
  });

  it('cycle clos : le temps entre « Terminé » et le retour suivant ne compte dans aucune phase', () => {
    const flow = buildStatusFlow(
      H([
        ['PENDING1', '2026-01-01T08:00:00Z'],
        ['INDIAGNOSTIC', '2026-01-01T09:00:00Z'],
        ['FINISHED', '2026-01-01T12:00:00Z'],
      ]),
      null,
      at('2026-04-01T08:00:00Z'),
    );
    const ov = buildFlowOverview(flow);
    expect(ov.state).toBe('finished');
    expect(ov.totalMs).toBe(4 * 3_600_000);
    expect(ov.afterEndMs).toBe(flow.spanMs - 4 * 3_600_000);
    expect(ov.bars.map((b) => b.group)).toEqual(['diagnostic']);
    expect(ov.longest).toBeNull();
  });

  it('annulation : phases non atteintes « non réalisées », jamais « à venir »', () => {
    const flow = buildStatusFlow(
      H([
        ['PENDING1', '2026-01-01T08:00:00Z'],
        ['INDIAGNOSTIC', '2026-01-01T09:00:00Z'],
        ['ANNULER', '2026-01-01T10:00:00Z'],
      ]),
      'ANNULER',
      null,
      Date.parse('2026-01-02T08:00:00Z'),
    );
    const stepper = buildPhaseStepper(flow);
    expect(stepper.cancelled).toBeTrue();
    expect(stepper.milestones.map((m) => m.state)).toEqual([
      'done',
      'skipped',
      'skipped',
      'skipped',
      'skipped',
    ]);
    expect(stepper.milestones[1].caption).toBe('non réalisée');
    const ov = buildFlowOverview(flow);
    expect(ov.state).toBe('cancelled');
    expect(ov.lastLabel).toBe('Annulée');
  });

  it('un seul statut en cours : une barre, pas de « plus long », étape courante', () => {
    const flow = buildStatusFlow(
      H([['PENDING1', '2026-01-01T08:00:00Z']]),
      'PENDING1',
      null,
      Date.parse('2026-01-01T09:00:00Z'),
    );
    const ov = buildFlowOverview(flow);
    expect(ov.bars.length).toBe(1);
    expect(ov.longest).toBeNull();
    expect(ov.sinceMs).toBe(3_600_000);
    expect(buildPhaseStepper(flow).milestones.map((m) => m.state)).toEqual([
      'current',
      'pending',
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('historique vide : aucune phase inventée', () => {
    const flow = buildStatusFlow([], 'PENDING1', null);
    expect(buildPhasePassages(flow)).toEqual([]);
    const ov = buildFlowOverview(flow);
    expect(ov.state).toBe('empty');
    expect(ov.bars).toEqual([]);
    expect(ov.totalMs).toBe(0);
    expect(buildPhaseStepper(flow).milestones.every((m) => m.state === 'pending')).toBeTrue();
  });
});

describe('buildPhaseTable (tableau « Temps passé par étape »)', () => {
  it('T1421 : une ligne par barre, Magasin repris = 2 passages, Σ = total', () => {
    const flow = liveFlow(T1421_HISTORY, 'FINISHED');
    const passages = buildPhasePassages(flow, ANOM);
    const ov = buildFlowOverview(flow, passages);
    const table = buildPhaseTable(passages, ov, flow);

    expect(table.rows.map((r) => r.group)).toEqual(ov.bars.map((b) => b.group));
    expect(table.rows.every((r) => r.description.length > 0)).toBeTrue();

    const magasin = table.rows.find((r) => r.group === 'magasin')!;
    const magasinPassages = passages.filter((p) => p.group === 'magasin');
    expect(magasin.passageCount).toBe(2);
    expect(magasin.startAt).toEqual(magasinPassages[0].startAt);
    expect(magasin.endAt).toEqual(magasinPassages[1].endAt);

    const diag = table.rows.find((r) => r.group === 'diagnostic')!;
    expect(diag.pauseCount).toBe(9);
    expect(diag.pauseMs).toBe(2_103_356);
    expect(diag.workMs).toBe(diag.ms - 2_103_356);

    // Détail : chaque pause listée, dans l'ordre, et leur somme = temps de pause.
    expect(diag.pauses.length).toBe(9);
    expect(diag.pauses.map((p) => p.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const pauseMs = diag.pauses.map((p) => p.ms ?? 0);
    expect(pauseMs.reduce((a, ms) => a + ms, 0)).toBe(2_103_356);
    expect(diag.longestPauseMs).toBe(Math.max(...pauseMs));
    for (const p of diag.pauses) {
      expect(p.endAt!.getTime()).toBeGreaterThanOrEqual(p.startAt.getTime());
      expect(p.nextLabel).toBeTruthy();
    }
    expect(table.totalPauseCount).toBe(
      table.rows.reduce((a, r) => a + r.pauses.length, 0),
    );

    expect(table.totalMs).toBe(ov.totalMs);
    expect(table.rows.reduce((a, r) => a + r.ms, 0)).toBe(table.totalMs);
    expect(table.totalPauseMs).toBe(table.rows.reduce((a, r) => a + r.pauseMs, 0));
    expect(table.totalWorkMs).toBe(table.totalMs - table.totalPauseMs);
    expect(table.ongoing).toBeFalse();
    expect(table.startAt).toEqual(passages[0].startAt);
    expect(table.endAt).not.toBeNull();
  });

  it('T1450 en cours dans le devis : ligne et total « en cours », sans date de fin', () => {
    const flow = liveFlow(T1450_HISTORY, 'WAITING_DEVIS');
    const passages = buildPhasePassages(flow, ANOM);
    const table = buildPhaseTable(passages, buildFlowOverview(flow, passages), flow);
    const admin = table.rows.find((r) => r.group === 'admin')!;
    expect(admin.ongoing).toBeTrue();
    expect(admin.endAt).toBeNull();
    expect(table.ongoing).toBeTrue();
    expect(table.endAt).toBeNull();
  });

  it('pauses du diagnostic : chacune listée, la dernière en cours sans reprise', () => {
    const flow = buildStatusFlow(
      H([
        ['INDIAGNOSTIC', '2026-01-01T08:00:00Z'],
        ['DIAGNOSTIC_Pause', '2026-01-01T09:00:00Z'],
        ['INDIAGNOSTIC', '2026-01-01T09:20:00Z'],
        ['DIAGNOSTIC_Pause', '2026-01-01T10:00:00Z'],
      ]),
      'DIAGNOSTIC_Pause',
      null,
      Date.parse('2026-01-01T10:30:00Z'),
    );
    const passages = buildPhasePassages(flow);
    const table = buildPhaseTable(passages, buildFlowOverview(flow, passages), flow);
    const diag = table.rows.find((r) => r.group === 'diagnostic')!;

    expect(diag.pauses.length).toBe(2);
    expect(diag.pauseCount).toBe(2);
    expect(diag.pauses[0].ms).toBe(20 * 60_000);
    expect(diag.pauses[0].endAt).toEqual(new Date('2026-01-01T09:20:00Z'));
    expect(diag.pauses[0].nextLabel).toBeTruthy();
    expect(diag.pauses[1].ongoing).toBeTrue();
    expect(diag.pauses[1].endAt).toBeNull();
    expect(diag.pauses[1].ms).toBe(30 * 60_000);
    expect(diag.pauseMs).toBe(50 * 60_000);
    expect(diag.longestPauseMs).toBe(30 * 60_000);
  });

  it('sans `flow` : pas de détail, compteur repris des passages', () => {
    const flow = liveFlow(T1421_HISTORY, 'FINISHED');
    const passages = buildPhasePassages(flow, ANOM);
    const diag = buildPhaseTable(passages, buildFlowOverview(flow, passages)).rows.find(
      (r) => r.group === 'diagnostic',
    )!;
    expect(diag.pauses).toEqual([]);
    expect(diag.longestPauseMs).toBeNull();
    expect(diag.pauseCount).toBe(9);
  });

  it('compteur de pauses T1421 : nombre, total, plus longue, moyenne, part de l’étape', () => {
    const flow = liveFlow(T1421_HISTORY, 'FINISHED');
    const passages = buildPhasePassages(flow, ANOM);
    const table = buildPhaseTable(passages, buildFlowOverview(flow, passages), flow);
    const diag = table.rows.find((r) => r.group === 'diagnostic')!;

    expect(diag.ms).toBe(5_193_039); // PENDING1 → MagasinEstimation
    expect(diag.avgPauseMs).toBe(Math.round(2_103_356 / 9));
    expect(diag.pauseSharePct).toBeCloseTo((2_103_356 / 5_193_039) * 100, 6);
    expect(diag.pauseShareLabel).toBe('41 %');

    const ps = table.pauseSummary;
    expect(ps.count).toBe(9);
    expect(ps.totalMs).toBe(2_103_356);
    expect(ps.longestMs).toBe(1_766_515); // 29 min 26 s
    expect(ps.avgMs).toBe(Math.round(2_103_356 / 9));
    expect(ps.ongoing).toBeNull();
    expect(ps.byPhase).toEqual([
      { group: 'diagnostic', label: 'Diagnostic', count: 9, ms: 2_103_356, shareLabel: '41 %' },
    ]);
  });

  it('compteur de pauses diagnostic ET réparation : une entrée par étape, moyenne du cycle', () => {
    const flow = buildStatusFlow(
      H([
        ['INDIAGNOSTIC', '2026-02-02T08:00:00Z'],
        ['DIAGNOSTIC_Pause', '2026-02-02T08:30:00Z'],
        ['INDIAGNOSTIC', '2026-02-02T09:00:00Z'],
        ['DIAGNOSTIC_Pause', '2026-02-02T09:30:00Z'],
        ['INDIAGNOSTIC', '2026-02-02T09:55:00Z'],
        ['DIAGNOSTIC_Pause', '2026-02-02T10:10:00Z'],
        ['INDIAGNOSTIC', '2026-02-02T10:20:00Z'],
        ['PENDING3', '2026-02-02T11:00:00Z'],
        ['INREPARATION', '2026-02-02T11:10:00Z'],
        ['REPARATION_Pause', '2026-02-02T11:40:00Z'],
        ['INREPARATION', '2026-02-02T12:25:00Z'],
        ['REPARATION_Pause', '2026-02-02T12:40:00Z'],
        ['INREPARATION', '2026-02-02T13:00:00Z'],
        ['FINISHED', '2026-02-02T13:30:00Z'],
      ]),
      'FINISHED',
      null,
      Date.parse('2026-02-02T14:00:00Z'),
    );
    const passages = buildPhasePassages(flow);
    const table = buildPhaseTable(passages, buildFlowOverview(flow, passages), flow);
    const min = 60_000;
    const diag = table.rows.find((r) => r.group === 'diagnostic')!;
    const rep = table.rows.find((r) => r.group === 'repair')!;

    expect(diag.pauses.map((p) => p.ms)).toEqual([30 * min, 25 * min, 10 * min]);
    expect(diag.avgPauseMs).toBe(Math.round((65 * min) / 3));
    expect(diag.pauseShareLabel).toBe('36 %'); // 65 min sur 3 h
    expect(rep.pauses.map((p) => p.ms)).toEqual([45 * min, 20 * min]);
    expect(rep.avgPauseMs).toBe(32.5 * min);
    expect(rep.pauseShareLabel).toBe('43 %'); // 65 min sur 2 h 30

    const ps = table.pauseSummary;
    expect(ps.count).toBe(5);
    expect(ps.totalMs).toBe(130 * min);
    expect(ps.longestMs).toBe(45 * min);
    expect(ps.avgMs).toBe(26 * min);
    expect(ps.ongoing).toBeNull();
    expect(ps.byPhase.map((b) => [b.group, b.count, b.ms])).toEqual([
      ['diagnostic', 3, 65 * min],
      ['repair', 2, 65 * min],
    ]);
  });

  it('compteur de pauses : la pause en cours est comptée mais pas moyennée', () => {
    const flow = buildStatusFlow(
      H([
        ['INDIAGNOSTIC', '2026-01-01T08:00:00Z'],
        ['DIAGNOSTIC_Pause', '2026-01-01T09:00:00Z'],
        ['INDIAGNOSTIC', '2026-01-01T09:20:00Z'],
        ['DIAGNOSTIC_Pause', '2026-01-01T10:00:00Z'],
      ]),
      'DIAGNOSTIC_Pause',
      null,
      Date.parse('2026-01-01T10:30:00Z'),
    );
    const passages = buildPhasePassages(flow);
    const table = buildPhaseTable(passages, buildFlowOverview(flow, passages), flow);
    const diag = table.rows.find((r) => r.group === 'diagnostic')!;
    expect(diag.avgPauseMs).toBe(20 * 60_000);
    expect(diag.pauseShareLabel).toBe('33 %'); // 50 min sur 2 h 30

    const ps = table.pauseSummary;
    expect(ps.count).toBe(2);
    expect(ps.avgMs).toBe(20 * 60_000);
    expect(ps.ongoing?.index).toBe(2);
    expect(ps.ongoing?.startAt).toEqual(new Date('2026-01-01T10:00:00Z'));
  });

  it('compteur de pauses sans `flow` ou sans historique : nombre seul, rien d’inventé', () => {
    const flow = liveFlow(T1421_HISTORY, 'FINISHED');
    const passages = buildPhasePassages(flow, ANOM);
    const ps = buildPhaseTable(passages, buildFlowOverview(flow, passages)).pauseSummary;
    expect(ps.count).toBe(9);
    expect(ps.longestMs).toBeNull();
    expect(ps.avgMs).toBeNull();
    expect(ps.byPhase.map((b) => b.group)).toEqual(['diagnostic']);

    const empty = buildStatusFlow([], 'PENDING1', null);
    const none = buildPhaseTable(buildPhasePassages(empty), buildFlowOverview(empty), empty)
      .pauseSummary;
    expect(none).toEqual({
      count: 0,
      totalMs: 0,
      longestMs: null,
      avgMs: null,
      ongoing: null,
      byPhase: [],
    });
  });

  it('historique vide : aucune ligne, totaux nuls', () => {
    const flow = buildStatusFlow([], 'PENDING1', null);
    const table = buildPhaseTable(buildPhasePassages(flow), buildFlowOverview(flow), flow);
    expect(table.rows).toEqual([]);
    expect(table.totalMs).toBe(0);
    expect(table.totalPauseCount).toBe(0);
    expect(table.startAt).toBeNull();
    expect(table.endAt).toBeNull();
  });
});

describe('buildWorkJournal', () => {
  const journalC1 = () =>
    buildWorkJournal({
      kind: 'diag',
      segments: T1270_SEGMENTS_C1,
      history: sanitizeHistory(T1270_HISTORY),
      flow: t1270Flow(1),
      storedCumul: '44:06:55',
      now: LATER,
    });

  it('T1270 : Σ segments rapprochée du cumul enregistré', () => {
    const j = journalC1();
    expect(j.workCount).toBe(7);
    expect(j.workMs).toBe(158_809_780);
    expect(j.storedMs).toBe(158_815_000);
    expect(j.deltaMs).toBe(-5_220);
    expect(j.matchesStored).toBeTrue();
    expect(j.longCount).toBe(1);
    expect(j.droppedSegments).toBe(0);
  });

  it('T1270 : nomme ce qui ouvre et ferme chaque segment', () => {
    const work = journalC1().rows.filter((r) => r.kind === 'work');
    // 1er segment : repris après la pause du 29/07.
    expect(work[0].startCause).toBe('Reprise');
    expect(work[0].endCause).toBe('Mise en pause');
    // Le segment de 44 h : la réécriture INDIAGNOSTIC du 26/08 n'est pas une cause.
    expect(work[1].ms).toBe(158_587_401);
    expect(work[1].long).toBeTrue();
    expect(work[1].startCause).toBe('Reprise');
    expect(work[1].endCause).toBe('Mise en pause');
    expect(work[6].endCause).toBe('Fin du diagnostic → En attente prix');
  });

  it('T1270 : pauses d’après l’historique serveur, intervalles sans segment signalés', () => {
    const j = journalC1();
    expect(j.pauseCount).toBe(8);
    expect(j.pauseMs).toBe(2_253_245_581);
    const pause = j.rows.filter((r) => r.kind === 'pause');
    // Historique (2 265 ms), pas l'écart entre segments (2 257 ms).
    expect(pause[2].ms).toBe(2_265);
    expect(j.untrackedCount).toBe(2);
    expect(j.untrackedMs).toBe(13_535);
    const starts = j.rows.map((r) => r.start.getTime());
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it('T1270 : aucune réparation chronométrée', () => {
    const r = buildWorkJournal({
      kind: 'rep',
      segments: [],
      history: sanitizeHistory(T1270_HISTORY),
      flow: t1270Flow(1),
      storedCumul: '',
      now: LATER,
    });
    expect(r.rows.length).toBe(0);
    expect(r.hasData).toBeFalse();
  });

  it('abandon : la fermeture est attribuée au technicien et à son motif', () => {
    const history = H([
      ['DIAGNOSTIC', '2026-09-01T08:00:00Z'],
      ['INDIAGNOSTIC', '2026-09-01T08:01:00Z'],
      ['PENDING1', '2026-09-01T09:00:00.050Z'],
    ]);
    const j = buildWorkJournal({
      kind: 'diag',
      segments: [{ startedAt: '2026-09-01T08:01:00.010Z', stoppedAt: '2026-09-01T09:00:00.060Z' }],
      history,
      flow: buildStatusFlow(history, 'PENDING1', null, Date.parse('2026-09-01T10:00:00Z')),
      assignments: [{ tech: 'Ali', motif: 'absent', abandonedAt: '2026-09-01T09:00:00.080Z' }],
      now: Date.parse('2026-09-01T10:00:00Z'),
    });
    expect(j.rows[0].startCause).toBe('Démarrage');
    expect(j.rows[0].endCause).toBe('Abandon — Ali (absent)');
  });

  it('segment ouvert : ligne « en cours » depuis l’ancre, longue au-delà de 12 h', () => {
    const history = H([
      ['DIAGNOSTIC', '2026-09-01T08:00:00Z'],
      ['INDIAGNOSTIC', '2026-09-01T08:01:00Z'],
    ]);
    const now = Date.parse('2026-09-01T08:31:00Z');
    const j = buildWorkJournal({
      kind: 'diag',
      segments: [],
      history,
      flow: buildStatusFlow(history, 'INDIAGNOSTIC', null, now),
      openAnchor: '2026-09-01T08:01:00.005Z',
      now,
    });
    expect(j.rows.length).toBe(1);
    expect(j.rows[0].kind).toBe('running');
    expect(j.runningMs).toBe(1_799_995);
    expect(j.untrackedCount).toBe(0);
    const late = buildWorkJournal({
      kind: 'diag',
      segments: [],
      history,
      flow: buildStatusFlow(history, 'INDIAGNOSTIC', null, now),
      openAnchor: '2026-08-30T08:00:00Z',
      now,
    });
    expect(late.rows.find((r) => r.kind === 'running')?.long).toBeTrue();
  });

  it('pause en cours : durée jusqu’à maintenant, hors total des pauses closes', () => {
    const history = H([
      ['INDIAGNOSTIC', '2026-09-01T08:00:00Z'],
      ['DIAGNOSTIC_Pause', '2026-09-01T08:30:00Z'],
    ]);
    const now = Date.parse('2026-09-01T09:00:00Z');
    const j = buildWorkJournal({
      kind: 'diag',
      segments: [{ startedAt: '2026-09-01T08:00:00.004Z', stoppedAt: '2026-09-01T08:30:00.004Z' }],
      history,
      flow: buildStatusFlow(history, 'DIAGNOSTIC_Pause', null, now),
      now,
    });
    const pause = j.rows.find((r) => r.kind === 'pause');
    expect(pause?.ongoing).toBeTrue();
    expect(pause?.endCause).toBeNull();
    expect(j.pauseOngoingMs).toBe(1_800_000);
    expect(j.pauseMs).toBe(0);
  });

  it('segments invalides écartés, doublons et désordre normalisés', () => {
    const j = buildWorkJournal({
      kind: 'diag',
      segments: [
        { startedAt: '2026-09-01T10:00:00Z', stoppedAt: '2026-09-01T10:10:00Z' },
        { startedAt: '2026-09-01T08:00:00Z', stoppedAt: '2026-09-01T08:10:00Z' },
        { startedAt: '2026-09-01T08:00:00Z', stoppedAt: '2026-09-01T08:10:00Z' },
        { startedAt: '2026-09-01T12:00:00Z', stoppedAt: '2026-09-01T11:00:00Z' },
        { startedAt: null, stoppedAt: '2026-09-01T11:00:00Z' },
      ],
      history: [],
      flow: buildStatusFlow([], null, null),
    });
    expect(j.workCount).toBe(2);
    expect(j.droppedSegments).toBe(2);
    expect(j.rows[0].start.toISOString()).toBe('2026-09-01T08:00:00.000Z');
    expect(j.rows[0].startCause).toContain('non tracée');
    expect(j.rows[0].endCause).toContain('non tracée');
  });
});

describe('pauses héritées (journal navigateur)', () => {
  it('T1270 cycle 0 : heures de Tunis, durées exactes', () => {
    const rows = buildLegacyPauseRows(T1270_PAUSELOGS_C0, 'diag', null, LATER);
    expect(rows.map((r) => [r.start.toISOString(), r.state, r.ms])).toEqual([
      ['2026-02-10T10:01:17.000Z', 'closed', 37_000],
      ['2026-02-10T10:01:56.000Z', 'closed', 11_449_000],
    ]);
    expect(pauseSourceFor('diag', t1270Flow(0), rows)).toBe('legacy');
    expect(pauseSourceFor('diag', t1270Flow(1), rows)).toBe('history');
  });

  it('écarte les ouvertures répétées, date une pause vraiment en cours', () => {
    const logs = [
      { pauseType: 'diag', pauseStart: '2026/08/26:09:40:51', pauseEnd: '2026/08/26:09:42:56' },
      { pauseType: 'diag', pauseStart: '2026/08/26:09:40:53', pauseEnd: null },
      { pauseType: 'diag', pauseStart: '2026/08/26:09:45:00', pauseEnd: null },
      { pauseType: 'diag', pauseStart: '2026/08/26:09:45:01', pauseEnd: null },
      { pauseType: 'diag', pauseStart: '2026/08/26:10:00:00', pauseEnd: null },
      { pauseType: 'rep', pauseStart: '2026/08/26:11:00:00', pauseEnd: null },
    ];
    const now = Date.parse('2026-08-26T09:30:00Z');
    const rows = buildLegacyPauseRows(logs, 'diag', 'DIAGNOSTIC_Pause', now);
    expect(rows.map((r) => r.state)).toEqual(['closed', 'open', 'ongoing']);
    expect(rows[2].ms).toBe(30 * 60 * 1000);
    expect(buildLegacyPauseRows(logs, 'rep', null).length).toBe(1);
    const bad = buildLegacyPauseRows(
      [{ pauseType: 'diag', pauseStart: '2026/08/26:10:00:00', pauseEnd: '2026/08/26:09:00:00' }],
      'diag',
      null,
    );
    expect(bad[0].state).toBe('inconsistent');
  });
});

describe('buildAssignmentRows', () => {
  it('abandon = temps figé ; dernier affecté = cumul − déjà cumulé (+ en cours)', () => {
    const now = Date.parse('2026-09-01T12:10:00Z');
    const s = buildAssignmentRows(
      [
        { tech: 'Ali', assignedAt: '2026-09-01T08:00:00Z', abandonedAt: '2026-09-01T10:00:00Z', motif: 'absent', abandonedBy: 'Coord', diagTimeStart: '00:00:00', diagTime: '01:30:00' },
        { tech: 'Sami', assignedAt: '2026-09-01T11:00:00Z', diagTimeStart: '01:30:00', diagTime: null },
      ],
      '02:00:00',
      '2026-09-01T12:00:00Z',
      now,
    );
    expect(s.rows[0].workedMs).toBe(5_400_000);
    expect(s.rows[0].workedSource).toBe('stored');
    expect(s.rows[1].alreadyMs).toBe(5_400_000);
    expect(s.rows[1].workedMs).toBe(1_800_000 + 600_000);
    expect(s.rows[1].running).toBeTrue();
    expect(s.totalWorkedMs).toBe((s.storedMs as number) + (s.runningMs as number));
  });

  it('signale les données incomplètes au lieu de les inventer', () => {
    const s = buildAssignmentRows(
      [
        { tech: 'Ali', assignedAt: '2026-09-01T08:00:00Z', diagTimeStart: '00:00:00' },
        { tech: '0123456789abcdef01234567', assignedAt: '2026-09-01T09:00:00Z', diagTimeStart: null },
      ],
      '01:00:00',
      null,
    );
    expect(s.rows[0].anomaly).not.toBeNull();
    expect(s.rows[1].tech).toBe('—');
    expect(s.rows[1].alreadyMs).toBeNull();
    expect(s.totalWorkedMs).toBeNull();
  });
});
