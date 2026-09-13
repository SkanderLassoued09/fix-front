/**
 * Recoloration des graphiques Chart.js au changement de thème.
 *
 * POURQUOI. Les composants lisent `--text-color`, `--text-color-secondary` et
 * `--surface-border` avec `getComputedStyle` AU MOMENT où les données arrivent,
 * puis figent le résultat dans l'objet d'options. Chart.js dessine sur un
 * `<canvas>` : contrairement au DOM, il n'hérite d'aucune variable CSS. Sans
 * ce correctif, basculer clair/sombre laisse les axes, la légende et la grille
 * dans les couleurs de l'ancien thème jusqu'au prochain chargement de données —
 * texte gris foncé illisible sur fond sombre.
 */

/** Couleurs d'axes/légende lues dans le thème PrimeNG actuellement chargé. */
export function currentChartColors() {
    const s = getComputedStyle(document.documentElement);
    return {
        textColor: s.getPropertyValue('--text-color').trim(),
        textColorSecondary: s.getPropertyValue('--text-color-secondary').trim(),
        surfaceBorder: s.getPropertyValue('--surface-border').trim(),
    };
}

/**
 * Réapplique les couleurs du thème courant à un objet d'options Chart.js.
 *
 * Retourne une NOUVELLE référence : `p-chart` ne redessine que si l'entrée
 * change d'identité, muter l'objet en place n'aurait aucun effet visible.
 * Ne touche qu'aux couleurs de chrome — les séries de données gardent les
 * leurs.
 */
/**
 * Clone en profondeur en CONSERVANT les fonctions par reference.
 *
 * `structuredClone` leverait `DataCloneError` : les options Chart.js portent des
 * rappels (`ticks.callback`, formateurs d'info-bulle). On ne duplique donc que
 * les objets et tableaux simples, tout le reste passe par reference.
 */
function cloneOptions<V>(value: V): V {
    if (Array.isArray(value)) return value.map(cloneOptions) as unknown as V;
    if (value && typeof value === 'object' && (value as any).constructor === Object) {
        const copy: any = {};
        for (const [k, v] of Object.entries(value as any)) copy[k] = cloneOptions(v);
        return copy;
    }
    return value;
}

export function applyChartTheme<T>(options: T): T {
    if (!options || typeof options !== 'object') return options;

    const { textColor, textColorSecondary, surfaceBorder } = currentChartColors();
    const next: any = cloneOptions(options);

    if (next.plugins?.legend && next.plugins.legend.display !== false) {
        next.plugins.legend.labels = {
            ...(next.plugins.legend.labels ?? {}),
            color: textColor,
        };
    }

    const title = next.plugins?.title;
    if (title) title.color = textColor;

    for (const axis of Object.values<any>(next.scales ?? {})) {
        if (!axis || typeof axis !== 'object') continue;
        axis.ticks = { ...(axis.ticks ?? {}), color: textColorSecondary };
        if (axis.grid && axis.grid.display !== false) {
            axis.grid.color = surfaceBorder;
        }
        if (axis.title) axis.title.color = textColorSecondary;
    }

    return next as T;
}
