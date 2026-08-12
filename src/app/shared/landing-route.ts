/**
 * Post-login landing route per profile role.
 *
 * Each role lands directly on its own working list; every other role
 * (admin / manager) falls back to the global ticket list. Role codes must
 * match `profile/constant/role-constants.ts` — including the historical
 * `COORDIANTOR` spelling, which is the value actually stored on profiles.
 */
export function landingRouteForRole(role: string | null | undefined): string {
    switch ((role || '').trim().toUpperCase()) {
        case 'TECH':
            return '/tickets/ticket/tech-di-list';
        case 'COORDIANTOR':
            return '/tickets/ticket/coordinator-di-list';
        case 'MAGASIN':
            return '/tickets/ticket/magasin-di-list';
        default:
            return '/tickets/ticket/ticket-list';
    }
}
