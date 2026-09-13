/**
 * Jointure « ligne de DI » → « fiche catalogue », et dérivés d'affichage.
 *
 * Une ligne de DI ne porte que `{ nameComposant, quantity, isUpdated }`
 * (`ComposantStructure` / `ComposantStructureLogs` côté back) : le prix, le
 * statut, la date d'arrivage et le stock vivent dans la collection CATALOGUE
 * `Composant`. La seule clé de jointure qui existe est le NOM — c'est déjà
 * celle qu'emploient `magasin-di-list` côté front et
 * `di.service.calculateTicketComposantPrice` côté back.
 *
 * Extrait ici (plutôt que dans le composant) pour la même raison que
 * `status-timeline.util.ts` : ce sont des fonctions PURES, testables sans
 * TestBed — et `di-info-modal` n'a pas de spec.
 */

/** Fiche catalogue telle que projetée par `findAllComposant`. */
export interface CatalogComposant {
    _id?: string;
    name?: string;
    package?: string;
    category_composant_id?: string;
    prix_achat?: number;
    prix_vente?: number;
    coming_date?: string;
    link?: string;
    quantity_stocked?: number;
    pdf?: string;
    status_composant?: string;
}

/** Ligne de DI telle que portée par le snapshot de cycle. */
export interface DiComposantSource {
    nameComposant?: string;
    quantity?: number;
    isUpdated?: boolean;
}

/** Ligne de DI enrichie — tout ce que la carte affiche. */
export interface DiComposantLine {
    /** Nom saisi sur le dossier (clé de jointure). */
    name: string;
    /** Quantité DEMANDÉE sur le dossier (jamais celle du stock). */
    quantity: number;
    /** Ligne déjà traitée par le magasin. */
    isUpdated: boolean;
    /** Retrouvée au catalogue ? `false` → carte « hors catalogue ». */
    found: boolean;
    /** `Composant._id`, affiché « Réf. ». */
    ref: string;
    package: string;
    /** Brut : id `C_Composant<N>` OU libellé hérité (champ pollué). */
    categoryRaw: string;
    prixAchat: number | null;
    prixVente: number | null;
    /** Brut « YYYY-MM-DD ». */
    comingDate: string;
    link: string;
    pdf: string;
    statusRaw: string;
    stock: number | null;
    /** `prix_vente × quantity`, ou `null` si le prix de vente est absent. */
    lineTotal: number | null;
}

export type ComposantStatusKey =
    | 'INSTOCK'
    | 'INTERN'
    | 'EXTERN'
    | 'UNKNOWN'
    | 'ORPHAN';

export type StockHealth = 'ok' | 'low' | 'out' | 'unknown';

/** Seuil de réapprovisionnement — aligné sur `magasin-di-list`. */
export const DEFAULT_REAPPRO_THRESHOLD = 5;

/**
 * Normalise une valeur de catalogue. Des lignes héritées contiennent
 * LITTÉRALEMENT les chaînes « undefined » / « null » : elles doivent être
 * traitées comme vides (même constat que `composant-management.formatValue`).
 * Rend `''` et non « — » : c'est à l'appelant de choisir le placeholder.
 */
export function cleanComposantValue(v: any): string {
    const s = String(v ?? '').trim();
    if (!s || s === 'undefined' || s === 'null' || s === 'NaN') return '';
    return s;
}

/** Nombre fini, ou `null`. Ne JAMAIS replier un prix absent sur 0. */
function toNumberOrNull(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/** Arrondi monétaire à 3 décimales (TND), comme `coutRepair` dans le modal. */
function round3(n: number): number {
    return Math.round(n * 1000) / 1000;
}

/**
 * Statut composant → clé de pastille, TOLÉRANTE aux trois vocabulaires qui
 * coexistent dans la base et le code :
 *   - réellement persisté par l'UI : « En stock » / « Interne » / « Externe »
 *   - constantes back (mortes)     : « EnStock » / « Interne » / « Externe »
 *   - constantes front (mortes)    : « INSTOCK » / « INTERN » / « EXTERN »
 * Le back accepte déjà les deux premières graphies (`di.service.ts`).
 *
 * NB : ne pas rebrancher `composant-management.statusClass()` là-dessus — son
 * spec fige `'INSTOCK' → composant-UNKNOWN`. Les deux mappages coexistent.
 */
export function composantStatusKey(raw: any): ComposantStatusKey {
    const s = cleanComposantValue(raw)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[\s_-]+/g, '');
    if (!s) return 'UNKNOWN';
    if (s === 'enstock' || s === 'instock') return 'INSTOCK';
    if (s === 'interne' || s === 'intern') return 'INTERN';
    if (s === 'externe' || s === 'extern') return 'EXTERN';
    return 'UNKNOWN';
}

