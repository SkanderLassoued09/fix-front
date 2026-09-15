import {
    buildComposantIndex,
    cleanComposantValue,
    composantStatusKey,
    composantsGrandTotal,
    composantsPricedCount,
    enrichComposants,
    formatComingDate,
    stockBadgeLabel,
    stockHealth,
} from './composant-enrichment.util';

/**
 * Enrichissement des composants du dossier (modal « Dossier d'intervention »).
 *
 * La DI ne stocke que `{ nameComposant, quantity }` : prix, statut, arrivage et
 * stock viennent du CATALOGUE, joint par NOM. Ces tests figent les pièges qui
 * ont motivé l'extraction : un composant hérité absent du catalogue ne doit pas
 * produire une carte vide ni un prix à 0, la date d'arrivage ne doit pas se
 * décaler d'un jour, et la pastille doit tolérer les trois vocabulaires de
 * statut qui coexistent en base.
 */
const CATALOG = [
    {
        _id: 'Cmp1',
        name: 'Écran LCD',
        package: 'BGA-64',
        category_composant_id: 'C_Composant2',
        prix_achat: 85,
        prix_vente: 140,
        coming_date: '2026-03-12',
        link: 'https://fournisseur/ecran',
        quantity_stocked: 7,
        pdf: 'https://drive/fiche',
        status_composant: 'En stock',
    },
    {
        _id: 'Cmp2',
        name: 'Nappe connecteur',
        package: 'FPC-40',
        category_composant_id: 'C_Composant3',
        prix_achat: 12.5,
        prix_vente: 28,
        coming_date: '2026-03-20',
        link: '',
        quantity_stocked: 0,
        pdf: '',
        status_composant: 'Externe',
    },
    {
        // Ligne héritée : prix de vente jamais saisi, libellés pollués.
        _id: 'Cmp3',
        name: 'Vis M2',
        package: 'undefined',
        category_composant_id: 'Connectique',
        prix_achat: null as any,
        prix_vente: null as any,
        coming_date: 'null',
        quantity_stocked: 250,
        status_composant: '',
    },
];

const index = buildComposantIndex(CATALOG);

describe('cleanComposantValue', () => {
    it('traite les sentinelles héritées comme des valeurs vides', () => {
        expect(cleanComposantValue('undefined')).toBe('');
        expect(cleanComposantValue('null')).toBe('');
        expect(cleanComposantValue(null)).toBe('');
        expect(cleanComposantValue('  ')).toBe('');
        expect(cleanComposantValue(' BGA-64 ')).toBe('BGA-64');
    });
});

describe('composantStatusKey', () => {
    it('accepte les trois vocabulaires qui coexistent en base', () => {
        // Réellement persisté par l'UI.
        expect(composantStatusKey('En stock')).toBe('INSTOCK');
        expect(composantStatusKey('Interne')).toBe('INTERN');
        expect(composantStatusKey('Externe')).toBe('EXTERN');
        // Constantes back (mortes) — acceptées aussi par `di.service`.
        expect(composantStatusKey('EnStock')).toBe('INSTOCK');
        // Constantes front (mortes).
        expect(composantStatusKey('INSTOCK')).toBe('INSTOCK');
        expect(composantStatusKey('INTERN')).toBe('INTERN');
        expect(composantStatusKey('EXTERN')).toBe('EXTERN');
    });

    it('tolère casse, accents et espaces parasites', () => {
        expect(composantStatusKey('  en  stock ')).toBe('INSTOCK');
        expect(composantStatusKey('Éxterne')).toBe('EXTERN');
        expect(composantStatusKey('en-stock')).toBe('INSTOCK');
    });

    it('retombe sur UNKNOWN pour le vide et l’inconnu', () => {
        expect(composantStatusKey('')).toBe('UNKNOWN');
        expect(composantStatusKey(null)).toBe('UNKNOWN');
        expect(composantStatusKey('undefined')).toBe('UNKNOWN');
        expect(composantStatusKey('Divers')).toBe('UNKNOWN');
    });
});

describe('formatComingDate', () => {
    it('reformate sans décaler la date (piège Africa/Tunis)', () => {
        expect(formatComingDate('2026-03-12')).toBe('12/03/2026');
        expect(formatComingDate('2026-01-01')).toBe('01/01/2026');
    });

    it('rend une chaîne vide quand la donnée est absente', () => {
        expect(formatComingDate('')).toBe('');
        expect(formatComingDate('null')).toBe('');
        expect(formatComingDate(undefined)).toBe('');
        // Sentinelle réellement présente en base (5 lignes).
        expect(formatComingDate('Invalid Date')).toBe('');
    });

    it('gère la forme héritée `Date.toString()` (majoritaire en base)', () => {
        // ~100 lignes du catalogue portent cette sérialisation complète : sans
        // ce cas, la carte affichait la chaîne brute en entier.
        expect(
            formatComingDate('Fri Jan 23 2026 00:00:00 GMT+0100 (heure normale)'),
        ).toBe('23/01/2026');
        expect(
            formatComingDate('Tue Mar 24 2026 00:00:00 GMT+0100 (heure normale)'),
        ).toBe('24/03/2026');
    });

    it('ne décale pas la date pour une forme ISO à minuit UTC', () => {
        expect(formatComingDate('2026-08-06T00:00:00.000Z')).toBe('06/08/2026');
    });

    it('rend la valeur brute si elle n’a pas le format attendu', () => {
        expect(formatComingDate('bientôt')).toBe('bientôt');
    });
});

