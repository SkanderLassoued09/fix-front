export enum STATUS_DI {
    CREATED = 'CREATED', // withoutr affecting to coordinator	    CREATED = 'CREATED',
    PENDING1 = 'PENDING1', // affected to coordinator	    PENDING1 = 'PENDING1',
    DIAGNOSTIC = 'DIAGNOSTIC',
    INDIAGNOSTIC = 'INDIAGNOSTIC',
    // Handshake v2 — membre TS `INMAGASIN` conservé (identifiant interne stable) ;
    // VALEUR renommée MAGASIN_PREPARATION → PROCESSING → 'CONFIRMATION' (migration
    // 009). Valeur legacy `PROCESSING` tolérée en AFFICHAGE (timeline/maps).
    INMAGASIN = 'CONFIRMATION',
    MAGASIN_FINALISATION = 'MAGASIN_FINALISATION',
    MagasinEstimation = 'MagasinEstimation',
    // Poignée de main magasin ↔ coordinatrice (ex-CONFIRMATION_COMPOSANTS).
    ATTENTE_CONFIRMATION_COORDINATION = 'ATTENTE_CONFIRMATION_COORDINATION',
    PENDING2 = 'PENDING2',
    // Membre conservé (PRICING), VALEUR renommée en PRICING_DIAG —
    // les comparaisons `STATUS_DI.PRICING` pointent sur la nouvelle valeur sans
    // changer les call sites. Migration : PRICING → PRICING_DIAG.
    // Les DI pas encore migrées portent l'ancienne valeur → utiliser
    // `isPricingStatus()` pour les comparaisons runtime (tolérant aux deux).
    PRICING = 'PRICING_DIAG',
    // Phase « Approval » documentaire — SPLIT de l'ancien ATTENTE_BC_DEVIS
    // (ex-NEGOTIATION1) en DEUX gates pilotés par l'upload : WAITING_DEVIS →
    // (devis) → WAITING_BC → (BC) → suite du flux. Legacy toléré via
    // `isApprovalDocStatus`/`APPROVAL_DOC_STATUS_VALUES` (base non migrée).
    WAITING_DEVIS = 'WAITING_DEVIS',
    WAITING_BC = 'WAITING_BC',
    NEGOTIATION2 = 'NEGOTIATION2',
    PENDING3 = 'PENDING3',
    REPARATION = 'REPARATION',
    INREPARATION = 'INREPARATION',
    // Phase de clôture documentaire — SPLIT de l'ancien CLOSING en DEUX gates
    // pilotés par l'upload : WAITING_BL → (BL) → WAITING_FACTURE → (facture) →
    // FINISHED. Legacy toléré via `isClosingStatus`/`CLOSING_STATUS_VALUES`.
    WAITING_BL = 'WAITING_BL',
    WAITING_FACTURE = 'WAITING_FACTURE',
    FINISHED = 'FINISHED',
    ANNULER = 'ANNULER',
    RETOUR1 = 'RETOUR1',
    RETOUR2 = 'RETOUR2',
    RETOUR3 = 'RETOUR3',
}

/**
 * Valeurs de statut acceptées pour la phase « Tarification ».
 * Inclut l'ancienne valeur `PRICING` pour rester correct tant que la migration
 * 004 (PRICING → PRICING_DIAG) n'a pas tourné sur une base donnée.
 */
export const PRICING_STATUS_VALUES: readonly string[] = [
    'PRICING_DIAG',
    'PRICING',
];

/** True si le statut correspond à la phase de tarification diagnostic
 *  (tolérant à l'ancienne valeur `PRICING` non encore migrée). */
export function isPricingStatus(status: string | null | undefined): boolean {
    return status === 'PRICING_DIAG' || status === 'PRICING';
}

/**
 * Phase « Approval » documentaire (WAITING_DEVIS → WAITING_BC). Inclut les
 * valeurs LEGACY (`ATTENTE_BC_DEVIS`, `NEGOTIATION1`) tant que la migration 008
 * du split n'a pas tourné sur une base donnée.
 */
export const APPROVAL_DOC_STATUS_VALUES: readonly string[] = [
    'WAITING_DEVIS',
    'WAITING_BC',
    'ATTENTE_BC_DEVIS',
    'NEGOTIATION1',
];

/** True si le statut est dans la phase Approval documentaire (tolérant aux
 *  valeurs legacy `ATTENTE_BC_DEVIS`/`NEGOTIATION1`). */
export function isApprovalDocStatus(status: string | null | undefined): boolean {
    return APPROVAL_DOC_STATUS_VALUES.includes(status ?? '');
}

/**
 * Phase de clôture documentaire (WAITING_BL → WAITING_FACTURE). Inclut les
 * valeurs LEGACY (`CLOSING`, `ATTENTE_BL_FACTURE`) tant que la migration 008
 * n'a pas tourné.
 */
export const CLOSING_STATUS_VALUES: readonly string[] = [
    'WAITING_BL',
    'WAITING_FACTURE',
    'CLOSING',
    'ATTENTE_BL_FACTURE',
];

/** True si le statut correspond à la phase de clôture documentaire (tolérant
 *  aux anciennes valeurs `CLOSING`/`ATTENTE_BL_FACTURE`). */
export function isClosingStatus(status: string | null | undefined): boolean {
    return CLOSING_STATUS_VALUES.includes(status ?? '');
}
