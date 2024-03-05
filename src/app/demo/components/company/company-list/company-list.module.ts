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
import { ReactiveFormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
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
        ReactiveFormsModule,
        ToastModule,
        ConfirmDialogModule,
    ],
    providers: [MessageService, ConfirmationService],
})
export class CompanyListModule {}
