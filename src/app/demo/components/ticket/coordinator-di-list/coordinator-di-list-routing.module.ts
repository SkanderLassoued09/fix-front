import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CoordinatorDiListComponent } from './coordinator-di-list.component';

const routes: Routes = [
    { path: 'coordinator-di-list', component: CoordinatorDiListComponent },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class CoordinatorDiListRoutingModule {}
