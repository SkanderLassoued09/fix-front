import { ComposantManagementComponent } from './composant-management.component';

/**
 * Filtrage et pagination du catalogue.
 *
 * `findAllComposant` renvoie TOUT le catalogue (pas de pagination serveur) :
 * le découpage se fait donc ici. Ces tests portent sur cette logique pure —
 * pas de TestBed, pas d'Apollo à monter.
 */

/** Instancie le composant sans passer par le DI (aucune dépendance utilisée ici). */
function makeComponent(rows: any[], categories: any[] = CATEGORIES): any {
  const c: any = new (ComposantManagementComponent as any)(
    null, // ticketService
    null, // apollo
    null, // confirm (ConfirmService)
    null, // notify (NotifyService)
    null, // mutationRunner
  );
  c.composantCategory = categories;
  c.allComposants = rows;
  c.applyFilters();
  return c;
}

/** Options telles que construites depuis `findAllComposant_Category`. */
const CATEGORIES = [
  { name: 'Condensateur', value: 'C_Composant1' },
  { name: 'Résistance', value: 'C_Composant2' },
];

const CATALOGUE = [
  { _id: 'Cmp1', name: 'condo 47µF', package: 'SOT-23', quantity_stocked: 5,
    status_composant: 'En stock', coming_date: '2025-03-14T00:00:00.000Z',
    category_composant_id: 'C_Composant1', link: 'https://ex.com/a', pdf: 'https://drive/a.pdf' },
  { _id: 'Cmp2', name: 'resistance 10k', package: 'DIP-8', quantity_stocked: 0,
    status_composant: 'Externe', coming_date: '2024-11-02T00:00:00.000Z',
    category_composant_id: 'C_Composant2', link: '', pdf: 'undefined' },
  { _id: 'Cmp3', name: 'fusible', package: 'sot-23', quantity_stocked: 12,
    status_composant: 'Interne', coming_date: null,
    category_composant_id: 'Condensateur', link: null, pdf: null },
];

describe('ComposantManagementComponent — filtres', () => {
  it('sans filtre, tout le catalogue est affiché', () => {
    const c = makeComponent(CATALOGUE);
    expect(c.totalComposantRecord).toBe(3);
    expect(c.pagedComposants.length).toBe(3);
  });

  it('filtre insensible à la casse sur une colonne', () => {
    const c = makeComponent(CATALOGUE);
    c.onColumnSearch('package', 'SOT');
    c.applyFilters(); // court-circuite le debounce
    expect(c.totalComposantRecord).toBe(2);
  });

  it('les filtres se CUMULENT (ET logique)', () => {
    const c = makeComponent(CATALOGUE);
    c.onColumnSearch('package', 'sot');
    c.onColumnSearch('status_composant', 'Interne');
    c.applyFilters();
    expect(c.totalComposantRecord).toBe(1);
    expect(c.pagedComposants[0]._id).toBe('Cmp3');
  });

  it('vider le champ retire le filtre de cette colonne', () => {
    const c = makeComponent(CATALOGUE);
    c.onColumnSearch('package', 'DIP');
    c.applyFilters();
    expect(c.totalComposantRecord).toBe(1);

    c.onColumnSearch('package', '   ');
    c.applyFilters();
    expect(c.totalComposantRecord).toBe(3);
  });

  it('la date est cherchée sur la valeur AFFICHÉE (YYYY-MM-DD), pas sur l’ISO brut', () => {
    const c = makeComponent(CATALOGUE);
    c.onColumnSearch('coming_date', '2025-03');
    c.applyFilters();
    expect(c.totalComposantRecord).toBe(1);
    expect(c.pagedComposants[0]._id).toBe('Cmp1');
  });
});

