import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { canAccessRoute } from './role-routes';
import { landingRouteForRole } from './landing-route';

/**
 * Guard de ROUTE par rôle — posé une seule fois, sur la coquille applicative.
 *
 * POURQUOI ICI. Les routes vivent dans huit modules de routage, dont plusieurs
 * fusionnés sous `/tickets/ticket` ; certaines ne sont liées nulle part. Un
 * guard par route se serait donc fatalement oublié quelque part. En le posant
 * sur le parent `AppLayoutComponent` — là où `authGuard` est déjà — toute URL
 * de l'application passe par ce seul point, et la liste blanche décide.
 *
 * `authGuard` reste responsable de l'AUTHENTIFICATION ; ce guard n'ajoute que
 * le contrôle de RÔLE.
 */
export const routeAccessGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
    const router = inject(Router);
    const role = localStorage.getItem('role');

    if (canAccessRoute(role, state.url)) return true;

    // Refus → on renvoie l'utilisateur sur SA page d'accueil, celle-là même que
    // la connexion utilise. Silencieux, conformément au choix produit.
    const fallback = landingRouteForRole(role);

    // ⚠️ ANTI-BOUCLE, indispensable : si la page d'accueil est elle-même
    // refusée, rediriger dessus ferait tourner le routeur en rond. Le cas se
    // produit pour un rôle inconnu ou absent — `landingRouteForRole` renvoie
    // alors la liste des DI par défaut, que la matrice n'autorise pas. On sort
    // alors vers la connexion.
    if (!canAccessRoute(role, fallback)) {
        return router.parseUrl('/auth/login');
    }
    return router.parseUrl(fallback);
};