describe('stockHealth / stockBadgeLabel', () => {
    it('classe le stock en rupture / faible / ok', () => {
        expect(stockHealth(0)).toBe('out');
        expect(stockHealth(3)).toBe('low');
        expect(stockHealth(12)).toBe('ok');
        expect(stockHealth(null)).toBe('unknown');
    });

    it('libelle la pastille', () => {
        expect(stockBadgeLabel(0)).toBe('Rupture · 0');
        expect(stockBadgeLabel(3)).toBe('Stock faible · 3');
        expect(stockBadgeLabel(12)).toBe('En stock · 12');
        expect(stockBadgeLabel(null)).toBe('—');
    });
});

describe('enrichComposants', () => {
    it('joint la ligne de DI à sa fiche catalogue par le NOM', () => {
        const [l] = enrichComposants(
            [{ nameComposant: 'Écran LCD', quantity: 2, isUpdated: true }],
            index,
        );
        expect(l.found).toBe(true);
        expect(l.ref).toBe('Cmp1');
        expect(l.package).toBe('BGA-64');
        expect(l.prixAchat).toBe(85);
        expect(l.prixVente).toBe(140);
        expect(l.stock).toBe(7);
        expect(l.comingDate).toBe('2026-03-12');
        expect(l.statusRaw).toBe('En stock');
        expect(l.isUpdated).toBe(true);
        expect(l.quantity).toBe(2);
    });

    it('absorbe les écarts de casse et d’espaces sur le nom', () => {
        const [l] = enrichComposants(
            [{ nameComposant: '  écran lcd ', quantity: 1 }],
            index,
        );
        expect(l.found).toBe(true);
        expect(l.ref).toBe('Cmp1');
    });

    it('calcule le total de ligne = prix de vente × quantité', () => {
        const [l] = enrichComposants(
            [{ nameComposant: 'Nappe connecteur', quantity: 3 }],
            index,
        );
        expect(l.lineTotal).toBe(84);
    });

    it('marque « hors catalogue » sans inventer de prix', () => {
        const [l] = enrichComposants(
            [{ nameComposant: 'Composant fantôme', quantity: 4 }],
            index,
        );
        expect(l.found).toBe(false);
        expect(l.name).toBe('Composant fantôme');
        expect(l.quantity).toBe(4);
        expect(l.prixVente).toBeNull();
        expect(l.lineTotal).toBeNull();
        expect(l.ref).toBe('');
    });

    it('laisse un prix absent à null plutôt que de le replier sur 0', () => {
        const [l] = enrichComposants(
            [{ nameComposant: 'Vis M2', quantity: 10 }],
            index,
        );
        expect(l.found).toBe(true);
        expect(l.prixVente).toBeNull();
        expect(l.lineTotal).toBeNull();
        // Sentinelles héritées nettoyées.
        expect(l.package).toBe('');
        expect(l.comingDate).toBe('');
        expect(l.stock).toBe(250);
    });

    it('traite un prix à 0 (valeur initiale du catalogue) comme « non tarifé »', () => {
        const idx = buildComposantIndex([
            { _id: 'Cmp9', name: 'Pièce neuve', prix_achat: 0, prix_vente: 0, quantity_stocked: 0 } as any,
        ]);
        const [line] = enrichComposants([{ nameComposant: 'Pièce neuve', quantity: 2 } as any], idx);

        expect(line.prixVente).toBeNull();
        expect(line.prixAchat).toBeNull();
        expect(line.lineTotal).toBeNull();
        expect(line.stock).toBe(0); // un stock à 0 reste une vraie valeur
        expect(composantsPricedCount([line])).toBe(0);
    });

    it('ne casse pas sur une liste vide ou absente', () => {
        expect(enrichComposants([], index)).toEqual([]);
        expect(enrichComposants(null, index)).toEqual([]);
        expect(enrichComposants([{ quantity: 1 }], index).length).toBe(1);
    });

    it('reste utilisable sans catalogue (chargement échoué)', () => {
        const [l] = enrichComposants(
            [{ nameComposant: 'Écran LCD', quantity: 2 }],
            new Map(),
        );
        expect(l.found).toBe(false);
        expect(l.name).toBe('Écran LCD');
        expect(l.quantity).toBe(2);
    });

    it('est PURE : deux cycles distincts donnent deux résultats distincts', () => {
        const cycle0 = enrichComposants(
            [{ nameComposant: 'Écran LCD', quantity: 1 }],
            index,
        );
        const cycle1 = enrichComposants(
            [{ nameComposant: 'Nappe connecteur', quantity: 2 }],
            index,
        );
        expect(cycle0.length).toBe(1);
        expect(cycle1.length).toBe(1);
        expect(cycle0[0].name).toBe('Écran LCD');
        expect(cycle1[0].name).toBe('Nappe connecteur');
    });
});

describe('composantsGrandTotal / composantsPricedCount', () => {
    const lines = enrichComposants(
        [
            { nameComposant: 'Écran LCD', quantity: 1 }, // 140
            { nameComposant: 'Nappe connecteur', quantity: 2 }, // 56
            { nameComposant: 'Vis M2', quantity: 10 }, // sans prix
            { nameComposant: 'Composant fantôme', quantity: 1 }, // hors catalogue
        ],
        index,
    );

    it('ignore les lignes sans prix au lieu de les compter 0', () => {
        expect(composantsGrandTotal(lines)).toBe(196);
        expect(composantsPricedCount(lines)).toBe(2);
    });

    it('rend 0 sur une liste vide', () => {
        expect(composantsGrandTotal([])).toBe(0);
        expect(composantsPricedCount(null)).toBe(0);
    });
});
