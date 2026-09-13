import { DiFilesModalComponent } from './di-files-modal.component';

/**
 * « Affectation des Fichiers » — séparation CYCLE 0 / RETOURS.
 *
 * Le bloc « Fichiers principaux » doit montrer les fichiers du FLUX D'ORIGINE
 * (cycle 0) et la frise « Historique des retours » uniquement les cycles ≥ 1.
 *
 * Les deux moitiés étaient fausses de façon complémentaire :
 *  - `Di.*` n'est qu'un MIROIR du cycle COURANT, donc sur une DI en retour le
 *    bloc « principaux » affichait les fichiers DU RETOUR ;
 *  - `getAllLogsByDi` renvoie AUSSI la ligne du cycle 0, que la frise rendait
 *    telle quelle → un « Retour N°0 » qui n'existe pas.
 *
 * Pas de TestBed : les getters sont purs, on les exerce sur le prototype (même
 * idiome que `tech-di-list.diag-category.spec.ts`).
 */
function make(di: any, logs: any[] | null): any {
    const c: any = Object.create(DiFilesModalComponent.prototype);
    c.di = di;
    c.finishedData = logs ? { original: di, logs } : null;
    return c;
}

const CYCLE0 = {
    idIgnore: 0,
    devis: 'https://drive/devis-origine',
    bon_de_commande: 'https://drive/bc-origine',
    bon_de_livraison: 'https://drive/bl-origine',
    facture: 'https://drive/facture-origine',
    createdAt: '2026-01-05T10:00:00.000Z',
};
const CYCLE1 = {
    idIgnore: 1,
    devis: 'https://drive/devis-retour1',
    bon_de_livraison: 'https://drive/bl-retour1',
    createdAt: '2026-03-05T10:00:00.000Z',
};

describe('DiFilesModal — « Fichiers principaux » = cycle 0', () => {
    it('DI en RETOUR : lit le cycle 0, PAS le miroir (qui décrit le retour)', () => {
        const c = make(
            {
                ignoreCount: 1,
                // Le miroir porte les fichiers DU RETOUR.
                devis: 'https://drive/devis-retour1',
                bon_de_livraison: 'https://drive/bl-retour1',
                documents: [
                    { type: 'Devis', name: 'devis-retour1.pdf', webViewLink: 'https://drive/devis-retour1' },
                ],
            },
            [CYCLE0, CYCLE1],
        );

        const byTag = Object.fromEntries(c.affectationMainCards.map((x: any) => [x.tag, x]));
        expect(byTag['DEV'].href).toBe('https://drive/devis-origine');
        expect(byTag['BC'].href).toBe('https://drive/bc-origine');
        expect(byTag['BL'].href).toBe('https://drive/bl-origine');
        expect(byTag['FAC'].href).toBe('https://drive/facture-origine');
        // Aucune URL du retour ne doit apparaître dans le bloc principal.
        expect(c.affectationMainCards.some((x: any) => /retour1/.test(x.href ?? ''))).toBe(false);
        expect(c.affectationAvailableCount).toBe(4);
    });

    it('DI au CYCLE 0 : le miroir EST le cycle 0 — vrais noms Drive conservés', () => {
        const c = make(
            {
                ignoreCount: 0,
                devis: 'https://drive/devis-origine',
                documents: [
                    { type: 'Devis', name: 'DEVIS-2026-001.pdf', webViewLink: 'https://drive/devis-origine' },
                ],
            },
            [CYCLE0],
        );
        const dev = c.affectationMainCards.find((x: any) => x.tag === 'DEV');
        expect(dev.href).toBe('https://drive/devis-origine');
        expect(dev.title).toBe('DEVIS-2026-001.pdf');
        expect(dev.statusLabel).toBe('Disponible');
    });

    it('DI en retour SANS ligne de cycle 0 : « Manquant », jamais les fichiers du retour', () => {
        // Cas des DI héritées : le cycle 0 n'a jamais été archivé, ses documents
        // sont perdus. Mieux vaut « Manquant » que présenter ceux du retour.
        const c = make(
            { ignoreCount: 1, devis: 'https://drive/devis-retour1', documents: [] },
            [CYCLE1],
        );
        expect(c.affectationMainCards.every((x: any) => !x.present)).toBe(true);
        expect(c.affectationAvailableCount).toBe(0);
    });

    it('ne colle jamais le NOM d\'un fichier du retour sous un lien du cycle 0', () => {
        // `documents[]` décrit le cycle COURANT : un repli « par type » afficherait
        // le nom du fichier du retour à côté de l'URL du cycle 0.
        const c = make(
            {
                ignoreCount: 1,
                documents: [
                    { type: 'Devis', name: 'devis-DU-RETOUR.pdf', webViewLink: 'https://drive/devis-retour1' },
                ],
            },
            [CYCLE0, CYCLE1],
        );
        const dev = c.affectationMainCards.find((x: any) => x.tag === 'DEV');
        expect(dev.href).toBe('https://drive/devis-origine');
        expect(dev.title).toBe('Devis'); // libellé générique, pas le nom du retour
    });

    it('la pastille compte les cartes affichées, pas le miroir', () => {
        const c = make({ ignoreCount: 1, devis: 'x', bon_de_commande: 'y', facture: 'z' }, [CYCLE1]);
        expect(c.affectationAvailableCount).toBe(c.affectationMainCards.filter((x: any) => x.present).length);
    });
});

describe('DiFilesModal — « Historique des retours » = cycles ≥ 1', () => {
    it('exclut le cycle 0 : aucun « Retour N°0 »', () => {
        const c = make({ ignoreCount: 2 }, [CYCLE0, CYCLE1, { ...CYCLE1, idIgnore: 2 }]);
        expect(c.affectationRetours.map((r: any) => r.num)).toEqual([1, 2]);
    });

    it('DI au cycle 0 : la frise est VIDE (le bloc entier est masqué)', () => {
        const c = make({ ignoreCount: 0 }, [CYCLE0]);
        expect(c.affectationRetours.length).toBe(0);
    });

    it('ne montre que les documents du cycle concerné', () => {
        const c = make({ ignoreCount: 1, documents: [] }, [CYCLE0, CYCLE1]);
        const hrefs = c.affectationRetours[0].docs.map((d: any) => d.href);
        expect(hrefs).toContain('https://drive/devis-retour1');
        expect(hrefs).toContain('https://drive/bl-retour1');
        expect(hrefs.some((h: string) => /origine/.test(h))).toBe(false);
    });

    it('sans logs chargés, aucune frise et aucun plantage', () => {
        const c = make({ ignoreCount: 1 }, null);
        expect(c.affectationRetours).toEqual([]);
        expect(c.affectationAvailableCount).toBe(0);
    });
});
