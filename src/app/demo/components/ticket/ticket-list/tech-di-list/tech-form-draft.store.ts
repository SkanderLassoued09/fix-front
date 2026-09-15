/**
 * Brouillons des formulaires TECHNICIEN (diagnostic, réparation), gardés dans le
 * NAVIGATEUR pour survivre à un rafraîchissement, une fermeture d'onglet ou un
 * plantage — puis restaurés automatiquement à la réouverture de la même DI.
 *
 * UNE entrée par technicien × formulaire × ligne `stats` (unique par DI + cycle) :
 *  - ouvrir une autre DI n'écrase plus rien (l'ancien état tenait dans UNE clé) ;
 *  - un autre technicien sur le même poste ne reçoit jamais le brouillon d'un
 *    collègue (l'ancien état n'était lié à personne et survivait à la déconnexion).
 *
 * Seules des valeurs JSON SÛRES sont écrites. L'ancien état embarquait tout le
 * formulaire, dont le `TreeNode` PrimeNG de la pièce en cours de sélection
 * (cyclique : `node.parent`) — `JSON.stringify` levait alors une exception
 * avalée et la sauvegarde ENTIÈRE était perdue en silence.
 *
 * Fonctions pures (+ `localStorage`) : testables sans TestBed.
 */

export type TechDraftMode = 'diagnostic' | 'repair';

export interface TechDraftEnvelope<T> {
    v: 2;
    /** Horodatage (epoch ms) de la dernière écriture. */
    savedAt: number;
    data: T;
}

/** Saisie du diagnostic qui n'est pas encore partie au serveur. */
export interface DiagnosticDraftData {
    remarqueTech: string;
    remarqueExtra: string;
    symptomes: string;
    isPdr: boolean;
    isReparable: boolean;
    isErrorFromFixtronix: boolean;
    di_category_id: string | null;
    composants: Array<{ nameComposant: string; quantity: number }>;
    /** Étape du wizard où le technicien s'était arrêté. */
    step: string;
}

/** Saisie de la réparation qui n'est pas encore partie au serveur. */
export interface RepairDraftData {
    worksDone: string;
    testsDone: string;
    remarqueExtra: string;
    repairSuccess: boolean | null;
    testsValidated: boolean | null;
    warranty: boolean | null;
    parts: Array<{ nameComposant: string; reference: string; quantity: number }>;
    step: string;
}

const PREFIX = 'fix.tech-draft.v2';

/** Une DI mise en pause le soir se reprend le lendemain, voire après un week-end. */
export const TECH_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function techDraftKey(
    techId: string,
    mode: TechDraftMode,
    statId: string,
): string {
    return `${PREFIX}:${techId}:${mode}:${statId}`;
}

function storage(): Storage | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        return null; // navigation privée / stockage bloqué
    }
}

function removeQuietly(s: Storage, key: string): void {
    try {
        s.removeItem(key);
    } catch {
        /* rien à faire */
    }
}

/** Écrit le brouillon. `false` si le stockage est indisponible ou plein. */
export function saveTechDraft<T>(
    techId: string | null | undefined,
    mode: TechDraftMode,
    statId: string | null | undefined,
    data: T,
    now: number = Date.now(),
): boolean {
    const s = storage();
    if (!s || !techId || !statId) return false;
    const envelope: TechDraftEnvelope<T> = { v: 2, savedAt: now, data };
    try {
        s.setItem(techDraftKey(techId, mode, statId), JSON.stringify(envelope));
        return true;
    } catch {
        return false;
    }
}

/** Relit le brouillon ; un brouillon expiré ou illisible est SUPPRIMÉ et vaut `null`. */
export function loadTechDraft<T>(
    techId: string | null | undefined,
    mode: TechDraftMode,
    statId: string | null | undefined,
    now: number = Date.now(),
): TechDraftEnvelope<T> | null {
    const s = storage();
    if (!s || !techId || !statId) return null;
    const key = techDraftKey(techId, mode, statId);
    try {
        const raw = s.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as TechDraftEnvelope<T>;
        if (
            parsed?.v !== 2 ||
            typeof parsed.savedAt !== 'number' ||
            !parsed.data ||
            now - parsed.savedAt > TECH_DRAFT_MAX_AGE_MS
        ) {
            removeQuietly(s, key);
            return null;
        }
        return parsed;
    } catch {
        removeQuietly(s, key);
        return null;
    }
}

