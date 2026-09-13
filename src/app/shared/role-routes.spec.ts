import { ROLE, ROLE_ROUTES, canAccessRoute } from './role-routes';
import { landingRouteForRole } from './landing-route';
import { AppMenuComponent } from '../layout/app.menu.component';

/**
 * Matrice rôle → routes, et garde anti-dérive avec le menu.
 *
 * Le point le plus important de ce fichier est le dernier bloc : il construit
 * RÉELLEMENT le menu de chaque rôle et vérifie que tout lien proposé est
 * autorisé. Deux listes tenues à la main finiraient sinon par diverger, et on
 * livrerait un lien qui redirige au clic.
 */

const ALL_ROLES = Object.values(ROLE);

describe('canAccessRoute — matrice par rôle', () => {
  it('chaque rôle accède à ses propres routes', () => {
    for (const role of ALL_ROLES) {
      for (const route of ROLE_ROUTES[role]) {
        expect(canAccessRoute(role, route))
          .withContext(`${role} devrait accéder à ${route}`)
          .toBeTrue();
      }
    }
  });

  it('refuse ce qui n’est pas dans la liste du rôle', () => {
    // Les cas cités par la demande : le coordinateur n'entre pas chez le magasin.
    expect(canAccessRoute(ROLE.COORDIANTOR, '/tickets/ticket/magasin-di-list')).toBeFalse();
    expect(canAccessRoute(ROLE.MAGASIN, '/tickets/ticket/coordinator-di-list')).toBeFalse();
    expect(canAccessRoute(ROLE.TECH, '/profiles/profile/profile-list')).toBeFalse();
    expect(canAccessRoute(ROLE.TECH, '/tickets/ticket/ticket-list')).toBeFalse();
    expect(canAccessRoute(ROLE.MAGASIN, '/')).toBeFalse();
    // Le tableau de bord reste réservé aux deux profils admin.
    expect(canAccessRoute(ROLE.MANAGER, '/')).toBeFalse();
    expect(canAccessRoute(ROLE.ADMIN_MANAGER, '/')).toBeTrue();
  });

  it('REFUS PAR DÉFAUT : rôle inconnu, vide ou absent', () => {
    for (const url of ['/', '/tickets/ticket/ticket-list']) {
      expect(canAccessRoute(null, url)).toBeFalse();
      expect(canAccessRoute(undefined, url)).toBeFalse();
      expect(canAccessRoute('', url)).toBeFalse();
      expect(canAccessRoute('COORDINATOR', url)).toBeFalse(); // orthographe non persistée
    }
  });

  it('REFUS PAR DÉFAUT : routes hors matrice (vestiges du gabarit)', () => {
    for (const role of ALL_ROLES) {
      for (const url of ['/uikit/table', '/pages/crud', '/documentation', '/blocks',
                         '/utilities/icons', '/tickets/ticket/details/42']) {
        expect(canAccessRoute(role, url))
          .withContext(`${role} ne doit pas atteindre ${url}`)
          .toBeFalse();
      }
    }
  });

  it('ignore query string et fragment (deep-link des notifications)', () => {
    // `?di=…&action=detail` est produit par le centre de notifications.
    expect(
      canAccessRoute(ROLE.MAGASIN, '/tickets/ticket/magasin-di-list?di=DI_x&action=detail'),
    ).toBeTrue();
    expect(canAccessRoute(ROLE.MAGASIN, '/tickets/ticket/magasin-di-list#bas')).toBeTrue();
    expect(canAccessRoute(ROLE.MAGASIN, '/tickets/ticket/magasin-di-list/')).toBeTrue();
  });

  it('le préfixe s’arrête aux SEGMENTS d’URL', () => {
    // Un sous-chemin relève de son parent…
    expect(canAccessRoute(ROLE.MANAGER, '/archives/42')).toBeTrue();
    // …mais un voisin qui commence pareil, non.
    expect(canAccessRoute(ROLE.MANAGER, '/archives-secretes')).toBeFalse();
    // Et la racine n'est jamais un préfixe, sinon elle ouvrirait tout.
    expect(canAccessRoute(ROLE.ADMIN_MANAGER, '/uikit/table')).toBeFalse();
  });
});

describe('anti-boucle de redirection', () => {
  it('la page d’accueil de chaque rôle connu lui est accessible', () => {
    // Sans cette garantie, le guard redirigerait en rond.
    for (const role of ALL_ROLES) {
      const landing = landingRouteForRole(role);
      expect(canAccessRoute(role, landing))
        .withContext(`${role} doit pouvoir atteindre sa page d'accueil ${landing}`)
        .toBeTrue();
    }
  });
});

describe('anti-dérive : tout lien du menu est autorisé', () => {
  /** Récupère récursivement les `routerLink` du modèle de menu. */
  function links(model: any[]): string[] {
    const out: string[] = [];
    for (const node of model ?? []) {
      const l = node?.routerLink;
      if (l) out.push(Array.isArray(l) ? l.join('/').replace('//', '/') : String(l));
      if (node?.items) out.push(...links(node.items));
    }
    return out;
  }

  for (const role of ALL_ROLES) {
    it(`${role} — aucun lien de menu ne serait redirigé`, () => {
      localStorage.setItem('role', role);
      const menu = new AppMenuComponent({} as any);
      menu.ngOnInit();
      const menuLinks = links((menu as any).model);
      expect(menuLinks.length)
        .withContext(`${role} devrait avoir au moins un lien de menu`)
        .toBeGreaterThan(0);
      for (const link of menuLinks) {
        expect(canAccessRoute(role, link))
          .withContext(`le menu de ${role} propose ${link}, absent de sa liste blanche`)
          .toBeTrue();
      }
    });
  }

  afterAll(() => localStorage.removeItem('role'));
});