describe('ComposantManagementComponent — pagination', () => {
  it('ne rend que la page courante', () => {
    const c = makeComponent(CATALOGUE);
    c.rows = 2;
    c.onPageChange({ first: 0, rows: 2, page: 0, pageCount: 2 });
    expect(c.pagedComposants.length).toBe(2);

    c.onPageChange({ first: 2, rows: 2, page: 1, pageCount: 2 });
    expect(c.pagedComposants.length).toBe(1);
    expect(c.pagedComposants[0]._id).toBe('Cmp3');
  });

  it('un filtre qui réduit la liste sous la page courante ramène à la page 1', () => {
    const c = makeComponent(CATALOGUE);
    c.onPageChange({ first: 2, rows: 1, page: 2, pageCount: 3 });
    expect(c.first).toBe(2);

    // Ne reste qu'une ligne : sans le garde-fou, la table paraîtrait vide.
    c.onColumnSearch('package', 'DIP');
    c.applyFilters();
    expect(c.first).toBe(0);
    expect(c.pagedComposants.length).toBe(1);
  });
});

describe('ComposantManagementComponent — cellules vides', () => {
  it('rend le placeholder PARTAGÉ « — », comme les autres listes', () => {
    const c = makeComponent([]);
    expect(c.formatValue(null)).toBe('—');
    expect(c.formatValue(undefined)).toBe('—');
    expect(c.formatValue('')).toBe('—');
    // Chaînes 'undefined' / 'null' réellement présentes en base sur d'anciens composants.
    expect(c.formatValue('undefined')).toBe('—');
    expect(c.formatValue('null')).toBe('—');
    expect(c.getFormattedDate(null)).toBe('—');
    expect(c.getFormattedDate('pas-une-date')).toBe('—');
  });

  it('laisse passer les valeurs réelles, y compris le zéro', () => {
    const c = makeComponent([]);
    expect(c.formatValue(0)).toBe('0');
    expect(c.formatValue('DIP-8')).toBe('DIP-8');
  });

  it('prix à 0 (valeur initiale) ou absent → « — » ; un vrai prix est affiché', () => {
    const c = makeComponent([]);
    expect(c.formatPrice(0)).toBe('—');
    expect(c.formatPrice(null)).toBe('—');
    expect(c.formatPrice('')).toBe('—');
    expect(c.formatPrice(12.5)).toBe(c.formatValue(12.5));
  });

  it('pas de pastille quand le statut est absent', () => {
    const c = makeComponent([]);
    expect(c.hasStatus('Interne')).toBeTrue();
    expect(c.hasStatus(null)).toBeFalse();
    expect(c.hasStatus('')).toBeFalse();
    expect(c.hasStatus('undefined')).toBeFalse();
  });
});

describe('ComposantManagementComponent — pastille de statut', () => {
  it('mappe les valeurs réellement persistées', () => {
    const c = makeComponent([]);
    expect(c.statusClass('En stock')).toBe('composant-INSTOCK');
    expect(c.statusClass('Interne')).toBe('composant-INTERN');
    expect(c.statusClass('Externe')).toBe('composant-EXTERN');
  });

  it('retombe sur une pastille neutre pour une valeur inconnue ou absente', () => {
    const c = makeComponent([]);
    expect(c.statusClass('INSTOCK')).toBe('composant-UNKNOWN');
    expect(c.statusClass(null)).toBe('composant-UNKNOWN');
    expect(c.statusClass('')).toBe('composant-UNKNOWN');
  });
});

