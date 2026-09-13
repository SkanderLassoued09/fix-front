/**
 * Résolution du NOM du composant sélectionné dans le picker du diagnostic.
 *
 * POURQUOI UNE FONCTION À PART. Le picker est passé d'un `p-dropdown` (dont la
 * valeur est l'option elle-même, `{ _id, name }`) à un `p-treeSelect` dont la
 * valeur est un NŒUD : `{ label, key, data }`. Les deux formes — plus celles
 * restaurées depuis un dialogue minimisé — doivent être acceptées, sinon
 * « Ajouter composant » échoue SILENCIEUSEMENT sur le toast
 * « Sélectionnez un composant ».
 *
 * La DI référence les composants PAR NOM (`array_composants[].nameComposant`) :
 * c'est bien un nom, jamais un `_id`, qu'il faut ressortir ici.
 */
export function resolveComposantName(selected: unknown): string | null {
    if (selected === null || selected === undefined) {
        return null;
    }

    if (typeof selected === 'string') {
        return selected.trim() || null;
    }

    // Forme structurelle plutôt qu'un index signature : le projet active
    // `noPropertyAccessFromIndexSignature`, qui interdit `node.data`.
    const node = selected as {
        data?: { kind?: string; name?: string } | null;
        name?: unknown;
        nameComposant?: unknown;
        label?: unknown;
    };

    // Un nœud de catégorie ne porte aucun composant : le refuser explicitement
    // plutôt que de renvoyer son libellé, qui partirait comme nom de pièce.
    if (node?.data?.kind && node.data.kind !== 'composant') {
        return null;
    }

    const candidate =
        // `p-treeSelect` : la charge utile vit sous `data`.
        node?.data?.name ??
        // `p-dropdown` historique / état restauré.
        node?.name ??
        node?.nameComposant ??
        // Dernier recours : le libellé du nœud.
        node?.label ??
        null;

    if (typeof candidate !== 'string') {
        return null;
    }
    const trimmed = candidate.trim();
    return trimmed ? trimmed : null;
}
