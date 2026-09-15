/**
 * `remarque_tech_diagnostic` tel que le compose le formulaire de diagnostic
 * (`TechDiListComponent.composeRemarqueDiagnostic`) : la description, puis la
 * remarque technicien derrière ce séparateur, le tout dans UN seul champ.
 */
export const REMARQUE_TECH_SEPARATOR = '\n\nRemarque technicien :\n';

/**
 * Redécoupe le texte persisté en description + remarque technicien — même
 * découpe que `TechDiListComponent.splitRemarqueDiagnostic`. Coupe à la
 * PREMIÈRE occurrence, sur le texte non rogné (une description vide donne un
 * texte qui commence par le séparateur). Sans séparateur, tout est description.
 */
export function splitRemarqueDiagnostic(stored: unknown): {
    description: string;
    remarque: string;
} {
    const text = stored === null || stored === undefined ? '' : String(stored);
    if (!text.trim()) return { description: '', remarque: '' };
    const at = text.indexOf(REMARQUE_TECH_SEPARATOR);
    if (at < 0) return { description: text.trim(), remarque: '' };
    return {
        description: text.slice(0, at).trim(),
        remarque: text.slice(at + REMARQUE_TECH_SEPARATOR.length).trim(),
    };
}
