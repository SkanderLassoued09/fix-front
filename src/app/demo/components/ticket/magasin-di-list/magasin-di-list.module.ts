import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MagasinDiListRoutingModule } from './magasin-di-list-routing.module';
import { PaginatorModule } from 'primeng/paginator';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { SearchableDropdownDirective } from '../../../../shared/searchable-dropdown.directive';
import { TableCellTruncateDirective } from '../../../../shared/table-cell-truncate.directive';

@NgModule({
    declarations: [],
    imports: [
        TableCellTruncateDirective,
        SearchableDropdownDirective,
        CommonModule,
        MagasinDiListRoutingModule,
        PaginatorModule,
        InputTextModule,
        DropdownModule,
    ],
})
export class MagasinDiListModule {}
