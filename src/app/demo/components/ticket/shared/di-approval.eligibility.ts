/**
 * La modale « Approval (devis/BC) » de `ticket-list` (`negocite1Modal`) — où se
 * téléversent le devis et le bon de commande — a-t-elle un objet pour cette DI ?
 *
 * SOURCE UNIQUE partagée par le bouton de la liste et le deep-link des
 * notifications de document (`?action=approval`) : sans elle, une notification
 * pourrait ouvrir la modale sur une DI que le bouton n'autorise plus.
 *
 * Split WAITING_DEVIS / WAITING_BC, plus NEGOTIATION1 / ATTENTE_BC_DEVIS hérités
 * non migrés ; un IRRÉPARABLE ne l'est que sur un retour non imputable à
 * Fixtronix.
 */
const APPROVAL_STATUSES: ReadonlySet<string> = new Set([
    'WAITING_DEVIS',
    'WAITING_BC',
    'NEGOTIATION1',
    'ATTENTE_BC_DEVIS',
]);

export function canOpenApproval(
    di:
        | {
              status?: string | null;
              ignoreCount?: number | null;
              isErrorFromFixtronix?: boolean | null;
          }
        | null
        | undefined,
): boolean {
    const status = di?.status ?? '';
    if (APPROVAL_STATUSES.has(status)) return true;
    return (
        status === 'IRREPARABLE' &&
        (di?.ignoreCount ?? 0) > 0 &&
        di?.isErrorFromFixtronix !== true
    );
}
