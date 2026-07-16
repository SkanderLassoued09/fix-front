import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Rôles autorisés à accéder à la fonctionnalité Réunion (menu, route ET
 * création). Source de vérité UNIQUE côté front, alignée sur le back
 * (`REUNION_ROLES` du resolver). `COORDIANTOR` = valeur réellement persistée
 * en base + stockée dans `localStorage('role')` (typo historique — ne pas
 * « corriger » sans migration, sinon le coordinateur perd l'accès).
 */
export const REUNION_ROLES = [
  'ADMIN_MANAGER',
  'ADMIN_TECH',
  'MANAGER',
  'COORDIANTOR',
] as const;

/** Le rôle courant (localStorage) peut-il gérer les réunions ? */
export function canAccessReunion(role: string | null | undefined): boolean {
  return !!role && (REUNION_ROLES as readonly string[]).includes(role);
}

/**
 * Guard de route par rôle (même esprit que `authGuard` : lit le rôle dans
 * localStorage, redirige sinon). L'authentification est déjà assurée par
 * `authGuard` sur le layout parent ; ce guard n'ajoute QUE le contrôle de rôle,
 * au cas où l'URL est tapée directement.
 */
export function reunionRoleGuard(): CanActivateFn {
  return () => {
    const router = inject(Router);
    if (canAccessReunion(localStorage.getItem('role'))) {
      return true;
    }
    router.navigate(['/']);
    return false;
  };
}
