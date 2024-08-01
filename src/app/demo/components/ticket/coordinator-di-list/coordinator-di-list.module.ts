import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmationService, MessageService } from 'primeng/api';

import { CoordinatorDiListRoutingModule } from './coordinator-di-list-routing.module';
import { ImageModule } from 'primeng/image';

@NgModule({
    declarations: [],
    imports: [CommonModule, CoordinatorDiListRoutingModule, ImageModule],
    providers: [MessageService, ConfirmationService],
})
export class CoordinatorDiListModule {}
