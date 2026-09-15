import { parseStandardDocName } from './doc-file-name.util';

/** Instants attendus en ISO UTC : le résultat ne dépend pas du fuseau de la
 *  machine qui exécute les tests. */
const utc = (name: string) => parseStandardDocName(name)?.uploadedAt.toISOString() ?? null;

describe('parseStandardDocName', () => {
  it('lit le nom standard du back, en heure de Tunis — cas réel T1480', () => {
    const p = parseStandardDocName('KHALEDsoltani_Devis_14-09-2026_19-17-44.pdf');
    expect(p?.entity).toBe('KHALEDsoltani');
    expect(p?.type).toBe('Devis');
    expect(p?.uploadedAt.toISOString()).toBe('2026-09-14T18:17:44.000Z');
  });

  it('accepte une entité qui contient « _ » et une extension en majuscules', () => {
    const p = parseStandardDocName('ACME_TN_BL_01-02-2026_08-05-09.PDF');
    expect(p?.entity).toBe('ACME_TN');
    expect(p?.type).toBe('BL');
    expect(p?.uploadedAt.toISOString()).toBe('2026-02-01T07:05:09.000Z');
  });

  it('lit les quatre documents et la photo', () => {
    for (const type of ['BC', 'Devis', 'BL', 'Facture', 'Image']) {
      expect(parseStandardDocName(`LAMDA_${type}_11-09-2026_14-00-00.jpeg`)?.type)
        .withContext(type)
        .toBe(type);
    }
  });

  it('refuse une date impossible plutôt que d’en inventer une', () => {
    expect(utc('X_BC_31-02-2026_10-00-00.pdf')).toBeNull();
    expect(utc('X_BC_14-09-2026_25-00-00.pdf')).toBeNull();
  });

  it('ignore les noms hors standard (seed, ancien stockage disque, vide)', () => {
    for (const name of ['devis-SHOW-P1.pdf', 'iCjzwbRQljlo.pdf', 'Devis_14-09-2026_19-17-44.pdf', '', '   ']) {
      expect(parseStandardDocName(name)).withContext(JSON.stringify(name)).toBeNull();
    }
    expect(parseStandardDocName(null)).toBeNull();
    expect(parseStandardDocName(undefined)).toBeNull();
  });
});
