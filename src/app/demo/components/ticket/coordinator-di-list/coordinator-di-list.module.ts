import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmationService, MessageService } from 'primeng/api';

import { CoordinatorDiListRoutingModule } from './coordinator-di-list-routing.module';
import { ImageModule } from 'primeng/image';
import { PaginatorModule } from 'primeng/paginator';
import { SearchableDropdownDirective } from '../../../../shared/searchable-dropdown.directive';

@NgModule({
    declarations: [],
    imports: [
        SearchableDropdownDirective,
        CommonModule,
        CoordinatorDiListRoutingModule,
        ImageModule,
        PaginatorModule,
    ],
    providers: [MessageService, ConfirmationService],
})
export class CoordinatorDiListModule {}