describe('ComposantManagementComponent — catégorie', () => {
  it('normalise un `_id` valide en le laissant tel quel', () => {
    const c = makeComponent([]);
    expect(c.normalizeCategoryId('C_Composant2')).toBe('C_Composant2');
  });

  it('traduit un LIBELLÉ hérité en `_id`', () => {
    // D'anciennes lignes stockent le libellé : le renvoyer tel quel ferait
    // rejeter l'enregistrement par `assertCategoryExists` côté back.
    const c = makeComponent([]);
    expect(c.normalizeCategoryId('Condensateur')).toBe('C_Composant1');
  });

  it('rend null un libellé introuvable ⇒ champ vide ⇒ catégorie intouchée', () => {
    const c = makeComponent([]);
    expect(c.normalizeCategoryId('resistqmce')).toBeNull();
    expect(c.normalizeCategoryId(null)).toBeNull();
    expect(c.normalizeCategoryId('undefined')).toBeNull();
    expect(c.normalizeCategoryId('null')).toBeNull();
  });

  it('laisse la valeur telle quelle tant que les options ne sont pas chargées', () => {
    const c = makeComponent([], []);
    expect(c.normalizeCategoryId('C_Composant1')).toBe('C_Composant1');
  });

  it('affiche le LIBELLÉ dans la table, jamais l’`_id`', () => {
    const c = makeComponent([]);
    expect(c.categoryLabel('C_Composant1')).toBe('Condensateur');
    expect(c.categoryLabel('Condensateur')).toBe('Condensateur'); // hérité
    expect(c.categoryLabel(null)).toBe('—');
    expect(c.categoryLabel('undefined')).toBe('—');
  });

  it('filtre la colonne Catégorie sur le libellé, pas sur l’`_id`', () => {
    const c = makeComponent(CATALOGUE);
    c.onColumnSearch('category_composant_id', 'condensateur');
    c.applyFilters();
    // Cmp1 (par `_id`) + Cmp3 (libellé hérité) — jamais par « C_Composant ».
    expect(c.totalComposantRecord).toBe(2);

    c.onColumnSearch('category_composant_id', 'C_Composant');
    c.applyFilters();
    expect(c.totalComposantRecord).toBe(0);
  });

  it('filtre la colonne Nom', () => {
    const c = makeComponent(CATALOGUE);
    c.onColumnSearch('name', 'resistance');
    c.applyFilters();
    expect(c.totalComposantRecord).toBe(1);
    expect(c.pagedComposants[0]._id).toBe('Cmp2');
  });
});

describe('ComposantManagementComponent — charge utile d’enregistrement', () => {
  /**
   * Garde de la correction : l'ancien chemin (`updateComposantTable`) faisait un
   * `$set` complet et écrasait `link`, `pdf` et `category_composant_id` à chaque
   * sauvegarde. Le nouveau passe par `addComposantInfo`, qui ignore les champs
   * vides — d'où les `''` attendus ci-dessous.
   */
  function openOn(row: any) {
    const c = makeComponent(CATALOGUE);
    c.updateComposant(row);
    return c;
  }

  it('porte les 10 champs éditables et toujours l’`_id`', () => {
    const c = openOn(CATALOGUE[0]);
    const payload = c.buildSavePayload();
    for (const key of [
      '_id', 'name', 'package', 'category_composant_id', 'prix_achat',
      'prix_vente', 'coming_date', 'link', 'quantity_stocked',
      'status_composant', 'pdf',
    ]) {
      expect(Object.keys(payload)).withContext(key).toContain(key);
    }
    expect(payload._id).toBe('Cmp1');
    expect(payload.name).toBe('condo 47µF');
    expect(payload.link).toBe('https://ex.com/a');
  });

  it('sans nouveau fichier, `pdf` part vide ⇒ la fiche stockée est conservée', () => {
    const c = openOn(CATALOGUE[0]);
    expect(c.buildSavePayload().pdf).toBe('');
  });

  it('avec un fichier déposé, `pdf` porte le base64', () => {
    const c = openOn(CATALOGUE[0]);
    c.pdfPayload = 'data:application/pdf;base64,AAAA';
    expect(c.buildSavePayload().pdf).toBe('data:application/pdf;base64,AAAA');
  });

  it('la sélection PDF ne fuit pas d’un composant à l’autre', () => {
    const c = openOn(CATALOGUE[0]);
    c.pdfPayload = 'data:application/pdf;base64,AAAA';
    c.pdfFile = {} as any;
    c.updateComposant(CATALOGUE[1]); // on ouvre une AUTRE ligne
    expect(c.pdfPayload).toBeNull();
    expect(c.pdfFile).toBeNull();
    expect(c.buildSavePayload().pdf).toBe('');
  });

  it('les sentinelles historiques ne reviennent pas comme contenu éditable', () => {
    // Cmp2 a `pdf: 'undefined'` en base (séquelle de l'ancien enregistrement).
    const c = openOn(CATALOGUE[1]);
    expect(c.updateComposantForm.value.pdf).toBe('');
    expect(c.storedPdf).toBe('');
  });

  it('expose la fiche stockée quand elle est réelle', () => {
    const c = openOn(CATALOGUE[0]);
    expect(c.storedPdf).toBe('https://drive/a.pdf');
  });

  it('normalise la catégorie héritée à l’ouverture', () => {
    const c = openOn(CATALOGUE[2]); // category_composant_id: 'Condensateur'
    expect(c.updateComposantForm.value.category_composant_id).toBe(
      'C_Composant1',
    );
  });
});

