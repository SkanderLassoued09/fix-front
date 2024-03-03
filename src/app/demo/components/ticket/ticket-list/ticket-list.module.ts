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
import { FormsModule } from '@angular/forms';
import { FileUploadModule } from 'primeng/fileupload';
import { MagasinDiListRoutingModule } from '../magasin-di-list/magasin-di-list-routing.module';
import { CoordinatorDiListRoutingModule } from '../coordinator-di-list/coordinator-di-list-routing.module';

@NgModule({
    declarations: [TicketListComponent],
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
    ],
})
export class TicketListModule {}
