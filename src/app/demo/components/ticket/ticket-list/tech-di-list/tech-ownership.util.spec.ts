import {
    isDiAssignedToMe,
    normalizeIdentity,
    techIdentityMatches,
} from './tech-ownership.util';

describe('tech-ownership.util', () => {
    describe('normalizeIdentity', () => {
        it('trims strings and maps nullish to empty', () => {
            expect(normalizeIdentity('  U1 ')).toBe('U1');
            expect(normalizeIdentity(null)).toBe('');
            expect(normalizeIdentity(undefined)).toBe('');
        });
        it('reads _id/username from an object', () => {
            expect(normalizeIdentity({ _id: 'U1' })).toBe('U1');
            expect(normalizeIdentity({ username: 'alice' })).toBe('alice');
        });
    });

    describe('techIdentityMatches', () => {
        const tokens = ['U1', 'alice']; // current user's _id + username

        it('matches on _id', () => {
            expect(techIdentityMatches('U1', tokens)).toBe(true);
        });
        it('matches on username (legacy data)', () => {
            expect(techIdentityMatches('alice', tokens)).toBe(true);
        });
        it('does not match another tech', () => {
            expect(techIdentityMatches('U2', tokens)).toBe(false);
        });
        it('never matches an unassigned value', () => {
            expect(techIdentityMatches('', tokens)).toBe(false);
            expect(techIdentityMatches(null, tokens)).toBe(false);
        });
        it('never matches when the user has no tokens', () => {
            expect(techIdentityMatches('U1', [null, ''])).toBe(false);
        });
    });

    describe('isDiAssignedToMe', () => {
        const me = ['U1', 'alice'];

        it('enables on my own diagnostic DI', () => {
            expect(
                isDiAssignedToMe({ id_tech_diag: 'U1' }, 'diag', me),
            ).toBe(true);
        });
        it('enables on my own repair DI', () => {
            expect(isDiAssignedToMe({ id_tech_rep: 'U1' }, 'rep', me)).toBe(
                true,
            );
        });
        it('greys another technician’s DI', () => {
            expect(
                isDiAssignedToMe({ id_tech_diag: 'U2' }, 'diag', me),
            ).toBe(false);
            expect(isDiAssignedToMe({ id_tech_rep: 'U2' }, 'rep', me)).toBe(
                false,
            );
        });
        it('greys a DI with no assignee', () => {
            expect(isDiAssignedToMe({}, 'diag', me)).toBe(false);
        });
    });
});
