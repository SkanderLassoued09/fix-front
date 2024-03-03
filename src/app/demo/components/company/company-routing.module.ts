import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
    {
        path: 'company',
        loadChildren: () =>
            import('./company-list/company-list.module').then(
                (m) => m.CompanyListModule
            ),
    },
];
@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class CompanyRoutingModule {}
