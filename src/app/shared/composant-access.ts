import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { landingRouteForRole } from './landing-route';

/**
 * Rôles autorisés à accéder au CATALOGUE COMPOSANTS (menu ET route). Source de
 * vérité UNIQUE côté front, alignée sur la ligne `COMPOSANTS` de
 * `role-routes.ts` — les deux listes décrivent le même droit, elles ne doivent
 * pas diverger.
 *
 * Le catalogue est une donnée de référence du magasin : les deux profils admin
 * l'administrent, le magasin le tient à jour. Ni le technicien, ni le manager,
 * ni la coordinatrice n'y ont affaire.
 */
export const COMPOSANT_ROLES = [
  'ADMIN_MANAGER',
  'ADMIN_TECH',
  'MAGASIN',
] as const;

/** Le rôle courant (localStorage) peut-il gérer le catalogue composants ? */
export function canAccessComposant(role: string | null | undefined): boolean {
  return !!role && (COMPOSANT_ROLES as readonly string[]).includes(role);
}

/**
 * Guard de route par rôle (même esprit que `reunionRoleGuard` : lit le rôle
 * dans localStorage, redirige sinon). L'authentification est déjà assurée par
 * `authGuard` sur le layout parent ; ce guard n'ajoute QUE le contrôle de rôle,
 * au cas où l'URL est tapée directement.
 */
export function composantRoleGuard(): CanActivateFn {
  return () => {
    const router = inject(Router);
    const role = localStorage.getItem('role');
    if (canAccessComposant(role)) {
      return true;
    }
    // On renvoie vers la page d'accueil DU RÔLE, pas vers `/` : le tableau de
    // bord est réservé aux admins, un MAGASIN refusé y aurait rebondi aussitôt
    // (le guard central l'en écarte lui aussi).
    router.navigateByUrl(landingRouteForRole(role));
    return false;
  };
}
