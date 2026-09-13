import { resolveComposantName } from './composant-selection.util';

/**
 * Garde de la ligne qui casse tout : la valeur d'un `p-treeSelect` est un
 * NŒUD, pas l'option. Sans la branche `data.name`, « Ajouter composant »
 * échoue silencieusement.
 */
describe('resolveComposantName', () => {
    it('lit un nœud de p-treeSelect (forme actuelle du picker)', () => {
        const node = {
            key: 'cmp:C1',
            label: 'R10',
            data: { kind: 'composant', _id: 'C1', name: 'R10' },
        };
        expect(resolveComposantName(node)).toBe('R10');
    });

    it('lit encore une option de p-dropdown (état restauré)', () => {
        expect(resolveComposantName({ _id: 'C1', name: 'R10' })).toBe('R10');
    });

    it('accepte une chaîne brute', () => {
        expect(resolveComposantName('  R10  ')).toBe('R10');
    });

    it('retombe sur le label quand data est absent', () => {
        expect(resolveComposantName({ label: 'R10' })).toBe('R10');
    });

    it('REFUSE un nœud de catégorie', () => {
        const category = {
            label: 'Résistance',
            data: { kind: 'category', _id: 'C_Composant1', name: 'Résistance' },
        };
        // Sinon « Résistance » partirait comme NOM DE PIÈCE sur la DI.
        expect(resolveComposantName(category)).toBeNull();
    });

    it('REFUSE le nœud d avis de troncature', () => {
        const truncated = {
            label: '+ 12 autres — utilisez la recherche',
            data: { kind: 'truncated', _id: 'truncated:C_Composant1', name: '' },
        };
        expect(resolveComposantName(truncated)).toBeNull();
    });

    it('rend null sur vide / absent', () => {
        expect(resolveComposantName(null)).toBeNull();
        expect(resolveComposantName(undefined)).toBeNull();
        expect(resolveComposantName('   ')).toBeNull();
        expect(resolveComposantName({})).toBeNull();
        expect(resolveComposantName({ name: '  ' })).toBeNull();
    });
});
