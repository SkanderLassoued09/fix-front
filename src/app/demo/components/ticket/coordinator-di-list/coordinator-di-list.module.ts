import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CoordinatorDiListRoutingModule } from './coordinator-di-list-routing.module';
import { ImageModule } from 'primeng/image';
import { PaginatorModule } from 'primeng/paginator';
import { SearchableDropdownDirective } from '../../../../shared/searchable-dropdown.directive';
import { TableCellTruncateDirective } from '../../../../shared/table-cell-truncate.directive';

@NgModule({
    declarations: [],
    imports: [
        TableCellTruncateDirective,
        SearchableDropdownDirective,
        CommonModule,
        CoordinatorDiListRoutingModule,
        ImageModule,
        PaginatorModule,
    ],
    // Ni MessageService ni ConfirmationService ici : ils sont fournis
    // UNIQUEMENT à la racine (`app.module.ts`), où le shell rend l'unique
    // <p-toast> et l'unique <app-fx-confirm-dialog>. Un provider local
    // recréerait une 2e instance, sans exutoire abonné.
})
export class CoordinatorDiListModule {}
