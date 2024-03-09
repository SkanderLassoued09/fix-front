import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TicketListComponent } from './ticket-list.component';
import { MagasinDiListComponent } from '../magasin-di-list/magasin-di-list.component';
import { TechDiListComponent } from './tech-di-list/tech-di-list.component';

const routes: Routes = [
    { path: 'ticket-list', component: TicketListComponent },
    { path: 'magasin-di-list', component: MagasinDiListComponent },
    { path: 'tech-di-list', component: TechDiListComponent },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class TicketListRoutingModule {}