/** Santé du stock — mêmes trois états que `magasin-di-list`. */
export function stockHealth(
    stock: number | null,
    seuil: number = DEFAULT_REAPPRO_THRESHOLD,
): StockHealth {
    if (stock === null) return 'unknown';
    if (stock <= 0) return 'out';
    if (stock < seuil) return 'low';
    return 'ok';
}

/** Libellé de la pastille de stock. */
export function stockBadgeLabel(
    stock: number | null,
    seuil: number = DEFAULT_REAPPRO_THRESHOLD,
): string {
    switch (stockHealth(stock, seuil)) {
        case 'unknown':
            return '—';
        case 'out':
            return 'Rupture · 0';
        case 'low':
            return 'Stock faible · ' + stock;
        default:
            return 'En stock · ' + stock;
    }
}

/**
 * Date d'arrivage → « JJ/MM/AAAA ».
 *
 * `coming_date` est une STRING, et le champ a été écrit sous DEUX formes selon
 * l'époque (constat sur la base : ~36 lignes saines, ~100 héritées) :
 *   - « 2026-08-06 » (saine, écrite par le formulaire actuel) ;
 *   - « Fri Jan 23 2026 00:00:00 GMT+0100 (heure normale …) », soit un
 *     `Date.prototype.toString()` complet sérialisé tel quel ;
 *   - plus la sentinelle littérale « Invalid Date ».
 *
 * La forme saine est découpée TEXTUELLEMENT : surtout pas de `new Date()` ni de
 * `formatTimelineDate` dessus — en Africa/Tunis (UTC+1) le détour afficherait
 * la veille (même piège que `toDateInput` dans le modal) et ajouterait l'heure.
 */
export function formatComingDate(raw: any): string {
    const s = cleanComposantValue(raw);
    if (!s || s === 'Invalid Date') return '';

    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

    // Forme héritée : la chaîne PORTE son propre décalage, donc lire les
    // composantes LOCALES retombe sur le bon jour civil.
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${d.getFullYear()}`;
    }
    return s;
}

/**
 * Indexe le catalogue par nom normalisé (trim + casse ignorée) pour absorber
 * les écarts de saisie entre le dossier et la fiche. Première occurrence
 * gagnante — `name` est unique au schéma.
 */
export function buildComposantIndex(
    catalog: ReadonlyArray<CatalogComposant> | null | undefined,
): Map<string, CatalogComposant> {
    const byName = new Map<string, CatalogComposant>();
    for (const row of catalog ?? []) {
        const key = cleanComposantValue(row?.name).toLowerCase();
        if (key && !byName.has(key)) byName.set(key, row);
    }
    return byName;
}

/**
 * Jointure. Fonction PURE de (lignes du cycle, catalogue) : elle vaut donc
 * pour TOUS les cycles, cycle 0 compris, sans jamais retomber sur la racine
 * `di` — même discipline que `cycleSnapshot`.
 */
export function enrichComposants(
    lines: ReadonlyArray<DiComposantSource> | null | undefined,
    byName: ReadonlyMap<string, CatalogComposant> | null | undefined,
): DiComposantLine[] {
    const index = byName ?? new Map<string, CatalogComposant>();
    return (lines ?? []).map((line) => {
        const name = cleanComposantValue(line?.nameComposant);
        const quantity = Number(line?.quantity ?? 0) || 0;
        const cat = index.get(name.toLowerCase());
        const prixVente = toNumberOrNull(cat?.prix_vente);
        return {
            name,
            quantity,
            isUpdated: line?.isUpdated === true,
            found: !!cat,
            ref: cleanComposantValue(cat?._id),
            package: cleanComposantValue(cat?.package),
            categoryRaw: cleanComposantValue(cat?.category_composant_id),
            prixAchat: toNumberOrNull(cat?.prix_achat),
            prixVente,
            comingDate: cleanComposantValue(cat?.coming_date),
            link: cleanComposantValue(cat?.link),
            pdf: cleanComposantValue(cat?.pdf),
            statusRaw: cleanComposantValue(cat?.status_composant),
            stock: toNumberOrNull(cat?.quantity_stocked),
            lineTotal: prixVente === null ? null : round3(prixVente * quantity),
        };
    });
}

/** Σ des totaux de ligne — les lignes SANS prix sont ignorées, pas comptées 0. */
export function composantsGrandTotal(
    lines: ReadonlyArray<DiComposantLine> | null | undefined,
): number {
    let total = 0;
    for (const l of lines ?? []) if (l.lineTotal !== null) total += l.lineTotal;
    return round3(total);
}

/** Nombre de lignes ayant réellement contribué au total. */
export function composantsPricedCount(
    lines: ReadonlyArray<DiComposantLine> | null | undefined,
): number {
    let n = 0;
    for (const l of lines ?? []) if (l.lineTotal !== null) n++;
    return n;
}
