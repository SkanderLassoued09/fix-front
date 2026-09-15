import { DateTime } from 'luxon';

import { APP_ZONE } from '../../../../shared/date-time.util';

/**
 * Nom STANDARD d'un document téléversé sur Drive, tel que le back le fabrique
 * (`GoogleDriveService.buildDocFileName`) :
 *   `{Nom}_{Type}_{JJ-MM-AAAA}_{HH-mm-ss}.{ext}` — heure de Tunis, 24 h.
 *   → `KHALEDsoltani_Devis_14-09-2026_19-17-44.pdf`
 *
 * C'est la seule trace fiable de la date de dépôt : `driveDocs` ne la stocke
 * pas et le journal ERP (`DI_DOC_*`) n'en date qu'une partie, jamais la
 * facture, et sans auteur. Le `{Nom}` est celui du client / de la société
 * (nettoyé, il peut contenir « _ »), PAS celui de la personne qui a déposé.
 */
export interface StandardDocName {
  entity: string;
  type: string;
  uploadedAt: Date;
}

/** Type et horodatage ancrés en FIN de nom : le `{Nom}` peut contenir « _ ». */
const STANDARD_DOC_NAME = /^(.+)_([A-Za-z]+)_(\d{2}-\d{2}-\d{4}_\d{2}-\d{2}-\d{2})\.[A-Za-z0-9]+$/;

/** Nom standard → entité, type, instant de dépôt ; `null` sinon. Ne lève jamais. */
export function parseStandardDocName(name: string | null | undefined): StandardDocName | null {
  const m = STANDARD_DOC_NAME.exec(String(name ?? '').trim());
  if (!m) return null;
  const at = DateTime.fromFormat(m[3], 'dd-MM-yyyy_HH-mm-ss', { zone: APP_ZONE });
  return at.isValid ? { entity: m[1], type: m[2], uploadedAt: at.toJSDate() } : null;
}
