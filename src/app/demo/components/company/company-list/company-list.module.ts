import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompanyListRoutingModule } from './company-list-routing.module';
import { CompanyListComponent } from './company-list.component';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PaginatorModule } from 'primeng/paginator';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SearchableDropdownDirective } from '../../../../shared/searchable-dropdown.directive';
import { CompanyImportComponent } from '../company-import/company-import.component';
import { TableCellTruncateDirective } from '../../../../shared/table-cell-truncate.directive';
@NgModule({
    declarations: [CompanyListComponent],
    imports: [
        TableCellTruncateDirective,
        SearchableDropdownDirective,
        CompanyImportComponent,
        CommonModule,
        CompanyListRoutingModule,
        DialogModule,
        ButtonModule,
        TableModule,
        InputTextModule,
        InputGroupModule,
        InputGroupAddonModule,
        FormsModule,
        ReactiveFormsModule,
        DropdownModule,
        PaginatorModule,
        TagModule,
        TooltipModule,
    ],
    // Ni MessageService ni ConfirmationService ici : ils sont fournis
    // UNIQUEMENT à la racine (`app.module.ts`), où le shell rend l'unique
    // <p-toast> et l'unique <app-fx-confirm-dialog>. Un provider local
    // recréerait une 2e instance, sans exutoire abonné.
})
export class CompanyListModule {}
