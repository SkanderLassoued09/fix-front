import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileListRoutingModule } from './profile-list-routing.module';

import { DialogModule } from 'primeng/dialog';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { PasswordModule } from 'primeng/password';
import { InputMaskModule } from 'primeng/inputmask';
import { DropdownModule } from 'primeng/dropdown';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PaginatorModule } from 'primeng/paginator';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ProfileListComponent } from './profile-list.component';
import { TooltipModule } from 'primeng/tooltip';
import { SearchableDropdownDirective } from '../../../../shared/searchable-dropdown.directive';
import { TableCellTruncateDirective } from '../../../../shared/table-cell-truncate.directive';
@NgModule({
    declarations: [ProfileListComponent],
    imports: [
        TableCellTruncateDirective,
        SearchableDropdownDirective,
        CommonModule,
        ProfileListRoutingModule,
        DialogModule,
        ButtonModule,
        TableModule,
        InputTextModule,
        InputGroupModule,
        InputGroupAddonModule,
        PasswordModule,
        InputMaskModule,
        DropdownModule,
        FormsModule,
        ReactiveFormsModule,
        PaginatorModule,
        TagModule,
        TooltipModule,
    ],
    // Ni MessageService ni ConfirmationService ici : ils sont fournis
    // UNIQUEMENT à la racine (`app.module.ts`), où le shell rend l'unique
    // <p-toast> et l'unique <app-fx-confirm-dialog>. Un provider local
    // recréerait une 2e instance, sans exutoire abonné.
})
export class ProfileListModule {}
