import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ProfileListRoutingModule } from './profile-list-routing.module';
import { ProfileListComponent } from './profile-list.component';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { PasswordModule } from 'primeng/password';
import { InputMaskModule } from 'primeng/inputmask';
import { DropdownModule } from 'primeng/dropdown';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
@NgModule({
    declarations: [ProfileListComponent],
    imports: [
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
        ToastModule,
    ],
    providers: [MessageService],
})
export class ProfileListModule {}
