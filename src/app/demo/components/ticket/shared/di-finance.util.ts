/**
 * Tableau « Finances » du modal « Dossier d'intervention ».
 *
 * Fonction PURE : le composant ne fait que lui passer les montants du cycle
 * affiché.
 *   - Coût réel  = main-d'œuvre calculée par l'ERP (temps × taux horaire).
 *   - Composants = Σ prix de vente × quantité (catalogue, cycle affiché).
 *   - Facturé    = montants SAISIS (prix diagnostic, estimation réparation).
 *   - Écart      = Facturé − (Coût réel + Composants). Soustraction simple :
 *                  plus de plancher 150 TND.
 */

export type EcartTone = 'pos' | 'neg' | 'neutral';

export interface FinanceEcart {
    /** Aucun montant facturé à comparer → « — ». */
    absent: boolean;
    montant: number;
    /** Écart rapporté au coût ; `null` quand le coût est nul (pas de base). */
    percent: number | null;
    tone: EcartTone;
}

export interface FinanceRow {
    phase: string;
    coutReel: number | null;
    /** `null` → « — ». */
    composants: number | null;
    facture: number | null;
    ecart: FinanceEcart | null;
    isTotal?: boolean;
    nonPayant?: boolean;
    /** Réparation : variation des pièces depuis le diagnostic (`null` = aucune). */
    composantsRise?: number | null;
    /** Diagnostic : prix des pièces non enregistré à ce moment (DI antérieure),
     *  le montant affiché est le prix actuel du catalogue. */
    composantsUnrecorded?: boolean;
}

export interface FinanceInput {
    diagLabor: number;
    repLabor: number;
    /** Pièces au prix de la RÉPARATION (ou prix actuel tant qu'elle n'est pas finie). */
    composants: number;
    /** Pièces au prix enregistré au DIAGNOSTIC. Absent → ligne Diagnostic sans pièces. */
    composantsDiag?: number | null;
    /** `false` : au moins une pièce sans prix de diagnostic enregistré. */
    composantsDiagRecorded?: boolean;
    /** `null` = absent. `0` est un montant. */
    factureDiag: number | null;
    factureRep: number | null;
    /** Diagnostic non payant : « Non facturé », hors du facturé total. */
    nonPayant: boolean;
}

function round3(n: number): number {
    return Math.round(n * 1000) / 1000;
}

function isAmount(v: number | null | undefined): v is number {
    return v !== null && v !== undefined && Number.isFinite(v);
}

/** Écart = facturé − coût. Facturé absent → `absent` ; `0` est un montant. */
export function computeEcart(
    facture: number | null,
    cout: number,
): FinanceEcart {
    if (!isAmount(facture)) {
        return { absent: true, montant: 0, percent: null, tone: 'neutral' };
    }
    const basis = Number.isFinite(cout) ? cout : 0;
    const montant = round3(facture - basis);
    const percent = basis > 0 ? (montant / basis) * 100 : null;
    const tone: EcartTone =
        Math.abs(montant) < 0.5 && Math.abs(percent ?? 0) < 1
            ? 'neutral'
            : montant > 0
              ? 'pos'
              : 'neg';
    return { absent: false, montant, percent, tone };
}

/** Lignes Diagnostic, Réparation, Total. Les pièces sont montrées au prix de
 *  CHAQUE phase : au diagnostic (prix enregistré, à défaut prix actuel) et à la
 *  réparation. L'écart du diagnostic reste la main-d'œuvre seule (le prix
 *  facturé du diagnostic ne couvre pas les pièces) ; réparation et total
 *  comptent les pièces une seule fois, au prix de la réparation. */
export function buildFinanceRows(i: FinanceInput): FinanceRow[] {
    const diagLabor = round3(i.diagLabor || 0);
    const repLabor = round3(i.repLabor || 0);
    const composants = round3(i.composants || 0);
    const composantsDiag = isAmount(i.composantsDiag)
        ? round3(i.composantsDiag)
        : null;
    const rise =
        composantsDiag === null ? 0 : round3(composants - composantsDiag);
    const factureDiag =
        i.nonPayant || !isAmount(i.factureDiag) ? null : i.factureDiag;
    const factureRep = isAmount(i.factureRep) ? i.factureRep : null;
    const presents = [factureDiag, factureRep].filter(isAmount);
    const factureTotal = presents.length
        ? round3(presents.reduce((a, b) => a + b, 0))
        : null;
    const laborTotal = round3(diagLabor + repLabor);
    return [
        {
            phase: 'Diagnostic',
            coutReel: diagLabor,
            composants: composantsDiag,
            facture: factureDiag,
            ecart: i.nonPayant ? null : computeEcart(factureDiag, diagLabor),
            nonPayant: i.nonPayant,
            composantsUnrecorded:
                composantsDiag !== null && i.composantsDiagRecorded === false,
        },
        {
            phase: 'Réparation',
            coutReel: repLabor,
            composants,
            facture: factureRep,
            ecart: computeEcart(factureRep, round3(repLabor + composants)),
            composantsRise: Math.abs(rise) >= 0.001 ? rise : null,
        },
        {
            phase: 'Total',
            coutReel: laborTotal,
            composants,
            facture: factureTotal,
            ecart: computeEcart(factureTotal, round3(laborTotal + composants)),
            isTotal: true,
        },
    ];
}
