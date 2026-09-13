import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClientListRoutingModule } from './client-list-routing.module';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { ClientListComponent } from './client-list.component';
import { DropdownModule } from 'primeng/dropdown';
import { InputMaskModule } from 'primeng/inputmask';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PaginatorModule } from 'primeng/paginator';
import { TooltipModule } from 'primeng/tooltip';
import { SearchableDropdownDirective } from '../../../../shared/searchable-dropdown.directive';
import { TableCellTruncateDirective } from '../../../../shared/table-cell-truncate.directive';

@NgModule({
    declarations: [ClientListComponent],
    imports: [
        TableCellTruncateDirective,
        SearchableDropdownDirective,
        CommonModule,
        ClientListRoutingModule,
        DialogModule,
        ButtonModule,
        TableModule,
        InputTextModule,
        DropdownModule,
        InputMaskModule,
        FormsModule,
        ReactiveFormsModule,
        PaginatorModule,
        TooltipModule,
    ],
    // Ni MessageService ni ConfirmationService ici : ils sont fournis
    // UNIQUEMENT à la racine (`app.module.ts`), où le shell rend l'unique
    // <p-toast> et l'unique <app-fx-confirm-dialog>. Un provider local
    // recréerait une 2e instance, sans exutoire abonné.
})
export class ClientListModule {}
