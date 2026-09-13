import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { reunionRoleGuard } from 'src/app/shared/reunion-access';
import { composantRoleGuard } from 'src/app/shared/composant-access';

const routes: Routes = [
    {
        path: 'ticket',
        loadChildren: () =>
            import('./ticket-list/ticket-list.module').then(
                (m) => m.TicketListModule
            ),
    },
    {
        // Reusable standalone component → loaded directly, no module wrap.
        // Réservé à admin / manager / coordinateur (URL tapée directement).
        path: 'reunions',
        canActivate: [reunionRoleGuard()],
        loadComponent: () =>
            import('./reunion-list/reunion-list.component').then(
                (m) => m.ReunionListComponent
            ),
    },
    {
        // Catalogue composants : page à part entière (entrée de menu dédiée),
        // sortie de `TicketListModule` où elle n'était qu'un écran satellite du
        // magasin. Réservé à admin manager / admin tech / magasin.
        path: 'composants',
        canActivate: [composantRoleGuard()],
        loadComponent: () =>
            import('./composant-management/composant-management.component').then(
                (m) => m.ComposantManagementComponent
            ),
    },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class TicketRoutingModule {}
