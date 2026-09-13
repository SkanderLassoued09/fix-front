/**
 * Une DI accepte-t-elle le téléversement de ses documents de clôture ?
 *
 * SOURCE UNIQUE de la règle, partagée par le service qui ouvre la modale depuis
 * une notification et par la modale elle-même.
 *
 * On adopte la règle STRICTE — celle du bouton trombone
 * (`ticket-list.component.html:1286-1295`) — et non celle, plus permissive, de
 * l'ancienne branche de deep-link (`openFromParams`, qui acceptait
 * `IRREPARABLE` nu). Les deux divergeaient : une DI `IRREPARABLE` sans retour,
 * ou dont l'erreur vient de Fixtronix, n'a pas de documents à joindre et
 * n'affiche donc aucun bouton dans la liste ; le deep-link ne doit pas ouvrir
 * une modale que l'interface refuse par ailleurs.
 */

/** Statuts acceptés sans condition supplémentaire. */
const AFFECTATION_STATUSES = [
    'WAITING_BL',
    'WAITING_FACTURE',
    'CLOSING',
    'ATTENTE_BL_FACTURE',
    'FINISHED',
];

export function canAffectFiles(di: any): boolean {
    const status = di?.status;
    if (!status) return false;
    if (AFFECTATION_STATUSES.includes(status)) return true;
    // IRREPARABLE : seulement APRÈS un retour, et jamais si l'erreur est imputée
    // à Fixtronix (pas de facturation, donc pas de BL/facture à joindre).
    return (
        status === 'IRREPARABLE' &&
        (di?.ignoreCount ?? 0) > 0 &&
        di?.isErrorFromFixtronix !== true
    );
}