export function clearTechDraft(
    techId: string | null | undefined,
    mode: TechDraftMode,
    statId: string | null | undefined,
): void {
    const s = storage();
    if (!s || !techId || !statId) return;
    removeQuietly(s, techDraftKey(techId, mode, statId));
}

/** Supprime les brouillons expirés ou illisibles (tous techniciens confondus). */
export function purgeExpiredTechDrafts(now: number = Date.now()): void {
    const s = storage();
    if (!s) return;
    const keys: string[] = [];
    try {
        for (let i = 0; i < s.length; i++) {
            const key = s.key(i);
            if (key?.startsWith(`${PREFIX}:`)) keys.push(key);
        }
    } catch {
        return;
    }
    for (const key of keys) {
        try {
            const parsed = JSON.parse(s.getItem(key) ?? '');
            if (
                parsed?.v !== 2 ||
                typeof parsed.savedAt !== 'number' ||
                now - parsed.savedAt > TECH_DRAFT_MAX_AGE_MS
            ) {
                removeQuietly(s, key);
            }
        } catch {
            removeQuietly(s, key);
        }
    }
}

// ── Construction des brouillons (valeurs JSON sûres uniquement) ──────────────

const text = (v: unknown): string =>
    typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v);

const triState = (v: unknown): boolean | null =>
    v === true || v === false ? v : null;

/** Même normalisation que la saisie : entier ≥ 1. */
const quantity = (v: unknown): number =>
    Math.max(1, Math.floor(Number(v) || 1));

/**
 * `raw` = `diagFormTech.getRawValue()` — et non `.value`, qui OMET `isPdr` quand
 * la DI est non réparable (contrôle désactivé).
 */
export function toDiagnosticDraft(
    raw: Record<string, unknown> | null | undefined,
    composants: ReadonlyArray<{ nameComposant?: unknown; quantity?: unknown }> | null | undefined,
    step: string | null | undefined,
): DiagnosticDraftData {
    const category = raw?.['di_category_id'];
    return {
        remarqueTech: text(raw?.['remarqueTech']),
        remarqueExtra: text(raw?.['remarqueExtra']),
        symptomes: text(raw?.['symptomes']),
        isPdr: !!raw?.['isPdr'],
        isReparable: !!raw?.['isReparable'],
        isErrorFromFixtronix: raw?.['isErrorFromFixtronix'] === true,
        di_category_id: category ? String(category) : null,
        composants: (composants ?? [])
            .filter((c) => !!c?.nameComposant)
            .map((c) => ({
                nameComposant: String(c.nameComposant),
                quantity: quantity(c.quantity),
            })),
        step: text(step) || 'info',
    };
}

export function toRepairDraft(
    raw: Record<string, unknown> | null | undefined,
    parts:
        | ReadonlyArray<{ nameComposant?: unknown; reference?: unknown; quantity?: unknown }>
        | null
        | undefined,
    step: string | null | undefined,
): RepairDraftData {
    return {
        worksDone: text(raw?.['worksDone']),
        testsDone: text(raw?.['testsDone']),
        remarqueExtra: text(raw?.['remarqueExtra']),
        repairSuccess: triState(raw?.['repairSuccess']),
        testsValidated: triState(raw?.['testsValidated']),
        warranty: triState(raw?.['warranty']),
        parts: (parts ?? [])
            .filter((p) => !!p?.nameComposant)
            .map((p) => ({
                nameComposant: String(p.nameComposant),
                reference: text(p.reference),
                quantity: quantity(p.quantity),
            })),
        step: text(step) || 'works',
    };
}

/**
 * Deux brouillons portent-ils la même SAISIE ? L'étape est ignorée : naviguer
 * dans le wizard sans rien saisir ne crée pas de brouillon.
 */
export function draftContentEquals(
    a: DiagnosticDraftData | RepairDraftData | null | undefined,
    b: DiagnosticDraftData | RepairDraftData | null | undefined,
): boolean {
    if (!a || !b) return a === b;
    return (
        JSON.stringify({ ...a, step: undefined }) ===
        JSON.stringify({ ...b, step: undefined })
    );
}
