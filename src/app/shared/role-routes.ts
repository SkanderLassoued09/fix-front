/**
 * MATRICE RÔLE → ROUTES : la liste blanche des URL que chaque profil peut
 * atteindre.
 *
 * SOURCE DE VÉRITÉ. Elle reprend, une pour une, les cinq blocs exclusifs de
 * `app.menu.component.ts` — le produit y exprime déjà ce que chaque rôle est
 * censé voir. Le guard ne fait qu'appliquer à l'URL ce que le menu applique
 * déjà aux liens ; sans lui, une page reste atteignable en tapant son adresse.
 * Un test dédié vérifie que tout `routerLink` du menu figure bien ici, pour que
 * les deux listes ne puissent pas diverger.
 *
 * REFUS PAR DÉFAUT : ce qui n'est pas listé n'est pas accessible. Une route
 * ajoutée demain est donc fermée tant qu'on ne l'a pas classée — plutôt
 * qu'ouverte par oubli.
 *
 * ⚠️ Ce n'est PAS une mesure de sécurité : le rôle vient de `localStorage`,
 * donc l'utilisateur peut le modifier. C'est un garde-fou d'ergonomie (lien
 * partagé, favori, faute de frappe). L'autorisation réelle appartient au
 * serveur.
 */

/** Rôles tels que RÉELLEMENT stockés (`localStorage('role')`, brut de la base). */
export const ROLE = {
    ADMIN_MANAGER: 'ADMIN_MANAGER',
    ADMIN_TECH: 'ADMIN_TECH',
    MANAGER: 'MANAGER',
    TECH: 'TECH',
    MAGASIN: 'MAGASIN',
    /** Coquille historique RÉELLEMENT persistée — ne pas « corriger » sans
     *  migration, le coordinateur perdrait tout accès. */
    COORDIANTOR: 'COORDIANTOR',
} as const;

// Routes nommées, pour éviter les chaînes en double entre la matrice et les tests.
const DASHBOARD = '/';
const PROFILES = '/profiles/profile/profile-list';
const CLIENTS = '/clients/client/client-list';
const COMPANIES = '/companies/company/company-list';
const TICKETS = '/tickets/ticket/ticket-list';
const ARCHIVES = '/archives';
const COORDINATION = '/tickets/ticket/coordinator-di-list';
const MAGASIN = '/tickets/ticket/magasin-di-list';
const TECH_WORKSHOP = '/tickets/ticket/tech-di-list';
const REUNIONS = '/tickets/reunions';
/** Catalogue composants : page à part entière, avec son entrée de menu
 *  « Composants » et son propre guard (`composant-access.ts`). */
const COMPOSANTS = '/tickets/composants';

export const ROLE_ROUTES: Readonly<Record<string, readonly string[]>> = {
    [ROLE.ADMIN_MANAGER]: [
        DASHBOARD, PROFILES, CLIENTS, COMPANIES,
        TICKETS, ARCHIVES, COORDINATION, MAGASIN, TECH_WORKSHOP, REUNIONS,
        COMPOSANTS,
    ],
    [ROLE.ADMIN_TECH]: [
        DASHBOARD, PROFILES, CLIENTS, COMPANIES,
        TICKETS, ARCHIVES, COORDINATION, MAGASIN, TECH_WORKSHOP, REUNIONS,
        COMPOSANTS,
    ],
    [ROLE.MANAGER]: [
        PROFILES, CLIENTS, COMPANIES, TICKETS, ARCHIVES, REUNIONS,
    ],
    [ROLE.TECH]: [TECH_WORKSHOP],
    [ROLE.MAGASIN]: [MAGASIN, COMPOSANTS],
    [ROLE.COORDIANTOR]: [COORDINATION, REUNIONS],
};

/**
 * Normalise une URL de routeur : retire la query string et le fragment, et la
 * barre finale. `state.url` porte les paramètres du deep-link des notifications
 * (`?di=…&action=detail`) — sans ce nettoyage, la comparaison échouerait et un
 * utilisateur légitime serait redirigé.
 */
function normalize(url: string): string {
    const path = (url || '').split('?')[0].split('#')[0].trim();
    if (path === '/' || path === '') return '/';
    return path.endsWith('/') ? path.slice(0, -1) : path;
}

/**
 * Le rôle courant peut-il atteindre cette URL ?
 *
 * Comparaison exacte, ou par SEGMENT de préfixe : `/archives/42` relève de
 * `/archives`, mais `/archives-secretes` n'en relève pas (d'où le `/` exigé
 * après le préfixe). La racine `/` est un cas exact, jamais un préfixe — sinon
 * elle autoriserait tout.
 */
export function canAccessRoute(
    role: string | null | undefined,
    url: string,
): boolean {
    const allowed = ROLE_ROUTES[(role || '').trim()];
    if (!allowed) return false; // rôle inconnu ou absent → refus par défaut
    const path = normalize(url);
    return allowed.some(
        (route) =>
            path === route || (route !== '/' && path.startsWith(route + '/')),
    );
}
