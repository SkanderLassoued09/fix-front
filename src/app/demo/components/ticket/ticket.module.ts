import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TicketRoutingModule } from './ticket-routing.module';
import { ImageModule } from 'primeng/image';

@NgModule({
    declarations: [],
    imports: [CommonModule, TicketRoutingModule, ImageModule],
})
export class TicketModule {}
