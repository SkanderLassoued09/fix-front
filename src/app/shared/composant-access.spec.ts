import { canAccessComposant, COMPOSANT_ROLES } from './composant-access';
import { ROLE, ROLE_ROUTES } from './role-routes';

/**
 * Droit d'accès au catalogue composants.
 *
 * Le dernier bloc est le plus important : il vérifie que `COMPOSANT_ROLES` et
 * la ligne `/tickets/composants` de `ROLE_ROUTES` disent la MÊME chose. Les
 * deux listes sont tenues à la main ; si elles divergent, le menu proposerait
 * un lien que le guard central refuserait (ou l'inverse).
 */

const COMPOSANTS_ROUTE = '/tickets/composants';

describe('canAccessComposant', () => {
  it('autorise les trois rôles du catalogue', () => {
    expect(canAccessComposant(ROLE.ADMIN_MANAGER)).toBeTrue();
    expect(canAccessComposant(ROLE.ADMIN_TECH)).toBeTrue();
    expect(canAccessComposant(ROLE.MAGASIN)).toBeTrue();
  });

  it('refuse les rôles qui n’ont rien à y faire', () => {
    expect(canAccessComposant(ROLE.TECH)).toBeFalse();
    expect(canAccessComposant(ROLE.MANAGER)).toBeFalse();
    expect(canAccessComposant(ROLE.COORDIANTOR)).toBeFalse();
  });

  it('REFUS PAR DÉFAUT : rôle absent, vide ou mal orthographié', () => {
    expect(canAccessComposant(null)).toBeFalse();
    expect(canAccessComposant(undefined)).toBeFalse();
    expect(canAccessComposant('')).toBeFalse();
    // `COORDINATOR` bien orthographié n'est PAS la valeur persistée.
    expect(canAccessComposant('COORDINATOR')).toBeFalse();
  });
});

describe('anti-dérive : COMPOSANT_ROLES ≡ matrice des routes', () => {
  it('tout rôle autorisé par le guard a la route dans sa liste blanche', () => {
    for (const role of COMPOSANT_ROLES) {
      expect(ROLE_ROUTES[role])
        .withContext(`${role} doit avoir une liste blanche`)
        .toBeDefined();
      expect(ROLE_ROUTES[role]).toContain(COMPOSANTS_ROUTE);
    }
  });

  it('aucun autre rôle n’a la route dans sa liste blanche', () => {
    const autorises = COMPOSANT_ROLES as readonly string[];
    for (const role of Object.values(ROLE)) {
      if (autorises.includes(role)) continue;
      expect(ROLE_ROUTES[role] ?? [])
        .withContext(`${role} ne doit pas atteindre ${COMPOSANTS_ROUTE}`)
        .not.toContain(COMPOSANTS_ROUTE);
    }
  });
});
