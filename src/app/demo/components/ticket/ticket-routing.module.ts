import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { reunionRoleGuard } from 'src/app/shared/reunion-access';

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
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class TicketRoutingModule {}
