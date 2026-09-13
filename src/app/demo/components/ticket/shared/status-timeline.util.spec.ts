import {
  buildCycleTimeline,
  labelForStatus,
  sanitizeHistory,
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
