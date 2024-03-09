import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TicketListRoutingModule } from './ticket-list-routing.module';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';

import { InputTextModule } from 'primeng/inputtext';

import { TableModule } from 'primeng/table';

import { TicketListComponent } from './ticket-list.component';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputMaskModule } from 'primeng/inputmask';
import { PasswordModule } from 'primeng/password';
import { RadioButtonModule } from 'primeng/radiobutton';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FileUploadModule } from 'primeng/fileupload';
import { MagasinDiListRoutingModule } from '../magasin-di-list/magasin-di-list-routing.module';
import { CoordinatorDiListRoutingModule } from '../coordinator-di-list/coordinator-di-list-routing.module';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TagModule } from 'primeng/tag';
import { CoordinatorDiListModule } from '../coordinator-di-list/coordinator-di-list.module';
import { CoordinatorDiListComponent } from '../coordinator-di-list/coordinator-di-list.component';
import { MagasinDiListComponent } from '../magasin-di-list/magasin-di-list.component';
import { FieldsetModule } from 'primeng/fieldset';

@NgModule({
    declarations: [
        TicketListComponent,
        CoordinatorDiListComponent,
        MagasinDiListComponent,
    ],
    imports: [
        CommonModule,
        TicketListRoutingModule,
        MagasinDiListRoutingModule,
        CoordinatorDiListRoutingModule,

        DialogModule,
        ButtonModule,
        TableModule,
        InputTextModule,
        InputGroupModule,
        InputGroupAddonModule,
        PasswordModule,
        InputMaskModule,
        DropdownModule,
        RadioButtonModule,
        FormsModule,
        FileUploadModule,
        ConfirmDialogModule,
        ToastModule,
        ToolbarModule,
        TagModule,
        ReactiveFormsModule,
        FieldsetModule,
    ],
    providers: [ConfirmationService, MessageService],
})
export class TicketListModule {}