/**
 * Création rapide d'une catégorie depuis le modal composant.
 *
 * Les deux branches qui n'appellent PAS le réseau (nom vide, doublon connu)
 * sortent avant tout usage d'`apollo`/`mutationRunner` — c'est précisément ce
 * qui les rend testables sans TestBed, comme le reste du fichier.
 */
describe('ComposantManagementComponent — création rapide de catégorie', () => {
  it('insère la catégorie créée EN TÊTE des options et la sélectionne', () => {
    const c = makeComponent([]);
    c.selectCreatedCategory('C_Composant9', 'Diodes');

    expect(c.composantCategory.length).toBe(3);
    expect(c.composantCategory[0]).toEqual({
      name: 'Diodes',
      value: 'C_Composant9',
    });
    expect(c.updateComposantForm.value.category_composant_id).toBe(
      'C_Composant9',
    );

    // Idempotent : un rappel ne duplique pas l'option.
    c.selectCreatedCategory('C_Composant9', 'Diodes');
    expect(c.composantCategory.length).toBe(3);
  });

  it('remplace la RÉFÉRENCE du tableau d’options, sinon le p-dropdown ne se met pas à jour', () => {
    const c = makeComponent([]);
    const avant = c.composantCategory;
    c.selectCreatedCategory('C_Composant9', 'Diodes');
    expect(c.composantCategory).not.toBe(avant);
  });

  it('replie et vide le panneau à chaque ouverture du modal (création comme édition)', () => {
    const c = makeComponent(CATALOGUE);

    c.quickCategoryOpen = true;
    c.quickCategoryName.setValue('brouillon');
    c.updateComposant(CATALOGUE[0]);
    expect(c.quickCategoryOpen).toBeFalse();
    expect(c.quickCategoryName.value).toBe('');

    c.quickCategoryOpen = true;
    c.quickCategoryName.setValue('brouillon');
    c.openCreateComposant();
    expect(c.quickCategoryOpen).toBeFalse();
    expect(c.quickCategoryName.value).toBe('');
  });

  it('sélectionne la catégorie existante au lieu d’en créer une en double', async () => {
    const c = makeComponent([]);
    c.mutationRunner = { run: jasmine.createSpy('run') };
    c.notify = { success: jasmine.createSpy('success') };
    c.quickCategoryOpen = true;

    // Espaces + casse : la comparaison doit être celle du back.
    c.quickCategoryName.setValue('  cONDENSATEUR ');
    await c.createQuickCategory();

    expect(c.mutationRunner.run).not.toHaveBeenCalled();
    expect(c.updateComposantForm.value.category_composant_id).toBe(
      'C_Composant1',
    );
    expect(c.quickCategoryOpen).toBeFalse();

    // Un nom fait d'espaces ne part jamais au back non plus.
    c.quickCategoryName.setValue('   ');
    expect(c.quickCategoryName.invalid).toBeTrue();
    await c.createQuickCategory();
    expect(c.mutationRunner.run).not.toHaveBeenCalled();
    expect(c.quickCategoryName.touched).toBeTrue();
  });
});
