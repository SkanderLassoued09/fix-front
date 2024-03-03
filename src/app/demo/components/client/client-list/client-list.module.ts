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
import { ReactiveFormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
@NgModule({
    declarations: [ClientListComponent],
    imports: [
        CommonModule,
        ClientListRoutingModule,
        DialogModule,
        ButtonModule,
        TableModule,
        InputTextModule,
        DropdownModule,
        InputMaskModule,
        ReactiveFormsModule,
        ToastModule,
    ],
    providers: [MessageService],
})
export class ClientListModule {}
