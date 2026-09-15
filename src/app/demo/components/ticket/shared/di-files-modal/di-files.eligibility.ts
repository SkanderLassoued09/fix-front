/**
 * Une DI accepte-t-elle le téléversement de ses documents ?
 *
 * SOURCE UNIQUE de la règle, partagée par le bouton trombone de `ticket-list`,
 * par le service qui ouvre la modale depuis une notification et par la modale
 * elle-même : un deep-link ne doit jamais ouvrir une modale que la liste refuse.
 *
 * IRREPARABLE — TOUTE DI irréparable accepte ses pièces (Devis, BC, BL,
 * Facture), quels que soient le cycle et l'origine de l'erreur (demande
 * utilisateur 2026-09-15). Le statut reste IRREPARABLE ; chaque emplacement se
 * remplit UNE fois (modale + garde back `DOC_ALREADY_UPLOADED`).
 */

/** Statuts dont la modale « Affectation des Fichiers » a un objet. */
const AFFECTATION_STATUSES = [
    'WAITING_BL',
    'WAITING_FACTURE',
    'CLOSING',
    'ATTENTE_BL_FACTURE',
    'FINISHED',
    'IRREPARABLE',
];

export function canAffectFiles(di: any): boolean {
    const status = di?.status;
    if (!status) return false;
    return AFFECTATION_STATUSES.includes(status);
}
