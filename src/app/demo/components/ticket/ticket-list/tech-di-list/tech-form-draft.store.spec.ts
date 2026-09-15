import {
    TECH_DRAFT_MAX_AGE_MS,
    clearTechDraft,
    draftContentEquals,
    loadTechDraft,
    purgeExpiredTechDrafts,
    saveTechDraft,
    techDraftKey,
    toDiagnosticDraft,
    toRepairDraft,
} from './tech-form-draft.store';

/**
 * Brouillons navigateur des formulaires technicien.
 *
 * Verrouille ce que l'ancien état unique (`fix.tech-dialog-state.v1`) ratait :
 * une entrée PAR technicien + formulaire + ligne stats, une écriture qui ne casse
 * plus sur un objet PrimeNG cyclique, et l'expiration.
 */
describe('tech-form-draft.store', () => {
    const NOW = Date.parse('2026-09-15T08:00:00Z');

    const clearAll = () => {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith('fix.tech-draft.v2:')) keys.push(k);
        }
        keys.forEach((k) => localStorage.removeItem(k));
    };

    beforeEach(clearAll);
    afterEach(clearAll);

    it('relit exactement ce qui a été écrit, pour ce technicien, ce formulaire et cette DI', () => {
        saveTechDraft('tech-A', 'diagnostic', 'stat-1', { hello: 'monde' }, NOW);
        expect(loadTechDraft('tech-A', 'diagnostic', 'stat-1', NOW)).toEqual({
            v: 2,
            savedAt: NOW,
            data: { hello: 'monde' },
        });
    });

    it('cloisonne par technicien, par formulaire et par ligne stats', () => {
        saveTechDraft('tech-A', 'diagnostic', 'stat-1', { a: 1 }, NOW);
        expect(loadTechDraft('tech-B', 'diagnostic', 'stat-1', NOW)).toBeNull();
        expect(loadTechDraft('tech-A', 'repair', 'stat-1', NOW)).toBeNull();
        expect(loadTechDraft('tech-A', 'diagnostic', 'stat-2', NOW)).toBeNull();
        // Ouvrir une autre DI n'écrase plus le brouillon de la première.
        saveTechDraft('tech-A', 'diagnostic', 'stat-2', { b: 2 }, NOW);
        expect(loadTechDraft<any>('tech-A', 'diagnostic', 'stat-1', NOW)?.data).toEqual({ a: 1 });
    });

    it('sans technicien ni ligne stats : rien n’est écrit ni relu', () => {
        expect(saveTechDraft(null, 'diagnostic', 'stat-1', { a: 1 }, NOW)).toBeFalse();
        expect(saveTechDraft('tech-A', 'diagnostic', '', { a: 1 }, NOW)).toBeFalse();
        expect(loadTechDraft(undefined, 'diagnostic', 'stat-1', NOW)).toBeNull();
    });

    it('un brouillon expiré ou illisible est supprimé', () => {
        saveTechDraft('tech-A', 'repair', 'stat-1', { a: 1 }, NOW - TECH_DRAFT_MAX_AGE_MS - 1);
        expect(loadTechDraft('tech-A', 'repair', 'stat-1', NOW)).toBeNull();
        expect(localStorage.getItem(techDraftKey('tech-A', 'repair', 'stat-1'))).toBeNull();

        localStorage.setItem(techDraftKey('tech-A', 'repair', 'stat-2'), '{pas du json');
        expect(loadTechDraft('tech-A', 'repair', 'stat-2', NOW)).toBeNull();
        expect(localStorage.getItem(techDraftKey('tech-A', 'repair', 'stat-2'))).toBeNull();
    });

    it('clearTechDraft retire la seule entrée visée', () => {
        saveTechDraft('tech-A', 'diagnostic', 'stat-1', { a: 1 }, NOW);
        saveTechDraft('tech-A', 'repair', 'stat-1', { b: 1 }, NOW);
        clearTechDraft('tech-A', 'diagnostic', 'stat-1');
        expect(loadTechDraft('tech-A', 'diagnostic', 'stat-1', NOW)).toBeNull();
        expect(loadTechDraft('tech-A', 'repair', 'stat-1', NOW)).not.toBeNull();
    });

    it('purgeExpiredTechDrafts garde les brouillons récents et laisse les autres clés', () => {
        saveTechDraft('tech-A', 'diagnostic', 'old', { a: 1 }, NOW - TECH_DRAFT_MAX_AGE_MS - 1);
        saveTechDraft('tech-A', 'diagnostic', 'fresh', { a: 1 }, NOW);
        localStorage.setItem('token', 'garde-moi');
        purgeExpiredTechDrafts(NOW);
        expect(localStorage.getItem(techDraftKey('tech-A', 'diagnostic', 'old'))).toBeNull();
        expect(localStorage.getItem(techDraftKey('tech-A', 'diagnostic', 'fresh'))).not.toBeNull();
        expect(localStorage.getItem('token')).toBe('garde-moi');
        localStorage.removeItem('token');
    });

    describe('toDiagnosticDraft', () => {
        it('ne garde que des valeurs JSON sûres (jamais le TreeNode cyclique de la sélection)', () => {
            const node: any = { label: 'HS-600-24' };
            node.parent = { children: [node] }; // cycle, comme PrimeNG
            const draft = toDiagnosticDraft(
                {
                    remarqueTech: 'Pont IGBT HS',
                    remarqueExtra: 'à remplacer',
                    symptomes: 'F0001',
                    isPdr: false, // valeur BRUTE d'un contrôle désactivé
                    isReparable: false,
                    isErrorFromFixtronix: true,
                    di_category_id: 'cat-1',
                    composantSelected: node,
                    quantity: 3,
                },
                [
                    { nameComposant: 'HS-600-24', quantity: '2' },
                    { nameComposant: '', quantity: 1 },
                ],
                'validation',
            );
            expect(() => JSON.stringify(draft)).not.toThrow();
            expect(draft).toEqual({
                remarqueTech: 'Pont IGBT HS',
                remarqueExtra: 'à remplacer',
                symptomes: 'F0001',
                isPdr: false,
                isReparable: false,
                isErrorFromFixtronix: true,
                di_category_id: 'cat-1',
                composants: [{ nameComposant: 'HS-600-24', quantity: 2 }],
                step: 'validation',
            });
        });

        it('valeurs absentes → brouillon vide cohérent', () => {
            expect(toDiagnosticDraft(null, null, null)).toEqual({
                remarqueTech: '',
                remarqueExtra: '',
                symptomes: '',
                isPdr: false,
                isReparable: false,
                isErrorFromFixtronix: false,
                di_category_id: null,
                composants: [],
                step: 'info',
            });
        });
    });

    describe('toRepairDraft', () => {
        it('garde les bascules Oui/Non (y compris « Non ») et normalise les pièces', () => {
            const draft = toRepairDraft(
                {
                    worksDone: 'Condensateur remplacé',
                    testsDone: 'Essai 2 h',
                    remarqueExtra: '',
                    repairSuccess: false,
                    testsValidated: true,
                    warranty: undefined,
                    partSelected: { name: 'X' },
                },
                [{ nameComposant: '7805', quantity: 0 }],
                'summary',
            );
            expect(draft).toEqual({
                worksDone: 'Condensateur remplacé',
                testsDone: 'Essai 2 h',
                remarqueExtra: '',
                repairSuccess: false,
                testsValidated: true,
                warranty: null,
                parts: [{ nameComposant: '7805', reference: '', quantity: 1 }],
                step: 'summary',
            });
        });
    });

    it('draftContentEquals ignore l’étape mais pas la saisie', () => {
        const a = toRepairDraft({ worksDone: 'x' }, [], 'works');
        expect(draftContentEquals(a, { ...a, step: 'summary' })).toBeTrue();
        expect(draftContentEquals(a, { ...a, worksDone: 'y' })).toBeFalse();
        expect(draftContentEquals(null, null)).toBeTrue();
        expect(draftContentEquals(a, null)).toBeFalse();
    });
});
