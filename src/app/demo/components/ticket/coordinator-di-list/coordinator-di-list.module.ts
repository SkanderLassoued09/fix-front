import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CoordinatorDiListRoutingModule } from './coordinator-di-list-routing.module';
import { CoordinatorDiListComponent } from './coordinator-di-list.component';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { FormsModule } from '@angular/forms';

@NgModule({
    declarations: [],
    imports: [CommonModule, CoordinatorDiListRoutingModule],
})
export class CoordinatorDiListModule {}
