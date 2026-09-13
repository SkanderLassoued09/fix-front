import { environment } from 'src/environments/environment';

/**
 * Résout un lien de document stocké sur la DI.
 *
 * Les valeurs persistées sont tantôt une URL absolue (Google Drive
 * `webViewLink`), tantôt une `data:` URI (aperçu local juste après la
 * sélection), tantôt un simple nom de fichier relatif à la racine de l'API
 * (ancien stockage disque). Seul ce dernier cas doit être préfixé.
 *
 * Extrait ici pour être partagé avec `di-files-modal`, qui vit désormais hors de
 * `ticket-list`. Les trois copies historiques (`ticket-list.component.ts:72`,
 * `magasin-di-list.component.ts:43`, `coordinator-di-list.component.ts:275`)
 * sont laissées en place — les unifier dépasse le périmètre de ce changement.
 */
export function docHref(value?: string | null): string {
    if (!value) return '';
    return /^https?:\/\//i.test(value) || value.startsWith('data:')
        ? value
        : environment.apiUrl + value;
}
