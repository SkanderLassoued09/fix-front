import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CoordinatorDiListRoutingModule } from './coordinator-di-list-routing.module';
import { CoordinatorDiListComponent } from './coordinator-di-list.component';

@NgModule({
    declarations: [CoordinatorDiListComponent],
    imports: [CommonModule, CoordinatorDiListRoutingModule],
})
export class CoordinatorDiListModule {}
