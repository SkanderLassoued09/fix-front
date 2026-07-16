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
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { PaginatorModule } from 'primeng/paginator';
import { TooltipModule } from 'primeng/tooltip';
import { SearchableDropdownDirective } from '../../../../shared/searchable-dropdown.directive';

@NgModule({
    declarations: [ClientListComponent],
    imports: [
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
        ToastModule,
        ConfirmDialogModule,
        PaginatorModule,
        TooltipModule,
    ],
    providers: [MessageService, ConfirmationService],
})
export class ClientListModule {}
