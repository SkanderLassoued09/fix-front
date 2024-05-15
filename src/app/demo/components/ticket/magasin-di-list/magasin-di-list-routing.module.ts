import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MagasinDiListComponent } from './magasin-di-list.component';

const routes: Routes = [];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class MagasinDiListRoutingModule {}
