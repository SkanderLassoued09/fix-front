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
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { PaginatorModule } from 'primeng/paginator';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
@NgModule({
    declarations: [CompanyListComponent],
    imports: [
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
        ToastModule,
        ConfirmDialogModule,
        PaginatorModule,
        TagModule,
        TooltipModule,
    ],
    // NOTE: MessageService is intentionally NOT provided here — use the ROOT
    // instance (provided in AppModule) so toasts render in the single global
    // <p-toast> in app.component. A module-level provider created a 2nd
    // MessageService instance, which (with the local <p-toast>, now removed)
    // caused the duplicate-toast bug. ConfirmationService stays for the local
    // <p-confirmDialog>.
    providers: [ConfirmationService],
})
export class CompanyListModule {}
